import { existsSync } from 'node:fs';
import { chromium, type Browser, type BrowserContext, type LaunchOptions, type Page, type Response } from 'playwright-core';
import { resolveXTrendStorageState } from './cookie-provider';
import { XTrendRegionResult, XTrendTarget, type XTrendExtractionSource, type XTrendItem } from './types';

const DEFAULT_TIMEOUT_MS = 45_000;
const DEFAULT_WAIT_AFTER_LOAD_MS = 5_000;
const DEFAULT_WINDOWS_BROWSER_EXECUTABLE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const DEFAULT_LOCALE = 'en-US';
const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36 Edg/134.0.0.0';
const EXPLORE_SETTINGS_URL = 'https://x.com/settings/explore';
const EXPLORE_LOCATION_URL = 'https://x.com/settings/explore/location';
const DEFAULT_DARWIN_BROWSER_EXECUTABLE_PATHS = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
];
const DEFAULT_LINUX_BROWSER_EXECUTABLE_PATHS = [
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
];

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

function resolveBrowserExecutablePath(target: XTrendTarget) {
  const explicitPath = target.browserExecutablePath?.trim();
  if (explicitPath) {
    return explicitPath;
  }

  const candidatePaths =
    process.platform === 'win32'
      ? [DEFAULT_WINDOWS_BROWSER_EXECUTABLE_PATH]
      : process.platform === 'darwin'
        ? DEFAULT_DARWIN_BROWSER_EXECUTABLE_PATHS
        : DEFAULT_LINUX_BROWSER_EXECUTABLE_PATHS;

  return candidatePaths.find((candidatePath) => existsSync(candidatePath));
}

function getBrowserLaunchOptions(target: XTrendTarget, headless: boolean): LaunchOptions {
  const executablePath = resolveBrowserExecutablePath(target);
  const launchOptions: LaunchOptions = {
    headless,
    args: ['--disable-blink-features=AutomationControlled'],
  };

  if (executablePath) {
    launchOptions.executablePath = executablePath;
  }

  return launchOptions;
}

async function openBrowserSession(params: {
  target: XTrendTarget;
  headless: boolean;
}): Promise<{ browser: Browser; context: BrowserContext; page: Page }> {
  const storageState = await resolveXTrendStorageState(params.target);
  const browser = await chromium.launch(getBrowserLaunchOptions(params.target, params.headless));
  const context = await browser.newContext({
    locale: params.target.locale?.trim() || DEFAULT_LOCALE,
    storageState,
    viewport: { width: 1440, height: 1600 },
    userAgent: DEFAULT_USER_AGENT,
  });
  const page = await context.newPage();

  return { browser, context, page };
}

async function waitForPageSettled(page: Page, timeoutMs: number, waitAfterLoadMs: number) {
  await page.waitForLoadState('networkidle', { timeout: timeoutMs }).catch(() => {});
  await sleep(waitAfterLoadMs);
}

async function ensureManualLocationMode(page: Page, timeoutMs: number, waitAfterLoadMs: number) {
  await page.goto(EXPLORE_SETTINGS_URL, {
    waitUntil: 'domcontentloaded',
    timeout: timeoutMs,
  });
  await waitForPageSettled(page, timeoutMs, waitAfterLoadMs);

  const currentLocationToggle = page.locator('[data-testid="currentLocation"] input[type="checkbox"]').first();
  await currentLocationToggle.waitFor({ state: 'attached', timeout: timeoutMs });

  if (await currentLocationToggle.isChecked()) {
    await currentLocationToggle.click({ force: true, timeout: timeoutMs });
    await page.locator('[data-testid="exploreLocations"]').first().waitFor({ state: 'visible', timeout: timeoutMs });
    await sleep(waitAfterLoadMs);
    return;
  }

  const exploreLocationsLink = page.locator('[data-testid="exploreLocations"]').first();
  if (await exploreLocationsLink.count()) {
    await exploreLocationsLink.waitFor({ state: 'visible', timeout: timeoutMs });
  }
}

