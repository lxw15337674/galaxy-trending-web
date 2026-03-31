import { existsSync } from 'node:fs';
import { chromium, type LaunchOptions, type Page } from 'playwright-core';
import { normalizeAppleMusicArtworkUrl } from './artwork';
import {
  APPLE_MUSIC_DAILY_PERIOD_TYPE,
  APPLE_MUSIC_GLOBAL_COUNTRY_CODE,
  APPLE_MUSIC_GLOBAL_COUNTRY_NAME,
  APPLE_MUSIC_GLOBAL_PLAYLIST_SOURCE_TYPE,
  APPLE_MUSIC_TOP_SONGS_CHART_TYPE,
  type AppleMusicChartItem,
  type AppleMusicTopSongsSnapshot,
} from './types';

export const APPLE_MUSIC_GLOBAL_PLAYLIST_ID = 'pl.d25f5d1181894928af76c85c967f8f31';
export const APPLE_MUSIC_GLOBAL_PLAYLIST_SLUG = 'top-100-global';
export const APPLE_MUSIC_GLOBAL_PLAYLIST_TITLE = 'Top 100: Global';
export const APPLE_MUSIC_GLOBAL_PLAYLIST_URL =
  `https://music.apple.com/us/playlist/${APPLE_MUSIC_GLOBAL_PLAYLIST_SLUG}/${APPLE_MUSIC_GLOBAL_PLAYLIST_ID}`;

const DEFAULT_TIMEOUT_MS = 45_000;
const DEFAULT_WAIT_AFTER_LOAD_MS = 1_500;
const DEFAULT_WINDOWS_BROWSER_EXECUTABLE_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
];
const DEFAULT_DARWIN_BROWSER_EXECUTABLE_PATHS = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
];
const DEFAULT_LINUX_BROWSER_EXECUTABLE_PATHS = [
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  '/snap/bin/chromium',
];
const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36';

type AppleMusicGlobalPlaylistExtractionMethod = 'json-ld' | 'track-lockup' | 'serialized-data' | 'song-links' | 'none';

interface SerializedServerDataPayload {
  data?: Array<{
    intent?: { $kind?: string };
    data?: {
      canonicalURL?: string;
      seoData?: { pageTitle?: string };
    };
  }>;
}

interface PlaylistMatch {
  path: string;
  id: string | null;
  title: string | null;
  url: string | null;
}

interface ChartItemCandidate {
  source: AppleMusicGlobalPlaylistExtractionMethod;
  order: number;
  rank: number | null;
  trackName: string | null;
  artistNames: string[];
  appleSongId: string | null;
  appleSongUrl: string | null;
  durationMs: number | null;
  thumbnailUrl: string | null;
  rawItem: unknown;
}

interface ExtractionAttempt {
  method: Exclude<AppleMusicGlobalPlaylistExtractionMethod, 'none'>;
  items: AppleMusicChartItem[];
}

export interface AppleMusicGlobalPlaylistTrackSummary {
  rank: number;
  title: string;
  artistNames: string[];
  songId: string;
  url: string;
}

export interface AppleMusicGlobalPlaylistDiagnostics {
  targetUrl: string;
  targetPlaylistId: string;
  extractedAt: string;
  finalUrl: string;
  documentTitle: string;
  documentLang: string;
  canonicalUrl: string | null;
  appleTitleMeta: string | null;
  serializedDataScriptCount: number;
  jsonLdScriptCount: number;
  serializedDataPresent: boolean;
  rootIntentKind: string | null;
  seoPageTitle: string | null;
  bodyTextSample: string;
  playlistIdFoundAnywhere: boolean;
  playlistTitleFoundAnywhere: boolean;
  playlistMatches: PlaylistMatch[];
  trackLockupCount: number;
  songLinkCount: number;
  extraction: {
    selectedMethod: AppleMusicGlobalPlaylistExtractionMethod;
    selectedTrackCount: number;
    jsonLdTrackCount: number;
    serializedTrackCount: number;
    trackLockupTrackCount: number;
    songLinkTrackCount: number;
    sampleTracks: AppleMusicGlobalPlaylistTrackSummary[];
  };
  validation: {
    finalUrlLooksCorrect: boolean;
    canonicalLooksCorrect: boolean;
    playlistTitleLooksCorrect: boolean;
    playlistIdFound: boolean;
    selectedTrackCountIs100: boolean;
  };
}

