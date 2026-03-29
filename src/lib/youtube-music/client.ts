import {
  YOUTUBE_MUSIC_DAILY_PERIOD_TYPE,
  YOUTUBE_MUSIC_GLOBAL_COUNTRY_CODE,
  YOUTUBE_MUSIC_GLOBAL_COUNTRY_NAME,
  YOUTUBE_MUSIC_SHORTS_SONGS_CHART_TYPE,
  YOUTUBE_MUSIC_TOP_VIDEOS_CHART_TYPE,
  YOUTUBE_MUSIC_TOP_SONGS_CHART_TYPE,
  YOUTUBE_MUSIC_WEEKLY_PERIOD_TYPE,
  type YouTubeMusicChartArtist,
  type YouTubeMusicChartItem,
  type YouTubeMusicCountryOption,
  type YouTubeMusicDailyVideoItem,
  type YouTubeMusicDailyVideoSnapshot,
  type YouTubeMusicShortsSongDailySnapshot,
  type YouTubeMusicWeeklyChartSnapshot,
} from './types';

const YOUTUBE_MUSIC_BROWSE_URL = 'https://charts.youtube.com/youtubei/v1/browse?alt=json';
const YOUTUBE_MUSIC_CHARTS_HOME_URL = 'https://charts.youtube.com/global';
const REQUEST_TIMEOUT_MS = 15000;
const COUNTRY_DISCOVERY_CACHE_TTL_MS = 5 * 60 * 1000;
const PROBE_RETRY_DELAYS_MS = [1000, 3000, 5000];

type ChartCountryDiscoveryKey = 'tracks-weekly' | 'videos-daily' | 'shorts-tracks-by-usage-daily';

interface ChartCountryDiscoveryCacheEntry {
  expiresAt: number;
  data: YouTubeMusicCountryOption[];
}

interface ChartAvailabilityProbeConfig {
  cacheKey: ChartCountryDiscoveryKey;
  chartType: string;
  periodType: string;
  responseChartType: string;
  responsePeriodType: string;
}

let launchedCountryCache: ChartCountryDiscoveryCacheEntry | null = null;
const chartCountryCache = new Map<ChartCountryDiscoveryKey, ChartCountryDiscoveryCacheEntry>();

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.round(value);
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.round(parsed) : null;
  }

  return null;
}

function pickThumbnail(value: unknown): string | null {
  const thumbnails = Array.isArray((value as { thumbnails?: unknown[] } | null)?.thumbnails)
    ? ((value as { thumbnails?: Array<{ url?: unknown }> }).thumbnails ?? [])
    : [];

  for (const thumbnail of [...thumbnails].reverse()) {
    if (typeof thumbnail?.url === 'string' && thumbnail.url.trim()) {
      return thumbnail.url;
    }
  }

  return null;
}

function normalizeArtistList(value: unknown): YouTubeMusicChartArtist[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => {
      const name = typeof entry?.name === 'string' ? entry.name.trim() : '';
      if (!name) return null;
      return {
        name,
        kgMid: typeof entry?.kgMid === 'string' && entry.kgMid.trim() ? entry.kgMid.trim() : null,
      } satisfies YouTubeMusicChartArtist;
    })
    .filter((item): item is YouTubeMusicChartArtist => Boolean(item));
}

async function fetchJson(body: Record<string, unknown>): Promise<Record<string, any>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(YOUTUBE_MUSIC_BROWSE_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-youtube-client-name': '31',
        'x-youtube-client-version': '2.0',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await response.text();

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    try {
      return JSON.parse(text) as Record<string, any>;
    } catch (error) {
      throw new Error(`Invalid JSON: ${(error as Error).message}`);
    }
  } finally {
    clearTimeout(timer);
  }
}

async function fetchText(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'accept-language': 'en-US,en;q=0.9',
      },
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }
    return text;
  } finally {
    clearTimeout(timer);
  }
}

interface ChartSectionResult {
  payload: Record<string, any>;
  section: Record<string, any>;
}