async function switchRegion(page: Page, target: XTrendTarget, timeoutMs: number, waitAfterLoadMs: number) {
  await page.goto(EXPLORE_LOCATION_URL, {
    waitUntil: 'domcontentloaded',
    timeout: timeoutMs,
  });
  await waitForPageSettled(page, timeoutMs, waitAfterLoadMs);

  const searchInput = page.locator('input').first();
  await searchInput.waitFor({ state: 'visible', timeout: timeoutMs });
  await searchInput.fill('');

  const autocompletePromise = page
    .waitForResponse(
      (response) =>
        response.url().includes('/explore_locations_with_auto_complete.json') &&
        response.request().method() === 'GET',
      { timeout: timeoutMs },
    )
    .catch(() => null);

  await searchInput.fill(target.locationSearchQuery);
  await autocompletePromise;
  await sleep(1_000);

  const exactButton = page.getByRole('button', { name: target.locationSelectText, exact: true }).first();
  const fuzzyButton = page.locator('button').filter({ hasText: target.locationSelectText }).first();
  const locationButton = (await exactButton.count()) > 0 ? exactButton : fuzzyButton;

  await locationButton.waitFor({ state: 'visible', timeout: timeoutMs });

  const setLocationPromise = page.waitForResponse(
    (response) =>
      response.url().includes('/set_explore_settings.json') && response.request().method() === 'POST',
    { timeout: timeoutMs },
  );

  await locationButton.click({ force: true, timeout: timeoutMs });
  const setLocationResponse = await setLocationPromise;
  if (!setLocationResponse.ok()) {
    throw new Error(
      `set_explore_settings request failed for region=${target.regionKey} status=${setLocationResponse.status()}`,
    );
  }

  await sleep(waitAfterLoadMs);
}

async function extractCurrentRegionTrends(params: {
  page: Page;
  target: XTrendTarget;
  snapshotHour: string;
  timeoutMs: number;
  waitAfterLoadMs: number;
  networkHits: ExtractedResult[];
}): Promise<XTrendRegionResult> {
  const { page, target, snapshotHour, timeoutMs, waitAfterLoadMs, networkHits } = params;

  let sourceUrl = target.targetUrl;
  let extractionSource: XTrendExtractionSource | null = null;
  let loggedIn = false;

  try {
    networkHits.length = 0;
    await page.goto(target.targetUrl, {
      waitUntil: 'domcontentloaded',
      timeout: timeoutMs,
    });
    await waitForPageSettled(page, timeoutMs, waitAfterLoadMs);

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

export async function crawlXTrendTargets(params: {
  targets: XTrendTarget[];
  snapshotHour: string;
  headless?: boolean;
  timeoutMs?: number;
  waitAfterLoadMs?: number;
}): Promise<XTrendRegionResult[]> {
  const {
    targets,
    snapshotHour,
    headless = true,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    waitAfterLoadMs = DEFAULT_WAIT_AFTER_LOAD_MS,
  } = params;

  if (!targets.length) {
    return [];
  }

  let browser: Browser | null = null;
  let context: BrowserContext | null = null;

  try {
    const session = await openBrowserSession({ target: targets[0], headless });
    browser = session.browser;
    context = session.context;
    const page = session.page;
    const networkHits: ExtractedResult[] = [];
    let collectNetworkHits = false;

    page.on('response', async (response) => {
      if (!collectNetworkHits) return;

      try {
        const extracted = await extractFromTimelineResponse(response);
        if (extracted) {
          networkHits.push(extracted);
        }
      } catch {
        // Ignore individual response parsing failures and let the crawler fall back.
      }
    });

    await ensureManualLocationMode(page, timeoutMs, waitAfterLoadMs);
    const results: XTrendRegionResult[] = [];

    for (const target of targets) {
      try {
        await switchRegion(page, target, timeoutMs, waitAfterLoadMs);
        collectNetworkHits = true;
        const result = await extractCurrentRegionTrends({
          page,
          target,
          snapshotHour,
          timeoutMs,
          waitAfterLoadMs,
          networkHits,
        });
        results.push(result);
      } catch (error) {
        results.push({
          status: 'failed',
          snapshotHour,
          regionKey: target.regionKey,
          regionLabel: target.regionLabel,
          sourceUrl: page.url(),
          extractionSource: null,
          loggedIn: await isLoggedIn(page).catch(() => false),
          error: toErrorText(error),
        });
      } finally {
        collectNetworkHits = false;
        networkHits.length = 0;
      }
    }

    return results;
  } catch (error) {
    return targets.map((target) => ({
      status: 'failed',
      snapshotHour,
      regionKey: target.regionKey,
      regionLabel: target.regionLabel,
      sourceUrl: target.targetUrl,
      extractionSource: null,
      loggedIn: false,
      error: toErrorText(error),
    }));
  } finally {
    await context?.close();
    await browser?.close();
  }
}

export async function crawlXTrendTarget(params: {
  target: XTrendTarget;
  snapshotHour: string;
  headless?: boolean;
  timeoutMs?: number;
  waitAfterLoadMs?: number;
}): Promise<XTrendRegionResult> {
  const results = await crawlXTrendTargets({
    targets: [params.target],
    snapshotHour: params.snapshotHour,
    headless: params.headless,
    timeoutMs: params.timeoutMs,
    waitAfterLoadMs: params.waitAfterLoadMs,
  });

  return (
    results[0] ?? {
      status: 'failed',
      snapshotHour: params.snapshotHour,
      regionKey: params.target.regionKey,
      regionLabel: params.target.regionLabel,
      sourceUrl: params.target.targetUrl,
      extractionSource: null,
      loggedIn: false,
      error: 'No crawl result returned.',
    }
  );
}