export interface AppleMusicGlobalPlaylistFetchOptions {
  headless?: boolean;
  timeoutMs?: number;
  waitAfterLoadMs?: number;
  browserExecutablePath?: string;
}

export class AppleMusicGlobalPlaylistError extends Error {
  constructor(
    message: string,
    readonly diagnostics?: AppleMusicGlobalPlaylistDiagnostics,
  ) {
    super(message);
    this.name = 'AppleMusicGlobalPlaylistError';
  }
}

interface CollectPageResult {
  diagnostics: AppleMusicGlobalPlaylistDiagnostics;
  items: AppleMusicChartItem[];
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function getFiniteNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function toIsoTimestamp(value: Date | number | string) {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.valueOf())) {
    throw new Error(`Invalid timestamp: ${String(value)}`);
  }

  return parsed.toISOString();
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function toTrackSummary(items: AppleMusicChartItem[]) {
  return items.slice(0, 10).map((item) => ({
    rank: item.rank,
    title: item.trackName,
    artistNames: item.artistNames
      .split(/\s*,\s*/)
      .map((value) => value.trim())
      .filter(Boolean),
    songId: item.appleSongId,
    url: item.appleSongUrl,
  }));
}

function parseDurationTextToMs(value: string | null) {
  if (!value) return null;
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return null;
  return (minutes * 60 + seconds) * 1000;
}

function parseDurationMs(value: unknown): number | null {
  const directNumber = getFiniteNumber(value);
  if (directNumber && directNumber > 0) {
    return Math.floor(directNumber);
  }

  const stringValue = getString(value);
  if (!stringValue) return null;

  const parsedTextDuration = parseDurationTextToMs(stringValue);
  if (parsedTextDuration) {
    return parsedTextDuration;
  }

  const numeric = Number(stringValue);
  return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : null;
}

function normalizeAbsoluteUrl(value: string | null | undefined) {
  const normalizedValue = getString(value);
  if (!normalizedValue) return null;

  try {
    return new URL(normalizedValue, 'https://music.apple.com').toString();
  } catch {
    return null;
  }
}

function parseAppleSongIdFromUrl(value: string | null | undefined) {
  const normalizedUrl = normalizeAbsoluteUrl(value);
  if (!normalizedUrl) return null;

  try {
    const url = new URL(normalizedUrl);
    const querySongId = url.searchParams.get('i');
    if (querySongId && /^\d+$/.test(querySongId)) {
      return querySongId;
    }

    const pathMatch = url.pathname.match(/\/(\d+)(?:\/?$)/);
    if (pathMatch?.[1]) {
      return pathMatch[1];
    }
  } catch {
    return null;
  }

  return null;
}

function resolveBrowserExecutablePath(explicitPath?: string | null) {
  if (explicitPath && existsSync(explicitPath)) {
    return explicitPath;
  }

  const candidates =
    process.platform === 'win32'
      ? DEFAULT_WINDOWS_BROWSER_EXECUTABLE_PATHS
      : process.platform === 'darwin'
        ? DEFAULT_DARWIN_BROWSER_EXECUTABLE_PATHS
        : DEFAULT_LINUX_BROWSER_EXECUTABLE_PATHS;

  return candidates.find((candidate) => existsSync(candidate));
}

function getLaunchOptions(options: AppleMusicGlobalPlaylistFetchOptions): LaunchOptions {
  const executablePath = resolveBrowserExecutablePath(options.browserExecutablePath);
  const launchOptions: LaunchOptions = {
    headless: options.headless ?? true,
    args: ['--disable-blink-features=AutomationControlled'],
  };

  if (executablePath) {
    launchOptions.executablePath = executablePath;
  }

  return launchOptions;
}

function getObjectEntries(value: unknown): Array<[string, unknown]> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  return Object.entries(value as Record<string, unknown>);
}

function readContentDescriptor(value: unknown) {
  if (!value || typeof value !== 'object') return null;
  const record = value as {
    kind?: unknown;
    url?: unknown;
    identifiers?: { storeAdamID?: unknown };
  };

  return {
    kind: getString(record.kind),
    url: normalizeAbsoluteUrl(getString(record.url)),
    id: getString(record.identifiers?.storeAdamID),
  };
}