function parseLaunchedChartCountries(html: string): YouTubeMusicCountryOption[] {
  const match = html.match(/LAUNCHED_CHART_COUNTRIES":\[(.*?)\],"COUNTRY_GLS_WITHOUT_TRENDING_CHART"/s);
  if (!match?.[1]) {
    throw new Error('Unable to locate launched chart countries in YouTube Music page HTML');
  }

  let parsed: Array<{ gl?: unknown; name?: unknown }>;
  try {
    parsed = JSON.parse(`[${match[1]}]`) as Array<{ gl?: unknown; name?: unknown }>;
  } catch (error) {
    throw new Error(`Failed to parse launched chart countries JSON: ${(error as Error).message}`);
  }

  const countries = parsed
    .map((entry) => {
      const countryCode = typeof entry.gl === 'string' ? entry.gl.trim().toUpperCase() : '';
      const countryName = typeof entry.name === 'string' ? entry.name.trim() : '';
      if (!countryCode || !countryName) return null;
      return { countryCode, countryName } satisfies YouTubeMusicCountryOption;
    })
    .filter((entry): entry is YouTubeMusicCountryOption => Boolean(entry));

  return [{ countryCode: YOUTUBE_MUSIC_GLOBAL_COUNTRY_CODE, countryName: YOUTUBE_MUSIC_GLOBAL_COUNTRY_NAME }, ...countries];
}

function cloneCountryOptions(countries: YouTubeMusicCountryOption[]) {
  return countries.map((country) => ({ ...country }));
}

function getCachedCountries(
  entry: ChartCountryDiscoveryCacheEntry | null | undefined,
): YouTubeMusicCountryOption[] | null {
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) return null;
  return cloneCountryOptions(entry.data);
}

async function getLaunchedChartCountries(): Promise<YouTubeMusicCountryOption[]> {
  const cached = getCachedCountries(launchedCountryCache);
  if (cached) {
    return cached;
  }

  const html = await fetchText(YOUTUBE_MUSIC_CHARTS_HOME_URL);
  const countries = parseLaunchedChartCountries(html);
  launchedCountryCache = {
    expiresAt: Date.now() + COUNTRY_DISCOVERY_CACHE_TTL_MS,
    data: cloneCountryOptions(countries),
  };
  return cloneCountryOptions(countries);
}

function setChartCountryCache(cacheKey: ChartCountryDiscoveryKey, countries: YouTubeMusicCountryOption[]) {
  chartCountryCache.set(cacheKey, {
    expiresAt: Date.now() + COUNTRY_DISCOVERY_CACHE_TTL_MS,
    data: cloneCountryOptions(countries),
  });
}

function normalizeCountryCode(value: string) {
  const normalized = value.trim();
  if (!normalized) return YOUTUBE_MUSIC_GLOBAL_COUNTRY_CODE;
  if (normalized.toLowerCase() === YOUTUBE_MUSIC_GLOBAL_COUNTRY_CODE) {
    return YOUTUBE_MUSIC_GLOBAL_COUNTRY_CODE;
  }
  return normalized.toUpperCase();
}

function resolveCountryName(countryCode: string) {
  if (countryCode === YOUTUBE_MUSIC_GLOBAL_COUNTRY_CODE) {
    return YOUTUBE_MUSIC_GLOBAL_COUNTRY_NAME;
  }

  try {
    const label = new Intl.DisplayNames(['en'], { type: 'region' }).of(countryCode);
    return label && label !== countryCode ? label : countryCode;
  } catch {
    return countryCode;
  }
}

function buildCountrySourceUrl(countryCode: string) {
  const pathCode = countryCode === YOUTUBE_MUSIC_GLOBAL_COUNTRY_CODE ? 'global' : countryCode.toLowerCase();
  return `https://charts.youtube.com/charts/TopSongs/${pathCode}/weekly`;
}

function buildDailyVideosSourceUrl(countryCode: string) {
  const pathCode = countryCode === YOUTUBE_MUSIC_GLOBAL_COUNTRY_CODE ? 'global' : countryCode.toLowerCase();
  return `https://charts.youtube.com/charts/TopVideos/${pathCode}/daily`;
}

function buildDailyShortsSongsSourceUrl(countryCode: string) {
  const pathCode = countryCode === YOUTUBE_MUSIC_GLOBAL_COUNTRY_CODE ? 'global' : countryCode.toLowerCase();
  return `https://charts.youtube.com/charts/TopSongsOnShorts/${pathCode}/daily`;
}

