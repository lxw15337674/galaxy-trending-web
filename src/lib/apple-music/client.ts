import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { normalizeAppleMusicArtworkUrl } from './artwork';
import {
  APPLE_MUSIC_KNOWN_COUNTRY_CODES,
  getAppleMusicCountryName,
  normalizeAppleMusicCountryCode,
} from './countries';
import {
  APPLE_MUSIC_DAILY_PERIOD_TYPE,
  APPLE_MUSIC_GLOBAL_COUNTRY_CODE,
  APPLE_MUSIC_TOP_SONGS_CHART_TYPE,
  APPLE_MUSIC_TOP_SONGS_SOURCE_TYPE,
  type AppleMusicChartItem,
  type AppleMusicCountryOption,
  type AppleMusicTopSongsSnapshot,
} from './types';

const REQUEST_TIMEOUT_MS = 15000;
const COUNTRY_DISCOVERY_CACHE_TTL_MS = 5 * 60 * 1000;
const APPLE_MUSIC_FEED_BASE_URL = 'https://rss.applemarketingtools.com/api/v2';
const APPLE_MUSIC_FEED_MARKER = '__APPLE_MUSIC_FEED_FINAL_URL__:';
const APPLE_MUSIC_FEED_COUNT = 100;
const execFileAsync = promisify(execFile);

interface AppleMusicFeedLink {
  self?: string;
}

interface AppleMusicFeedSong {
  artistName?: string;
  artistUrl?: string;
  artworkUrl100?: string;
  contentAdvisoryRating?: string;
  genres?: Array<{ genreId?: string; name?: string; url?: string }>;
  id?: string;
  kind?: string;
  name?: string;
  releaseDate?: string;
  url?: string;
}

interface AppleMusicFeedPayload {
  feed?: {
    title?: string;
    id?: string;
    author?: { name?: string; url?: string };
    links?: AppleMusicFeedLink[];
    copyright?: string;
    country?: string;
    updated?: string;
    results?: AppleMusicFeedSong[];
  };
}

interface TextResponse {
  body: string;
  finalUrl: string;
}

let countryCache:
  | {
      expiresAt: number;
      data: AppleMusicCountryOption[];
    }
  | null = null;

function cloneCountryOptions(items: AppleMusicCountryOption[]) {
  return items.map((item) => ({ ...item }));
}

function getCountryCache() {
  if (!countryCache) return null;
  if (Date.now() > countryCache.expiresAt) return null;
  return cloneCountryOptions(countryCache.data);
}

function buildFeedUrl(countryCode: string) {
  return `${APPLE_MUSIC_FEED_BASE_URL}/${countryCode.toLowerCase()}/music/most-played/${APPLE_MUSIC_FEED_COUNT}/songs.json`;
}

function parseFinalUrl(stdout: string) {
  const markerIndex = stdout.lastIndexOf(APPLE_MUSIC_FEED_MARKER);
  if (markerIndex < 0) {
    return { body: stdout, finalUrl: '' };
  }

  const body = stdout.slice(0, markerIndex);
  const finalUrl = stdout.slice(markerIndex + APPLE_MUSIC_FEED_MARKER.length).trim();
  return { body, finalUrl };
}

async function fetchTextViaCurl(url: string): Promise<TextResponse> {
  const command = process.platform === 'win32' ? 'curl.exe' : 'curl';
  const args = [
    '-L',
    '--max-time',
    String(Math.ceil(REQUEST_TIMEOUT_MS / 1000)),
    '-A',
    'Mozilla/5.0',
    '-H',
    'Accept-Language: en-US,en;q=0.9',
    '-w',
    `\n${APPLE_MUSIC_FEED_MARKER}%{url_effective}`,
    url,
  ];
  const { stdout } = await execFileAsync(command, args, { maxBuffer: 8 * 1024 * 1024 });
  const { body, finalUrl } = parseFinalUrl(stdout);
  if (!body || !body.trim()) {
    throw new Error(`Empty response while fetching Apple Music feed URL: ${url}`);
  }

  return {
    body,
    finalUrl: finalUrl || url,
  };
}

async function fetchText(url: string): Promise<TextResponse> {
  try {
    return await fetchTextViaCurl(url);
  } catch (curlError) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'accept-language': 'en-US,en;q=0.9',
          'user-agent': 'Mozilla/5.0',
        },
      });
      const body = await response.text();
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }
      if (!body || !body.trim()) {
        throw new Error(`Empty response while fetching Apple Music feed URL: ${url}`);
      }

      return {
        body,
        finalUrl: response.url || url,
      };
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : String(fetchError);
      const curlMessage = curlError instanceof Error ? curlError.message : String(curlError);
      throw new Error(`Apple Music feed fetch failed for ${url}. curl=${curlMessage}; fetch=${message}`);
    } finally {
      clearTimeout(timer);
    }
  }
}