function readRecordTitle(record: Record<string, unknown>) {
  return (
    getString(record.title) ||
    getString(record.name) ||
    getString((record.heading as { title?: unknown } | undefined)?.title) ||
    getString((record.primaryText as { text?: unknown } | undefined)?.text) ||
    getString(
      (record.titleLinks as Array<{ title?: unknown }> | undefined)?.find((item) => getString(item.title))?.title,
    ) ||
    getString(record.accessibilityLabel)
  );
}

function readRecordArtistNames(record: Record<string, unknown>) {
  return uniqueStrings([
    ...((record.subtitleLinks as Array<{ title?: unknown }> | undefined) ?? []).map((item) => getString(item.title)),
    ...((record.artists as Array<{ name?: unknown; title?: unknown }> | undefined) ?? []).map(
      (item) => getString(item.name) || getString(item.title),
    ),
    getString(record.artistName),
    getString(record.artist),
  ]);
}

function readArtworkUrl(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;

  return (
    normalizeAppleMusicArtworkUrl(getString(record.url)) ||
    normalizeAppleMusicArtworkUrl(getString((record.artwork as { url?: unknown } | undefined)?.url)) ||
    normalizeAppleMusicArtworkUrl(
      getString((record.artwork as { dictionary?: { url?: unknown } } | undefined)?.dictionary?.url),
    ) ||
    normalizeAppleMusicArtworkUrl(getString((record.image as { url?: unknown } | undefined)?.url)) ||
    normalizeAppleMusicArtworkUrl(getString((record.image as { src?: unknown } | undefined)?.src)) ||
    null
  );
}

function readRank(value: unknown) {
  const direct = getFiniteNumber(value);
  if (direct && direct > 0) return Math.floor(direct);

  const stringValue = getString(value);
  if (!stringValue) return null;
  const parsed = Number(stringValue);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
}

function buildChartItems(candidates: ChartItemCandidate[]) {
  const normalized = candidates
    .map((candidate) => {
      const trackName = getString(candidate.trackName);
      const artistNames = uniqueStrings(candidate.artistNames.map((value) => getString(value)));
      const appleSongUrl = normalizeAbsoluteUrl(candidate.appleSongUrl);
      const appleSongId = getString(candidate.appleSongId) || parseAppleSongIdFromUrl(appleSongUrl);

      if (!trackName || artistNames.length === 0 || !appleSongId || !appleSongUrl) {
        return null;
      }

      return {
        order: candidate.order,
        rank: candidate.rank,
        item: {
          rank: 0,
          trackName,
          artistNames: artistNames.join(', '),
          appleSongId,
          appleSongUrl,
          durationMs: candidate.durationMs,
          thumbnailUrl: normalizeAppleMusicArtworkUrl(candidate.thumbnailUrl),
          rawItem: candidate.rawItem,
        } satisfies AppleMusicChartItem,
      };
    })
    .filter((entry): entry is { order: number; rank: number | null; item: AppleMusicChartItem } => entry !== null)
    .sort((left, right) => {
      const leftRank = left.rank ?? Number.MAX_SAFE_INTEGER;
      const rightRank = right.rank ?? Number.MAX_SAFE_INTEGER;
      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }

      return left.order - right.order;
    });

  const seen = new Set<string>();
  const items: AppleMusicChartItem[] = [];
  for (const entry of normalized) {
    const dedupeKey = `${entry.item.appleSongId}|${entry.item.appleSongUrl}`;
    if (seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);
    items.push({
      ...entry.item,
      rank: items.length + 1,
    });
  }

  return items;
}

function findSerializedPlaylistMatches(root: unknown) {
  const queue: Array<{ value: unknown; path: string }> = [{ value: root, path: '$' }];
  const seen = new Set<unknown>();
  const matches: PlaylistMatch[] = [];

  while (queue.length) {
    const current = queue.shift();
    if (!current) continue;
    const { value, path } = current;
    if (!value || typeof value !== 'object') continue;
    if (seen.has(value)) continue;
    seen.add(value);

    const record = value as Record<string, unknown>;
    const directDescriptor = readContentDescriptor(record.contentDescriptor);
    const destinationDescriptor = readContentDescriptor(
      (record.segue as { destination?: { contentDescriptor?: unknown } } | undefined)?.destination?.contentDescriptor,
    );
    const descriptor = directDescriptor ?? destinationDescriptor;

    if (descriptor?.kind === 'playlist') {
      matches.push({
        path,
        id: descriptor.id,
        title: readRecordTitle(record),
        url: descriptor.url,
      });
    }

    if (Array.isArray(value)) {
      value.forEach((item, index) => queue.push({ value: item, path: `${path}[${index}]` }));
      continue;
    }

    for (const [key, child] of getObjectEntries(value)) {
      queue.push({ value: child, path: `${path}.${key}` });
    }
  }

  return matches;
}