function buildChartQuery(countryCode: string, chartType: string, periodType: string) {
  return `perspective=CHART_DETAILS&chart_params_country_code=${countryCode}&chart_params_chart_type=${chartType}&chart_params_period_type=${periodType}`;
}

function normalizeChartEndDate(section: Record<string, any>, responseChartType: string, responsePeriodType: string) {
  const availableChartsInfo = Array.isArray(section?.perspectiveMetadata?.availableChartsInfo)
    ? section.perspectiveMetadata.availableChartsInfo
    : [];

  const matched = availableChartsInfo.find(
    (entry: Record<string, unknown>) =>
      entry?.chartType === responseChartType && entry?.chartPeriodType === responsePeriodType,
  );

  return typeof matched?.latestEndDate === 'string' ? matched.latestEndDate.trim() : null;
}

function assertChartParams(section: Record<string, any>, countryCode: string, responseChartType: string) {
  const requestParams = section?.perspectiveMetadata?.requestParams?.chartParams ?? null;
  if (
    String(requestParams?.countryCode ?? '').toLowerCase() !== countryCode.toLowerCase() ||
    requestParams?.chartType !== responseChartType
  ) {
    throw new Error('Unexpected YouTube Music chart response parameters');
  }
}

function normalizeItem(entry: Record<string, any> | null | undefined): YouTubeMusicChartItem | null {
  if (!entry || typeof entry !== 'object') return null;

  const rank = toNumber(entry.chartEntryMetadata?.currentPosition);
  const trackName = typeof entry.name === 'string' ? entry.name.trim() : '';
  const artists = normalizeArtistList(entry.artists);
  const artistNames = artists.map((artist) => artist.name).join(' & ');

  if (!rank || !trackName || !artistNames) {
    return null;
  }

  const youtubeVideoId =
    typeof entry.encryptedVideoId === 'string' && entry.encryptedVideoId.trim()
      ? entry.encryptedVideoId.trim()
      : typeof entry.atvExternalVideoId === 'string' && entry.atvExternalVideoId.trim()
        ? entry.atvExternalVideoId.trim()
        : null;

  return {
    rank,
    previousRank: toNumber(entry.chartEntryMetadata?.previousPosition),
    trackName,
    artistNames,
    artists,
    views: toNumber(entry.viewCount),
    periodsOnChart: toNumber(entry.chartEntryMetadata?.periodsOnChart),
    youtubeVideoId,
    youtubeUrl: youtubeVideoId ? `https://www.youtube.com/watch?v=${youtubeVideoId}` : null,
    thumbnailUrl: pickThumbnail(entry.thumbnail),
    rawItem: entry,
  };
}

function normalizeDailyVideoItem(entry: Record<string, any> | null | undefined): YouTubeMusicDailyVideoItem | null {
  if (!entry || typeof entry !== 'object') return null;

  const rank = toNumber(entry.chartEntryMetadata?.currentPosition);
  const videoTitle = typeof entry.title === 'string' ? entry.title.trim() : '';
  const artists = normalizeArtistList(entry.artists);
  const artistNames = artists.map((artist) => artist.name).join(' & ');
  const youtubeVideoId = typeof entry.id === 'string' && entry.id.trim() ? entry.id.trim() : null;

  if (!rank || !videoTitle || !artistNames || !youtubeVideoId) {
    return null;
  }

  return {
    rank,
    previousRank: toNumber(entry.chartEntryMetadata?.previousPosition),
    videoTitle,
    artistNames,
    artists,
    views: toNumber(entry.viewCount),
    periodsOnChart: toNumber(entry.chartEntryMetadata?.periodsOnChart),
    youtubeVideoId,
    youtubeUrl: `https://www.youtube.com/watch?v=${youtubeVideoId}`,
    thumbnailUrl: pickThumbnail(entry.thumbnail),
    channelName: typeof entry.channelName === 'string' && entry.channelName.trim() ? entry.channelName.trim() : null,
    channelId:
      typeof entry.externalChannelId === 'string' && entry.externalChannelId.trim()
        ? entry.externalChannelId.trim()
        : null,
    durationSeconds: toNumber(entry.videoDuration),
    rawItem: entry,
  };
}