async function fetchFeed(url: string) {
  const response = await fetchText(url);
  let payload: AppleMusicFeedPayload;

  try {
    payload = JSON.parse(response.body) as AppleMusicFeedPayload;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Apple Music feed returned invalid JSON for ${url}: ${message}`);
  }

  return {
    payload,
    finalUrl: response.finalUrl,
  };
}

function toCountryOption(countryCode: string): AppleMusicCountryOption {
  const normalizedCountryCode = normalizeAppleMusicCountryCode(countryCode);
  return {
    countryCode: normalizedCountryCode,
    countryName: getAppleMusicCountryName(normalizedCountryCode) ?? normalizedCountryCode,
    playlistId: `feed:${normalizedCountryCode.toLowerCase()}`,
    playlistSlug: 'most-played-songs',
    sourceUrl: '',
  };
}

function parseFetchedAt(feedUpdated: string | undefined) {
  const parsed = new Date(String(feedUpdated ?? '').trim());
  if (Number.isNaN(parsed.valueOf())) {
    throw new Error(`Apple Music feed is missing a valid updated timestamp: ${feedUpdated ?? 'N/A'}`);
  }

  return parsed.toISOString();
}

function parseFeedItems(results: AppleMusicFeedSong[] | undefined): AppleMusicChartItem[] {
  if (!Array.isArray(results) || results.length === 0) {
    throw new Error('Apple Music feed returned no songs');
  }

  return results.map((item, index) => {
    const appleSongId = String(item.id ?? '').trim();
    const trackName = String(item.name ?? '').trim();
    const artistNames = String(item.artistName ?? '').trim();
    const appleSongUrl = String(item.url ?? '').trim();

    if (!appleSongId || !trackName || !artistNames || !appleSongUrl) {
      throw new Error(`Apple Music feed item at rank=${index + 1} is missing required fields`);
    }

    return {
      rank: index + 1,
      trackName,
      artistNames,
      appleSongId,
      appleSongUrl,
      durationMs: null,
      thumbnailUrl: normalizeAppleMusicArtworkUrl(item.artworkUrl100),
      rawItem: item,
    };
  });
}

export class AppleMusicChartsClient {
  async listAvailableTopSongsCountries(): Promise<AppleMusicCountryOption[]> {
    const cached = getCountryCache();
    if (cached) {
      return cached;
    }

    const countries = APPLE_MUSIC_KNOWN_COUNTRY_CODES.map((countryCode) => toCountryOption(countryCode));
    countryCache = {
      expiresAt: Date.now() + COUNTRY_DISCOVERY_CACHE_TTL_MS,
      data: cloneCountryOptions(countries),
    };

    return cloneCountryOptions(countries);
  }

  async fetchDailyTopSongs(countryCodeInput: string): Promise<AppleMusicTopSongsSnapshot> {
    const countryCode = normalizeAppleMusicCountryCode(countryCodeInput);
    if (countryCode === APPLE_MUSIC_GLOBAL_COUNTRY_CODE) {
      throw new Error('Apple Music global top songs are not available from the current official feed source');
    }

    const requestedFeedUrl = buildFeedUrl(countryCode);
    const { payload, finalUrl } = await fetchFeed(requestedFeedUrl);
    const feed = payload.feed;
    if (!feed) {
      throw new Error(`Apple Music feed payload is missing the feed object for country=${countryCode}`);
    }

    const fetchedAt = parseFetchedAt(feed.updated);
    const items = parseFeedItems(feed.results);
    const countryName = getAppleMusicCountryName(countryCode) ?? countryCode;
    const playlistTitle = `${String(feed.title ?? 'Top Songs').trim()}: ${countryName}`;

    return {
      chartType: APPLE_MUSIC_TOP_SONGS_CHART_TYPE,
      periodType: APPLE_MUSIC_DAILY_PERIOD_TYPE,
      countryCode,
      countryName,
      chartEndDate: fetchedAt.slice(0, 10),
      fetchedAt,
      sourceUrl: '',
      playlistId: `feed:${countryCode.toLowerCase()}`,
      playlistSlug: 'most-played-songs',
      playlistTitle,
      items,
      rawPayload: {
        sourceType: APPLE_MUSIC_TOP_SONGS_SOURCE_TYPE,
        requestedFeedUrl,
        finalFeedUrl: finalUrl,
        feedId: feed.id ?? null,
        feedCountry: feed.country ?? null,
        feedTitle: feed.title ?? null,
        feedUpdated: feed.updated ?? null,
        resultCount: items.length,
        dateSource: 'feed.updated',
      },
    };
  }
}
