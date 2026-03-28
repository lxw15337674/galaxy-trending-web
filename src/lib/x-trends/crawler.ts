import { chromium, type Page, type Response } from 'playwright-core';
import { resolveXTrendStorageState } from './cookie-provider';
import { XTrendRegionResult, XTrendTarget, type XTrendExtractionSource, type XTrendItem } from './types';

const DEFAULT_TIMEOUT_MS = 45_000;
const DEFAULT_WAIT_AFTER_LOAD_MS = 5_000;
const DEFAULT_BROWSER_EXECUTABLE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const DEFAULT_LOCALE = 'zh-CN';

interface ExtractedResult {
  pageUrl: string;
  source: XTrendExtractionSource;
  trendCount: number;
  trends: XTrendItem[];
  rawPayload: unknown;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeNumber(rawValue: string | null | undefined) {
  if (!rawValue) return null;

  const cleaned = rawValue.replace(/,/g, '').trim().toUpperCase();
  const match = cleaned.match(/^([\d.]+)([KMB])?$/);
  if (!match) return null;

  const base = Number(match[1]);
  if (!Number.isFinite(base)) return null;

  switch (match[2]) {
    case 'K':
      return Math.round(base * 1_000);
    case 'M':
      return Math.round(base * 1_000_000);
    case 'B':
      return Math.round(base * 1_000_000_000);
    default:
      return Math.round(base);
  }
}

function getObjectEntries(value: unknown): [string, unknown][] {
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value as Record<string, unknown>);
}

function findValueDeep<T>(value: unknown, predicate: (candidate: unknown) => candidate is T): T | null {
  const queue: unknown[] = [value];
  const seen = new Set<unknown>();

  while (queue.length) {
    const current = queue.shift();
    if (!current || typeof current !== 'object') continue;
    if (seen.has(current)) continue;
    seen.add(current);

    if (predicate(current)) return current;

    if (Array.isArray(current)) {
      queue.push(...current);
      continue;
    }

    queue.push(...Object.values(current as Record<string, unknown>));
  }

  return null;
}

function getString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function getTrendName(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;

  return (
    getString(record.name) ||
    getString(record.trend_name) ||
    getString(record.title) ||
    getString(record.displayName) ||
    null
  );
}

function getTrendQuery(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;

  return getString(record.query) || getString(record.searchQuery) || null;
}

function getTrendUrl(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;

  return getString(record.url) || getString(record.searchUrl) || getString(record.targetUrl) || null;
}

function getTrendMeta(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;

  return (
    getString(record.metaDescription) ||
    getString(record.description) ||
    getString(record.context) ||
    getString(record.localizedContext) ||
    null
  );
}

function getTweetVolume(raw: unknown): number | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  const direct = record.tweetVolume ?? record.tweet_volume ?? record.formattedTweetCount ?? record.formatted_count;

  if (typeof direct === 'number' && Number.isFinite(direct)) {
    return Math.round(direct);
  }

  if (typeof direct === 'string') {
    return normalizeNumber(direct);
  }

  const deepFormatted = findValueDeep(raw, (candidate): candidate is { text?: unknown } => {
    if (!candidate || typeof candidate !== 'object') return false;
    const text = (candidate as { text?: unknown }).text;
    return typeof text === 'string' && /[\d,.]+\s*[KMB]?/i.test(text);
  });

  return normalizeNumber(getString(deepFormatted?.text));
}

function normalizeTrendKey(queryText: string | null, trendName: string) {
  const source = (queryText || trendName).trim().toLowerCase();
  return source.replace(/\s+/g, ' ');
}

function isLikelyTrendObject(candidate: unknown): candidate is Record<string, unknown> {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return false;
  const record = candidate as Record<string, unknown>;
  const name = getTrendName(record);
  const query = getTrendQuery(record);
  const url = getTrendUrl(record);

  if (!name) return false;
  if (query || url) return true;

  return getObjectEntries(record).some(([key]) => key.toLowerCase().includes('trend'));
}

function collectTrendObjects(root: unknown) {
  const queue: unknown[] = [root];
  const seenObjects = new Set<unknown>();
  const uniqueTrends = new Map<string, Record<string, unknown>>();

  while (queue.length) {
    const current = queue.shift();
    if (!current || typeof current !== 'object') continue;
    if (seenObjects.has(current)) continue;
    seenObjects.add(current);

    if (isLikelyTrendObject(current)) {
      const name = getTrendName(current);
      const query = getTrendQuery(current);
      if (name) {
        uniqueTrends.set(`${name}::${query ?? ''}`, current);
      }
    }

    if (Array.isArray(current)) {
      queue.push(...current);
      continue;
    }

    queue.push(...Object.values(current as Record<string, unknown>));
  }

  return Array.from(uniqueTrends.values());
}

function toTrendItems(rawItems: unknown[]): XTrendItem[] {
  const mapped: Array<XTrendItem | null> = rawItems.map((raw, index) => {
    const trendName = getTrendName(raw);
    if (!trendName) return null;
    const queryText = getTrendQuery(raw);

    return {
      rank: index + 1,
      trendName,
      normalizedKey: normalizeTrendKey(queryText, trendName),
      queryText,
      trendUrl: getTrendUrl(raw),
      metaText: getTrendMeta(raw),
      tweetVolume: getTweetVolume(raw),
      raw,
    } satisfies XTrendItem;
  });

  return mapped.filter((item): item is XTrendItem => item !== null);
}