async function fetchChartSection(countryCode: string, chartType: string, periodType: string): Promise<ChartSectionResult> {
  const payload = await fetchJson({
    context: {
      client: {
        clientName: 'WEB_MUSIC_ANALYTICS',
        clientVersion: '2.0',
        hl: 'en',
        gl: 'US',
        theme: 'MUSIC',
      },
      capabilities: {},
      request: {
        internalExperimentFlags: [],
      },
    },
    browseId: 'FEmusic_analytics_charts_home',
    query: buildChartQuery(countryCode, chartType, periodType),
  });

  const section =
    payload.contents?.sectionListRenderer?.contents?.[0]?.musicAnalyticsSectionRenderer?.content ?? null;

  if (!section || typeof section !== 'object') {
    throw new Error('Missing YouTube Music chart section in response');
  }

  return { payload, section };
}

async function delay(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function isChartAvailableForCountry(
  countryCode: string,
  config: ChartAvailabilityProbeConfig,
): Promise<boolean> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= PROBE_RETRY_DELAYS_MS.length + 1; attempt += 1) {
    try {
      const { section } = await fetchChartSection(countryCode, config.chartType, config.periodType);
      assertChartParams(section, countryCode, config.responseChartType);
      return Boolean(normalizeChartEndDate(section, config.responseChartType, config.responsePeriodType));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/^HTTP 400\b/.test(message)) {
        return false;
      }

      lastError = error;
      if (attempt > PROBE_RETRY_DELAYS_MS.length) {
        break;
      }

      await delay(PROBE_RETRY_DELAYS_MS[attempt - 1]);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function discoverCountriesForChart(config: ChartAvailabilityProbeConfig): Promise<YouTubeMusicCountryOption[]> {
  const cached = getCachedCountries(chartCountryCache.get(config.cacheKey));
  if (cached) {
    return cached;
  }

  const launchedCountries = await getLaunchedChartCountries();
  const supported: YouTubeMusicCountryOption[] = [];

  for (const country of launchedCountries) {
    const isAvailable = await isChartAvailableForCountry(country.countryCode, config);
    if (isAvailable) {
      supported.push(country);
    }
  }

  setChartCountryCache(config.cacheKey, supported);
  return cloneCountryOptions(supported);
}

export class YouTubeMusicChartsClient {
  async listAvailableChartCountries(): Promise<YouTubeMusicCountryOption[]> {
    return getLaunchedChartCountries();
  }

  async listAvailableWeeklyTopSongsCountries(): Promise<YouTubeMusicCountryOption[]> {
    return this.listAvailableChartCountries();
  }

  async listAvailableDailyTopVideosCountries(): Promise<YouTubeMusicCountryOption[]> {
    return this.listAvailableChartCountries();
  }

  async listAvailableDailyShortsSongsCountries(): Promise<YouTubeMusicCountryOption[]> {
    return discoverCountriesForChart({
      cacheKey: 'shorts-tracks-by-usage-daily',
      chartType: 'SHORTS_TRACKS_BY_USAGE',
      periodType: 'DAILY',
      responseChartType: 'CHART_TYPE_SHORTS_TRACKS_BY_USAGE',
      responsePeriodType: 'CHART_PERIOD_TYPE_DAILY',
    });
  }

  async fetchWeeklyTopSongs(countryCodeInput: string): Promise<YouTubeMusicWeeklyChartSnapshot> {
    const countryCode = normalizeCountryCode(countryCodeInput);
    const { payload, section } = await fetchChartSection(countryCode, 'TRACKS', 'WEEKLY');
    const chartEndDate = normalizeChartEndDate(section, 'CHART_TYPE_TRACKS', 'CHART_PERIOD_TYPE_WEEKLY');
    const trackViews = Array.isArray(section?.trackTypes?.[0]?.trackViews) ? section.trackTypes[0].trackViews : [];
    const items = trackViews
      .map((entry: Record<string, any>) => normalizeItem(entry))
      .filter((item: YouTubeMusicChartItem | null): item is YouTubeMusicChartItem => Boolean(item));

    assertChartParams(section, countryCode, 'CHART_TYPE_TRACKS');

    if (!chartEndDate) {
      throw new Error('Missing chart end date in YouTube Music response');
    }

    if (!items.length) {
      throw new Error('No weekly top songs returned by YouTube Music');
    }

    return {
      chartType: YOUTUBE_MUSIC_TOP_SONGS_CHART_TYPE,
      periodType: YOUTUBE_MUSIC_WEEKLY_PERIOD_TYPE,
      countryCode,
      countryName: resolveCountryName(countryCode),
      chartEndDate: chartEndDate.trim(),
      fetchedAt: new Date().toISOString(),
      sourceUrl: buildCountrySourceUrl(countryCode),
      items,
      rawPayload: payload,
    };
  }

  async fetchDailyTopVideos(countryCodeInput: string): Promise<YouTubeMusicDailyVideoSnapshot> {
    const countryCode = normalizeCountryCode(countryCodeInput);
    const { payload, section } = await fetchChartSection(countryCode, 'VIDEOS', 'DAILY');
    const chartEndDate = normalizeChartEndDate(section, 'CHART_TYPE_VIDEOS', 'CHART_PERIOD_TYPE_DAILY');
    const videoBucket = Array.isArray(section?.videos)
      ? section.videos.find(
          (entry: Record<string, any>) => entry?.chartPeriodType === 'CHART_PERIOD_TYPE_DAILY' && Array.isArray(entry?.videoViews),
        ) ?? section.videos[0]
      : null;
    const videoViews = Array.isArray(videoBucket?.videoViews) ? videoBucket.videoViews : [];
    const items = videoViews
      .map((entry: Record<string, any>) => normalizeDailyVideoItem(entry))
      .filter((item: YouTubeMusicDailyVideoItem | null): item is YouTubeMusicDailyVideoItem => Boolean(item));

    assertChartParams(section, countryCode, 'CHART_TYPE_VIDEOS');

    if (!chartEndDate) {
      throw new Error('Missing chart end date in YouTube Music response');
    }

    if (!items.length) {
      throw new Error('No daily top videos returned by YouTube Music');
    }

    return {
      chartType: YOUTUBE_MUSIC_TOP_VIDEOS_CHART_TYPE,
      periodType: YOUTUBE_MUSIC_DAILY_PERIOD_TYPE,
      countryCode,
      countryName: resolveCountryName(countryCode),
      chartEndDate,
      fetchedAt: new Date().toISOString(),
      sourceUrl: buildDailyVideosSourceUrl(countryCode),
      items,
      rawPayload: payload,
    };
  }

  async fetchDailyShortsSongs(countryCodeInput: string): Promise<YouTubeMusicShortsSongDailySnapshot> {
    const countryCode = normalizeCountryCode(countryCodeInput);
    const { payload, section } = await fetchChartSection(countryCode, 'SHORTS_TRACKS_BY_USAGE', 'DAILY');
    const chartEndDate = normalizeChartEndDate(
      section,
      'CHART_TYPE_SHORTS_TRACKS_BY_USAGE',
      'CHART_PERIOD_TYPE_DAILY',
    );
    const trackViews = Array.isArray(section?.trackTypes?.[0]?.trackViews) ? section.trackTypes[0].trackViews : [];
    const items = trackViews
      .map((entry: Record<string, any>) => normalizeItem(entry))
      .filter((item: YouTubeMusicChartItem | null): item is YouTubeMusicChartItem => Boolean(item));

    assertChartParams(section, countryCode, 'CHART_TYPE_SHORTS_TRACKS_BY_USAGE');

    if (!chartEndDate) {
      throw new Error('Missing chart end date in YouTube Music response');
    }

    if (!items.length) {
      throw new Error('No daily shorts songs returned by YouTube Music');
    }

    return {
      chartType: YOUTUBE_MUSIC_SHORTS_SONGS_CHART_TYPE,
      periodType: YOUTUBE_MUSIC_DAILY_PERIOD_TYPE,
      countryCode,
      countryName: resolveCountryName(countryCode),
      chartEndDate,
      fetchedAt: new Date().toISOString(),
      sourceUrl: buildDailyShortsSongsSourceUrl(countryCode),
      items,
      rawPayload: payload,
    };
  }

  async fetchWeeklyTopSongsGlobal(): Promise<YouTubeMusicWeeklyChartSnapshot> {
    return this.fetchWeeklyTopSongs(YOUTUBE_MUSIC_GLOBAL_COUNTRY_CODE);
  }
}