function extractSerializedTracks(root: unknown) {
  const queue: Array<{ value: unknown; path: string }> = [{ value: root, path: '$' }];
  const seen = new Set<unknown>();
  const candidates: ChartItemCandidate[] = [];

  while (queue.length) {
    const current = queue.shift();
    if (!current) continue;
    const { value, path } = current;
    if (!value || typeof value !== 'object') continue;
    if (seen.has(value)) continue;
    seen.add(value);

    const record = value as Record<string, unknown>;
    const directDescriptor = readContentDescriptor(record.contentDescriptor);
    const destinationDescriptor = readContentDescriptor(
      (record.segue as { destination?: { contentDescriptor?: unknown } } | undefined)?.destination?.contentDescriptor,
    );
    const descriptor = directDescriptor ?? destinationDescriptor;

    if (descriptor?.kind === 'song') {
      candidates.push({
        source: 'serialized-data',
        order: candidates.length,
        rank: readRank(record.rank) ?? readRank(record.position) ?? readRank(record.index),
        trackName: readRecordTitle(record),
        artistNames: readRecordArtistNames(record),
        appleSongId: descriptor.id,
        appleSongUrl: descriptor.url || getString(record.url),
        durationMs:
          parseDurationMs(record.durationInMillis) ||
          parseDurationMs(record.durationMs) ||
          parseDurationMs(record.duration),
        thumbnailUrl: readArtworkUrl(record),
        rawItem: {
          path,
          source: 'serialized-data',
          contentDescriptor: descriptor,
          title: readRecordTitle(record),
          artistNames: readRecordArtistNames(record),
        },
      });
    }

    if (Array.isArray(value)) {
      value.forEach((item, index) => queue.push({ value: item, path: `${path}[${index}]` }));
      continue;
    }

    for (const [key, child] of getObjectEntries(value)) {
      queue.push({ value: child, path: `${path}.${key}` });
    }
  }

  return buildChartItems(candidates);
}

function collectJsonLdTracks(value: unknown) {
  const queue: unknown[] = [value];
  const candidates: ChartItemCandidate[] = [];

  while (queue.length) {
    const current = queue.shift();
    if (!current || typeof current !== 'object') continue;

    if (Array.isArray(current)) {
      queue.push(...current);
      continue;
    }

    const record = current as Record<string, unknown>;
    const types = Array.isArray(record['@type']) ? record['@type'].map((item) => String(item)) : [String(record['@type'] ?? '')];
    const hasPlaylistType = types.some((type) => type === 'MusicPlaylist' || type === 'ItemList');

    if (hasPlaylistType) {
      const trackEntries = Array.isArray(record.track)
        ? record.track
        : Array.isArray(record.itemListElement)
          ? record.itemListElement
          : [];

      trackEntries.forEach((entry, index) => {
        const listItem = entry && typeof entry === 'object' ? (entry as Record<string, unknown>) : null;
        const item = (listItem?.item as Record<string, unknown> | undefined) ?? listItem;
        if (!item || typeof item !== 'object') {
          return;
        }

        const byArtist = Array.isArray(item.byArtist)
          ? item.byArtist
          : item.byArtist
            ? [item.byArtist]
            : [];
        const artistNames = uniqueStrings(
          byArtist.map((artist) => {
            if (!artist || typeof artist !== 'object') return null;
            return getString((artist as { name?: unknown }).name);
          }),
        );

        candidates.push({
          source: 'json-ld',
          order: candidates.length,
          rank: readRank(listItem?.position) ?? index + 1,
          trackName: getString(item.name),
          artistNames,
          appleSongId: getString(item.identifier) || parseAppleSongIdFromUrl(getString(item.url)),
          appleSongUrl: getString(item.url),
          durationMs: parseDurationMs(item.duration),
          thumbnailUrl: readArtworkUrl(item),
          rawItem: {
            source: 'json-ld',
            position: listItem?.position ?? null,
            item,
          },
        });
      });
    }

    for (const child of Object.values(record)) {
      queue.push(child);
    }
  }

  return buildChartItems(candidates);
}