async function extractFromTimelineResponse(response: Response): Promise<ExtractedResult | null> {
  const url = response.url();
  if (!url.includes('GenericTimelineById') && !url.includes('ExplorePage')) {
    return null;
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return null;
  }

  const instructions = findValueDeep(
    payload,
    (candidate): candidate is { entries?: unknown[]; addEntries?: unknown[] } =>
      !!candidate && typeof candidate === 'object' && ('entries' in (candidate as object) || 'addEntries' in (candidate as object)),
  );

  const searchRoot = instructions ?? payload;
  const trendObjects = collectTrendObjects(searchRoot);
  const trends = toTrendItems(trendObjects);
  if (!trends.length) return null;

  return {
    pageUrl: url,
    source: 'network',
    trendCount: trends.length,
    trends,
    rawPayload: payload,
  };
}

async function extractFromDom(page: Page): Promise<ExtractedResult | null> {
  const rawDomItems = await page.evaluate(() => {
    const candidates = Array.from(document.querySelectorAll('a[href*="/search?q="]'));
    const seen = new Set<string>();
    const items: Array<Record<string, unknown>> = [];

    for (const node of candidates) {
      const anchor = node as HTMLAnchorElement;
      const text = anchor.textContent?.trim();
      if (!text || seen.has(text)) continue;
      seen.add(text);

      const wrapper = anchor.closest('[role="link"]') || anchor;
      const blockText = wrapper.textContent?.replace(/\s+/g, ' ').trim() || text;

      items.push({
        name: text,
        url: anchor.href,
        metaDescription: blockText,
      });
    }

    return items;
  });

  const trends = toTrendItems(rawDomItems);
  if (!trends.length) return null;

  return {
    pageUrl: page.url(),
    source: 'dom',
    trendCount: trends.length,
    trends,
    rawPayload: rawDomItems,
  };
}

async function isLoggedIn(page: Page) {
  return page.evaluate(() => {
    const text = document.body.innerText || '';
    return !/登录|登入|sign in|log in|create account/i.test(text);
  });
}

function toErrorText(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export async function crawlXTrendTarget(params: {
  target: XTrendTarget;
  snapshotHour: string;
  headless?: boolean;
  timeoutMs?: number;
  waitAfterLoadMs?: number;
}): Promise<XTrendRegionResult> {
  const {
    target,
    snapshotHour,
    headless = true,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    waitAfterLoadMs = DEFAULT_WAIT_AFTER_LOAD_MS,
  } = params;

  let sourceUrl = target.targetUrl;
  let extractionSource: XTrendExtractionSource | null = null;
  let loggedIn = false;

  try {
    const storageState = await resolveXTrendStorageState(target);
    const browser = await chromium.launch({
      executablePath: target.browserExecutablePath?.trim() || DEFAULT_BROWSER_EXECUTABLE_PATH,
      headless,
      args: ['--disable-blink-features=AutomationControlled'],
    });

    try {
      const context = await browser.newContext({
        locale: target.locale?.trim() || DEFAULT_LOCALE,
        storageState,
        viewport: { width: 1440, height: 1600 },
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36 Edg/134.0.0.0',
      });

      try {
        const page = await context.newPage();
        const networkHits: ExtractedResult[] = [];
        page.on('response', async (response) => {
          try {
            const extracted = await extractFromTimelineResponse(response);
            if (extracted) {
              networkHits.push(extracted);
            }
          } catch {
            // Ignore individual response parsing failures and let the crawler fall back.
          }
        });

        await page.goto(target.targetUrl, {
          waitUntil: 'domcontentloaded',
          timeout: timeoutMs,
        });

        await page.waitForLoadState('networkidle', { timeout: timeoutMs }).catch(() => {});
        await sleep(waitAfterLoadMs);

        loggedIn = await isLoggedIn(page);
        const networkResult = networkHits.sort((left, right) => right.trendCount - left.trendCount)[0] ?? null;
        const domResult = await extractFromDom(page);
        const finalResult = networkResult ?? domResult;
        sourceUrl = finalResult?.pageUrl ?? page.url();
        extractionSource = finalResult?.source ?? null;

        if (!finalResult) {
          throw new Error(`No trend data extracted. loggedIn=${loggedIn} currentUrl=${page.url()}`);
        }

        return {
          status: 'success',
          snapshotHour,
          regionKey: target.regionKey,
          regionLabel: target.regionLabel,
          sourceUrl,
          extractionSource: finalResult.source,
          loggedIn,
          items: finalResult.trends,
          rawPayload: finalResult.rawPayload,
        };
      } finally {
        await context.close();
      }
    } finally {
      await browser.close();
    }
  } catch (error) {
    return {
      status: 'failed',
      snapshotHour,
      regionKey: target.regionKey,
      regionLabel: target.regionLabel,
      sourceUrl,
      extractionSource,
      loggedIn,
      error: toErrorText(error),
    };
  }
}