async function extractDomTracks(page: Page, selector: 'track-lockup' | 'song-links') {
  const domExtractionScript = `
    const requestedSelector = arguments[0];
    const cleanText = (value) => typeof value === 'string' ? value.replace(/\\s+/g, ' ').trim() : '';
    const parseDurationMsFromText = (value) => {
      const match = cleanText(value).match(/\\b(\\d{1,2}):(\\d{2})\\b/);
      if (!match) return null;
      return (Number(match[1]) * 60 + Number(match[2])) * 1000;
    };
    const normalizeUrl = (value) => {
      const text = cleanText(value);
      if (!text) return null;
      try {
        return new URL(text, window.location.origin).toString();
      } catch {
        return null;
      }
    };
    const parseSongId = (url) => {
      if (!url) return null;
      try {
        const parsed = new URL(url);
        const querySongId = parsed.searchParams.get('i');
        if (querySongId && /^\\d+$/.test(querySongId)) {
          return querySongId;
        }
        const pathMatch = parsed.pathname.match(/\\/(\\d+)(?:\\/?$)/);
        return pathMatch?.[1] ?? null;
      } catch {
        return null;
      }
    };
    const unique = (values) => Array.from(new Set(values.filter(Boolean)));
    const pickSongAnchor = (scope) => scope.querySelector('a[href*="/song/"], a[href*="/album/"][href*="?i="]');
    const extractCandidate = (node, index) => {
      const row = node;
      const songAnchor = pickSongAnchor(row);
      const artistAnchors = Array.from(row.querySelectorAll('a[href*="/artist/"]'));
      const img = row.querySelector('img');
      const lines = row.innerText.split('\\n').map((line) => cleanText(line)).filter(Boolean);
      const rankLine = lines.find((line) => /^\\d{1,3}$/.test(line)) ?? '';
      const rank = Number(rankLine);
      const title = cleanText(songAnchor?.textContent) || cleanText(lines[0]) || null;
      const artistNames = unique(artistAnchors.map((anchor) => cleanText(anchor.textContent)));
      const appleSongUrl = normalizeUrl(songAnchor?.getAttribute('href') ?? songAnchor?.href);
      const durationMs = parseDurationMsFromText(lines.join(' '));
      return {
        source: requestedSelector === 'track-lockup' ? 'track-lockup' : 'song-links',
        order: index,
        rank: Number.isFinite(rank) && rank > 0 ? rank : index + 1,
        trackName: title,
        artistNames,
        appleSongId: parseSongId(appleSongUrl),
        appleSongUrl,
        durationMs,
        thumbnailUrl: normalizeUrl(img?.getAttribute('src') ?? img?.src),
        rawItem: {
          source: requestedSelector,
          rowText: cleanText(row.innerText),
        },
      };
    };
    const countRankLines = (element) => {
      const lines = element.innerText.split('\\n').map((line) => cleanText(line)).filter(Boolean);
      return lines.filter((line) => /^\\d{1,3}$/.test(line) && Number(line) >= 1 && Number(line) <= 100).length;
    };
    const findRowContainerForRank = (element) => {
      let current = element.parentElement;
      while (current && current !== document.body) {
        const rankLineCount = countRankLines(current);
        if (rankLineCount === 1) {
          const lines = current.innerText.split('\\n').map((line) => cleanText(line)).filter(Boolean);
          if (lines.length >= 5) {
            return current;
          }
        }
        current = current.parentElement;
      }
      return element.parentElement ?? element;
    };
    const extractByRankRows = () => {
      const rankElements = Array.from(document.querySelectorAll('*')).filter((node) => {
        if (!(node instanceof HTMLElement)) return false;
        if (node.children.length > 0) return false;
        const text = cleanText(node.innerText);
        if (!/^\\d{1,3}$/.test(text)) return false;
        const rank = Number(text);
        return Number.isFinite(rank) && rank >= 1 && rank <= 100;
      });
      const rowsByRank = new Map();
      rankElements.forEach((rankElement) => {
        const rank = Number(cleanText(rankElement.innerText));
        if (rowsByRank.has(rank)) {
          return;
        }
        const row = findRowContainerForRank(rankElement);
        const candidate = extractCandidate(row, rank - 1);
        const lines = row.innerText.split('\\n').map((line) => cleanText(line)).filter(Boolean);
        const rankIndex = lines.findIndex((line) => line === String(rank));
        if (rankIndex > 0) {
          candidate.trackName = lines[rankIndex - 1] || candidate.trackName;
        }
        if (!candidate.artistNames.length && rankIndex >= 0 && lines[rankIndex + 1]) {
          candidate.artistNames = unique(lines[rankIndex + 1].split(',').map((part) => cleanText(part)));
        }
        candidate.rank = rank;
        rowsByRank.set(rank, candidate);
      });
      return Array.from(rowsByRank.entries())
        .sort((left, right) => left[0] - right[0])
        .map((entry) => entry[1]);
    };
    const rankRowCandidates = extractByRankRows();
    if (rankRowCandidates.length >= 90) {
      return rankRowCandidates;
    }
    if (requestedSelector === 'track-lockup') {
      return Array.from(document.querySelectorAll('[data-testid="track-lockup"]')).map((node, index) => extractCandidate(node, index));
    }
    const seenUrls = new Set();
    const candidates = [];
    Array.from(document.querySelectorAll('main a[href*="/song/"], main a[href*="/album/"][href*="?i="]')).forEach((anchor, index) => {
      const normalizedUrl = normalizeUrl(anchor.getAttribute('href') ?? anchor.href);
      if (!normalizedUrl || seenUrls.has(normalizedUrl)) {
        return;
      }
      seenUrls.add(normalizedUrl);
      const row =
        anchor.closest('[data-testid="track-lockup"]') ||
        anchor.closest('li') ||
        anchor.closest('article') ||
        anchor.closest('div') ||
        anchor;
      candidates.push(extractCandidate(row, index));
    });
    return candidates;
  `;

  const result = await page.evaluate(
    ({ requestedSelector, script }) => new Function(script)(requestedSelector),
    { requestedSelector: selector, script: domExtractionScript },
  );

  return buildChartItems(result);
}

function selectBestExtraction(attempts: ExtractionAttempt[]) {
  const exactMatch = attempts.find((attempt) => attempt.items.length === 100);
  if (exactMatch) {
    return exactMatch;
  }

  const fallback = [...attempts].sort((left, right) => right.items.length - left.items.length)[0];
  return fallback ?? { method: 'none', items: [] };
}

function buildValidationErrors(diagnostics: AppleMusicGlobalPlaylistDiagnostics) {
  const errors: string[] = [];
  if (!diagnostics.validation.finalUrlLooksCorrect) {
    errors.push(`finalUrl=${diagnostics.finalUrl}`);
  }
  if (!diagnostics.validation.canonicalLooksCorrect) {
    errors.push(`canonicalUrl=${diagnostics.canonicalUrl ?? 'n/a'}`);
  }
  if (!diagnostics.validation.playlistTitleLooksCorrect) {
    errors.push(
      `playlistTitle=document:${diagnostics.documentTitle} apple:${diagnostics.appleTitleMeta ?? 'n/a'} seo:${diagnostics.seoPageTitle ?? 'n/a'}`,
    );
  }
  if (!diagnostics.validation.playlistIdFound) {
    errors.push('playlistId not found in page payload or URL metadata');
  }
  if (!diagnostics.validation.selectedTrackCountIs100) {
    errors.push(
      `selectedMethod=${diagnostics.extraction.selectedMethod} selectedTrackCount=${diagnostics.extraction.selectedTrackCount}`,
    );
  }

  return errors;
}

async function withGlobalPlaylistPage<T>(options: AppleMusicGlobalPlaylistFetchOptions, handler: (page: Page) => Promise<T>) {
  let browser;
  let context;

  try {
    browser = await chromium.launch(getLaunchOptions(options));
    context = await browser.newContext({
      viewport: { width: 1440, height: 1200 },
      locale: 'en-US',
      timezoneId: 'America/New_York',
      userAgent: DEFAULT_USER_AGENT,
      extraHTTPHeaders: {
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
  } catch (error) {
    throw new AppleMusicGlobalPlaylistError(
      `Failed to bootstrap browser for Apple Music global playlist: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const page = await context.newPage();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  page.setDefaultTimeout(timeoutMs);

  try {
    await page.goto(APPLE_MUSIC_GLOBAL_PLAYLIST_URL, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    await page.waitForLoadState('networkidle', { timeout: timeoutMs }).catch(() => undefined);
    await page.waitForSelector('link[rel="canonical"]', { state: 'attached', timeout: timeoutMs }).catch(() => undefined);
    await page.waitForSelector('body', { state: 'attached', timeout: timeoutMs });

    const waitAfterLoadMs = options.waitAfterLoadMs ?? DEFAULT_WAIT_AFTER_LOAD_MS;
    if (waitAfterLoadMs > 0) {
      await sleep(waitAfterLoadMs);
    }

    return await handler(page);
  } catch (error) {
    throw new AppleMusicGlobalPlaylistError(
      `Failed to open Apple Music global playlist page: ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

async function collectPageResult(page: Page): Promise<CollectPageResult> {
  const serializedDataScriptCount = await page.locator('script#serialized-server-data').count();
  const serializedDataText =
    serializedDataScriptCount > 0 ? await page.locator('script#serialized-server-data').first().textContent() : null;
  const serializedData = serializedDataText ? (JSON.parse(serializedDataText) as SerializedServerDataPayload) : null;
  const jsonLdTexts = await page.locator('script[type="application/ld+json"]').allTextContents();
  const jsonLdPayloads = jsonLdTexts
    .map((text) => {
      try {
        return JSON.parse(text) as unknown;
      } catch {
        return null;
      }
    })
    .filter((value): value is unknown => value !== null);
  const jsonLdItems = jsonLdPayloads.flatMap((payload) => collectJsonLdTracks(payload));
  const serializedItems = extractSerializedTracks(serializedData);
  const trackLockupItems = await extractDomTracks(page, 'track-lockup');
  const songLinkItems = await extractDomTracks(page, 'song-links');
  const finalUrl = page.url();
  const documentTitle = await page.title();
  const documentLang = (await page.locator('html').getAttribute('lang')) ?? '';
  const canonicalUrl = await page.locator('link[rel="canonical"]').getAttribute('href');
  const appleTitleMeta = await page.locator('meta[name="apple:title"]').getAttribute('content');
  const bodyTextSample = await page.locator('body').innerText().catch(() => '');
  const playlistMatches = findSerializedPlaylistMatches(serializedData);
  const root = serializedData?.data?.[0];
  const trackLockupCount = await page.locator('[data-testid="track-lockup"]').count();
  const songLinkCount = await page.locator('main a[href*="/song/"], main a[href*="/album/"][href*="?i="]').count();
  const selection = selectBestExtraction([
    { method: 'json-ld', items: jsonLdItems },
    { method: 'track-lockup', items: trackLockupItems },
    { method: 'serialized-data', items: serializedItems },
    { method: 'song-links', items: songLinkItems },
  ]);
  const selectedMethod = selection.method === 'none' ? 'none' : selection.method;
  const selectedItems = selection.method === 'none' ? [] : selection.items;
  const playlistIdFoundAnywhere =
    finalUrl.includes(APPLE_MUSIC_GLOBAL_PLAYLIST_ID) ||
    (canonicalUrl ?? '').includes(APPLE_MUSIC_GLOBAL_PLAYLIST_ID) ||
    playlistMatches.some((item) => item.id === APPLE_MUSIC_GLOBAL_PLAYLIST_ID);
  const playlistTitleLooksCorrect =
    appleTitleMeta === APPLE_MUSIC_GLOBAL_PLAYLIST_TITLE ||
    documentTitle.includes(APPLE_MUSIC_GLOBAL_PLAYLIST_TITLE) ||
    (root?.data?.seoData?.pageTitle ?? '').includes(APPLE_MUSIC_GLOBAL_PLAYLIST_TITLE);
  const diagnostics: AppleMusicGlobalPlaylistDiagnostics = {
    targetUrl: APPLE_MUSIC_GLOBAL_PLAYLIST_URL,
    targetPlaylistId: APPLE_MUSIC_GLOBAL_PLAYLIST_ID,
    extractedAt: toIsoTimestamp(Date.now()),
    finalUrl,
    documentTitle,
    documentLang,
    canonicalUrl,
    appleTitleMeta,
    serializedDataScriptCount,
    jsonLdScriptCount: jsonLdTexts.length,
    serializedDataPresent: Boolean(serializedData),
    rootIntentKind: getString(root?.intent?.$kind),
    seoPageTitle: getString(root?.data?.seoData?.pageTitle),
    bodyTextSample: bodyTextSample.slice(0, 1500),
    playlistIdFoundAnywhere,
    playlistTitleFoundAnywhere: playlistTitleLooksCorrect,
    playlistMatches: playlistMatches.slice(0, 20),
    trackLockupCount,
    songLinkCount,
    extraction: {
      selectedMethod,
      selectedTrackCount: selectedItems.length,
      jsonLdTrackCount: jsonLdItems.length,
      serializedTrackCount: serializedItems.length,
      trackLockupTrackCount: trackLockupItems.length,
      songLinkTrackCount: songLinkItems.length,
      sampleTracks: toTrackSummary(selectedItems),
    },
    validation: {
      finalUrlLooksCorrect: finalUrl.includes(`/playlist/${APPLE_MUSIC_GLOBAL_PLAYLIST_SLUG}/${APPLE_MUSIC_GLOBAL_PLAYLIST_ID}`),
      canonicalLooksCorrect: (canonicalUrl ?? '').includes(
        `/playlist/${APPLE_MUSIC_GLOBAL_PLAYLIST_SLUG}/${APPLE_MUSIC_GLOBAL_PLAYLIST_ID}`,
      ),
      playlistTitleLooksCorrect,
      playlistIdFound: playlistIdFoundAnywhere,
      selectedTrackCountIs100: selectedItems.length === 100,
    },
  };

  return {
    diagnostics,
    items: selectedItems.slice(0, 100),
  };
}

export async function collectAppleMusicGlobalPlaylistDiagnostics(options: AppleMusicGlobalPlaylistFetchOptions = {}) {
  const { diagnostics } = await withGlobalPlaylistPage(options, collectPageResult);
  return diagnostics;
}

export async function fetchAppleMusicGlobalPlaylistSnapshot(options: AppleMusicGlobalPlaylistFetchOptions = {}) {
  let collected: CollectPageResult;

  try {
    collected = await withGlobalPlaylistPage(options, collectPageResult);
  } catch (error) {
    if (error instanceof AppleMusicGlobalPlaylistError) {
      throw error;
    }

    throw new AppleMusicGlobalPlaylistError(error instanceof Error ? error.message : String(error));
  }

  const validationErrors = buildValidationErrors(collected.diagnostics);
  if (validationErrors.length > 0) {
    throw new AppleMusicGlobalPlaylistError(
      `Apple Music global playlist validation failed: ${validationErrors.join('; ')}`,
      collected.diagnostics,
    );
  }

  const fetchedAt = toIsoTimestamp(Date.now());
  const snapshot: AppleMusicTopSongsSnapshot = {
    chartType: APPLE_MUSIC_TOP_SONGS_CHART_TYPE,
    periodType: APPLE_MUSIC_DAILY_PERIOD_TYPE,
    countryCode: APPLE_MUSIC_GLOBAL_COUNTRY_CODE,
    countryName: APPLE_MUSIC_GLOBAL_COUNTRY_NAME,
    chartEndDate: fetchedAt.slice(0, 10),
    fetchedAt,
    sourceUrl: APPLE_MUSIC_GLOBAL_PLAYLIST_URL,
    playlistId: APPLE_MUSIC_GLOBAL_PLAYLIST_ID,
    playlistSlug: APPLE_MUSIC_GLOBAL_PLAYLIST_SLUG,
    playlistTitle: APPLE_MUSIC_GLOBAL_PLAYLIST_TITLE,
    items: collected.items,
    rawPayload: {
      sourceType: APPLE_MUSIC_GLOBAL_PLAYLIST_SOURCE_TYPE,
      targetUrl: APPLE_MUSIC_GLOBAL_PLAYLIST_URL,
      finalUrl: collected.diagnostics.finalUrl,
      canonicalUrl: collected.diagnostics.canonicalUrl,
      documentTitle: collected.diagnostics.documentTitle,
      appleTitleMeta: collected.diagnostics.appleTitleMeta,
      documentLang: collected.diagnostics.documentLang,
      extraction: collected.diagnostics.extraction,
      validation: collected.diagnostics.validation,
      fetchedAt,
      dateSource: 'fetch_time',
    },
  };

  return {
    snapshot,
    diagnostics: collected.diagnostics,
  };
}
