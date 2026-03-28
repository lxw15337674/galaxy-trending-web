import { existsSync } from 'node:fs';
import { chromium, type Browser, type BrowserContext, type LaunchOptions, type Page, type Response } from 'playwright-core';
import { resolveXTrendStorageState } from './cookie-provider';
import {
  XTrendRegionResult,
  XTrendTarget,
  type XTrendExtractionSource,
  type XTrendFailureCode,
  type XTrendItem,
  type XTrendRegionTimings,
} from './types';

const DEFAULT_TIMEOUT_MS = 45_000;
const DEFAULT_WAIT_AFTER_LOAD_MS = 1_000;
const DEFAULT_MAX_TRENDS = 20;
const DOM_TREND_LINK_SELECTOR = 'a[href*="/search?q="]';
const MIN_READY_TREND_LINKS = 5;
const READY_SIGNAL_TIMEOUT_MS = 12_000;
const FALLBACK_SIGNAL_TIMEOUT_MS = 4_000;
const FALLBACK_WAIT_AFTER_LOAD_MS = 2_500;
const POST_ACTION_SETTLE_CAP_MS = 1_000;
const DEFAULT_WINDOWS_BROWSER_EXECUTABLE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const DEFAULT_LOCALE = 'en-US';
const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36 Edg/134.0.0.0';
const EXPLORE_SETTINGS_URL = 'https://x.com/settings/explore';
const EXPLORE_LOCATION_URL = 'https://x.com/settings/explore/location';
const SET_EXPLORE_SETTINGS_PATH = '/i/api/2/guide/set_explore_settings.json';
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

interface CapturedApiHeaders {
  authorization: string;
  xCsrfToken: string;
  xTwitterActiveUser: string;
  xTwitterAuthType: string;
  xTwitterClientLanguage: string;
}

class XTrendCrawlerError extends Error {
  constructor(
    readonly code: XTrendFailureCode,
    message: string,
  ) {
    super(message);
    this.name = 'XTrendCrawlerError';
  }
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

function limitTrendItems(items: XTrendItem[], maxItems = DEFAULT_MAX_TRENDS) {
  return items.slice(0, maxItems).map((item, index) => ({
    ...item,
    rank: index + 1,
  }));
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

function getFailureCode(error: unknown, fallback: XTrendFailureCode): XTrendFailureCode {
  return error instanceof XTrendCrawlerError ? error.code : fallback;
}

function createEmptyTimings(): XTrendRegionTimings {
  return {
    switchRegionMs: 0,
    extractTrendsMs: 0,
    totalMs: 0,
  };
}

function buildTimings(regionStartedAt: number, switchRegionMs: number, extractTrendsMs: number): XTrendRegionTimings {
  return {
    switchRegionMs,
    extractTrendsMs,
    totalMs: Math.max(0, Date.now() - regionStartedAt),
  };
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

function captureApiHeaders(headers: Record<string, string | undefined>): CapturedApiHeaders | null {
  const authorization = headers.authorization?.trim();
  const xCsrfToken = headers['x-csrf-token']?.trim();

  if (!authorization || !xCsrfToken) {
    return null;
  }

  return {
    authorization,
    xCsrfToken,
    xTwitterActiveUser: headers['x-twitter-active-user']?.trim() || 'yes',
    xTwitterAuthType: headers['x-twitter-auth-type']?.trim() || 'OAuth2Session',
    xTwitterClientLanguage: headers['x-twitter-client-language']?.trim() || 'en',
  };
}

async function openBrowserSession(params: {
  target: XTrendTarget;
  headless: boolean;
}): Promise<{ browser: Browser; context: BrowserContext; page: Page }> {
  let storageState;
  try {
    storageState = await resolveXTrendStorageState(params.target);
  } catch (error) {
    throw new XTrendCrawlerError(
      'cookie_fetch_failed',
      `Failed to resolve storage state for region=${params.target.regionKey}: ${toErrorText(error)}`,
    );
  }

  if (typeof storageState === 'string' && !existsSync(storageState)) {
    throw new XTrendCrawlerError(
      'cookie_fetch_failed',
      `Storage state file not found for region=${params.target.regionKey}: ${storageState}`,
    );
  }

  let browser: Browser;
  try {
    browser = await chromium.launch(getBrowserLaunchOptions(params.target, params.headless));
  } catch (error) {
    throw new XTrendCrawlerError(
      'browser_launch_failed',
      `Failed to launch browser for region=${params.target.regionKey}: ${toErrorText(error)}`,
    );
  }

  try {
    const context = await browser.newContext({
      locale: params.target.locale?.trim() || DEFAULT_LOCALE,
      storageState,
      viewport: { width: 1440, height: 1600 },
      userAgent: DEFAULT_USER_AGENT,
    });
    const page = await context.newPage();

    return { browser, context, page };
  } catch (error) {
    await browser.close().catch(() => {});
    const message = toErrorText(error);
    throw new XTrendCrawlerError(
      /storage state/i.test(message) ? 'cookie_fetch_failed' : 'session_setup_failed',
      `Failed to create browser session for region=${params.target.regionKey}: ${message}`,
    );
  }
}

function getPostActionSettleMs(waitAfterLoadMs: number) {
  return Math.max(0, Math.min(waitAfterLoadMs, POST_ACTION_SETTLE_CAP_MS));
}

async function waitForCondition(predicate: () => boolean, timeoutMs: number, intervalMs = 200) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (predicate()) {
      return true;
    }

    await sleep(Math.min(intervalMs, Math.max(0, deadline - Date.now())));
  }

  return predicate();
}

async function waitForTrendSignals(
  page: Page,
  networkHits: ExtractedResult[],
  timeoutMs: number,
  waitAfterLoadMs: number,
) {
  const signalTimeoutMs = Math.min(timeoutMs, READY_SIGNAL_TIMEOUT_MS);

  await Promise.race([
    waitForCondition(() => networkHits.some((hit) => hit.trendCount > 0), signalTimeoutMs),
    page
      .waitForFunction(
        ({ selector, minCount }) => document.querySelectorAll(selector).length >= minCount,
        { selector: DOM_TREND_LINK_SELECTOR, minCount: MIN_READY_TREND_LINKS },
        { timeout: signalTimeoutMs },
      )
      .then(() => true)
      .catch(() => false),
  ]);

  const settleMs = getPostActionSettleMs(waitAfterLoadMs);
  if (settleMs > 0) {
    await sleep(settleMs);
  }
}

async function ensureManualLocationMode(page: Page, timeoutMs: number, waitAfterLoadMs: number) {
  await page.goto(EXPLORE_SETTINGS_URL, {
    waitUntil: 'domcontentloaded',
    timeout: timeoutMs,
  });
  const currentLocationToggle = page.locator('[data-testid="currentLocation"] input[type="checkbox"]').first();
  await currentLocationToggle.waitFor({ state: 'attached', timeout: timeoutMs });

  if (await currentLocationToggle.isChecked()) {
    await currentLocationToggle.click({ force: true, timeout: timeoutMs });
    await page.locator('[data-testid="exploreLocations"]').first().waitFor({ state: 'visible', timeout: timeoutMs });
    const settleMs = getPostActionSettleMs(waitAfterLoadMs);
    if (settleMs > 0) {
      await sleep(settleMs);
    }
    return;
  }

  const exploreLocationsLink = page.locator('[data-testid="exploreLocations"]').first();
  if (await exploreLocationsLink.count()) {
    await exploreLocationsLink.waitFor({ state: 'visible', timeout: timeoutMs });
  }
}

async function switchRegionViaApi(
  page: Page,
  target: XTrendTarget,
  headers: CapturedApiHeaders,
  waitAfterLoadMs: number,
) {
  if (!target.placeId) {
    throw new XTrendCrawlerError('region_switch_api_failed', `Missing placeId for region=${target.regionKey}`);
  }

  const result = await page.evaluate(
    async ({ path, placeId, headers }) => {
      const response = await fetch(path, {
        method: 'POST',
        credentials: 'include',
        headers: {
          authorization: headers.authorization,
          'x-csrf-token': headers.xCsrfToken,
          'x-twitter-active-user': headers.xTwitterActiveUser,
          'x-twitter-auth-type': headers.xTwitterAuthType,
          'x-twitter-client-language': headers.xTwitterClientLanguage,
          'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        },
        body: new URLSearchParams({ places: placeId }).toString(),
      });

      const text = await response.text();
      return {
        status: response.status,
        ok: response.ok,
        body: text.slice(0, 500),
      };
    },
    {
      path: SET_EXPLORE_SETTINGS_PATH,
      placeId: target.placeId,
      headers,
    },
  );

  if (!result.ok) {
    throw new XTrendCrawlerError(
      'region_switch_api_failed',
      `set_explore_settings request failed for region=${target.regionKey} status=${result.status} body=${result.body}`,
    );
  }

  const settleMs = getPostActionSettleMs(waitAfterLoadMs);
  if (settleMs > 0) {
    await sleep(settleMs);
  }
}

async function switchRegionViaUi(page: Page, target: XTrendTarget, timeoutMs: number, waitAfterLoadMs: number) {
  if (!target.locationSearchQuery || !target.locationSelectText) {
    throw new XTrendCrawlerError('region_switch_ui_failed', `Missing UI location config for region=${target.regionKey}`);
  }

  await page.goto(EXPLORE_LOCATION_URL, {
    waitUntil: 'domcontentloaded',
    timeout: timeoutMs,
  });
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

  const exactButton = page.getByRole('button', { name: target.locationSelectText, exact: true }).first();
  const fuzzyButton = page.locator('button').filter({ hasText: target.locationSelectText }).first();
  const locationButton = (await exactButton.count()) > 0 ? exactButton : fuzzyButton;

  await locationButton.waitFor({ state: 'visible', timeout: timeoutMs });

  const setLocationPromise = page.waitForResponse(
    (response) =>
      response.url().includes(SET_EXPLORE_SETTINGS_PATH) && response.request().method() === 'POST',
    { timeout: timeoutMs },
  );

  await locationButton.click({ force: true, timeout: timeoutMs });
  const setLocationResponse = await setLocationPromise;
  if (!setLocationResponse.ok()) {
    throw new XTrendCrawlerError(
      'region_switch_ui_failed',
      `set_explore_settings request failed for region=${target.regionKey} status=${setLocationResponse.status()}`,
    );
  }

  const settleMs = getPostActionSettleMs(waitAfterLoadMs);
  if (settleMs > 0) {
    await sleep(settleMs);
  }
}

async function switchRegion(
  page: Page,
  target: XTrendTarget,
  apiHeaders: CapturedApiHeaders | null,
  timeoutMs: number,
  waitAfterLoadMs: number,
) {
  const apiErrors: string[] = [];

  if (target.placeId && apiHeaders) {
    try {
      await switchRegionViaApi(page, target, apiHeaders, waitAfterLoadMs);
      return;
    } catch (error) {
      apiErrors.push(toErrorText(error));
    }
  }

  await switchRegionViaUi(page, target, timeoutMs, waitAfterLoadMs);

  if (apiErrors.length) {
    console.warn(`region=${target.regionKey} api-switch fallback to ui: ${apiErrors.join(' | ')}`);
  }
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
    const trendSignalPromise = waitForTrendSignals(page, networkHits, timeoutMs, waitAfterLoadMs);
    try {
      await page.goto(target.targetUrl, {
        waitUntil: 'domcontentloaded',
        timeout: timeoutMs,
      });
    } catch (error) {
      throw new XTrendCrawlerError(
        'trend_navigation_failed',
        `Failed to open trends page for region=${target.regionKey}: ${toErrorText(error)}`,
      );
    }
    await trendSignalPromise;

    loggedIn = await isLoggedIn(page);
    let networkResult = networkHits.sort((left, right) => right.trendCount - left.trendCount)[0] ?? null;
    let domResult = await extractFromDom(page);

    if (!networkResult && !domResult) {
      await waitForTrendSignals(
        page,
        networkHits,
        Math.min(timeoutMs, FALLBACK_SIGNAL_TIMEOUT_MS),
        Math.max(waitAfterLoadMs, FALLBACK_WAIT_AFTER_LOAD_MS),
      );
      networkResult = networkHits.sort((left, right) => right.trendCount - left.trendCount)[0] ?? null;
      domResult = await extractFromDom(page);
    }

    const finalResult = networkResult ?? domResult;
    sourceUrl = finalResult?.pageUrl ?? page.url();
    extractionSource = finalResult?.source ?? null;

    if (!finalResult) {
      throw new XTrendCrawlerError(
        loggedIn ? 'trend_data_empty' : 'not_logged_in',
        `No trend data extracted. loggedIn=${loggedIn} currentUrl=${page.url()}`,
      );
    }

    const limitedItems = limitTrendItems(finalResult.trends);
    if (!limitedItems.length) {
      throw new XTrendCrawlerError(
        'trend_data_empty',
        `No trend data extracted after limiting. loggedIn=${loggedIn} currentUrl=${page.url()}`,
      );
    }

    return {
      status: 'success',
      snapshotHour,
      regionKey: target.regionKey,
      regionLabel: target.regionLabel,
      sourceUrl,
      extractionSource: finalResult.source,
      loggedIn,
      timingsMs: createEmptyTimings(),
      items: limitedItems,
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
      errorCode: getFailureCode(error, loggedIn ? 'unknown' : 'not_logged_in'),
      timingsMs: createEmptyTimings(),
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
  onRegionComplete?: (result: XTrendRegionResult) => void | Promise<void>;
}): Promise<XTrendRegionResult[]> {
  const {
    targets,
    snapshotHour,
    headless = true,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    waitAfterLoadMs = DEFAULT_WAIT_AFTER_LOAD_MS,
    onRegionComplete,
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
    let apiHeaders: CapturedApiHeaders | null = null;

    page.on('request', (request) => {
      const captured = captureApiHeaders(request.headers());
      if (captured) {
        apiHeaders = captured;
      }
    });

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

    try {
      await ensureManualLocationMode(page, timeoutMs, waitAfterLoadMs);
    } catch (error) {
      throw new XTrendCrawlerError(
        'session_setup_failed',
        `Failed to prepare explore settings for region=${targets[0]?.regionKey ?? 'unknown'}: ${toErrorText(error)}`,
      );
    }
    const results: XTrendRegionResult[] = [];

    for (const target of targets) {
      const regionStartedAt = Date.now();
      let switchRegionMs = 0;
      let extractTrendsMs = 0;

      try {
        const switchStartedAt = Date.now();
        await switchRegion(page, target, apiHeaders, timeoutMs, waitAfterLoadMs);
        switchRegionMs = Date.now() - switchStartedAt;

        collectNetworkHits = true;

        const extractStartedAt = Date.now();
        const result = await extractCurrentRegionTrends({
          page,
          target,
          snapshotHour,
          timeoutMs,
          waitAfterLoadMs,
          networkHits,
        });
        extractTrendsMs = Date.now() - extractStartedAt;
        result.timingsMs = buildTimings(regionStartedAt, switchRegionMs, extractTrendsMs);
        results.push(result);
        await onRegionComplete?.(result);
      } catch (error) {
        const failureResult: XTrendRegionResult = {
          status: 'failed',
          snapshotHour,
          regionKey: target.regionKey,
          regionLabel: target.regionLabel,
          sourceUrl: page.url(),
          extractionSource: null,
          loggedIn: await isLoggedIn(page).catch(() => false),
          errorCode: getFailureCode(error, 'region_switch_failed'),
          timingsMs: buildTimings(regionStartedAt, switchRegionMs, extractTrendsMs),
          error: toErrorText(error),
        };
        results.push(failureResult);
        await onRegionComplete?.(failureResult);
      } finally {
        collectNetworkHits = false;
        networkHits.length = 0;
      }
    }

    return results;
  } catch (error) {
    const errorCode = getFailureCode(error, 'unknown');
    const errorText = toErrorText(error);
    const bootstrapFailures = targets.map((target) => ({
      status: 'failed',
      snapshotHour,
      regionKey: target.regionKey,
      regionLabel: target.regionLabel,
      sourceUrl: target.targetUrl,
      extractionSource: null,
      loggedIn: false,
      errorCode,
      timingsMs: createEmptyTimings(),
      error: `Session bootstrap failed before region=${target.regionKey} crawl started: ${errorText}`,
    }) satisfies XTrendRegionResult);

    for (const failureResult of bootstrapFailures) {
      await onRegionComplete?.(failureResult);
    }

    return bootstrapFailures;
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
      errorCode: 'unknown',
      timingsMs: createEmptyTimings(),
      error: 'No crawl result returned.',
    }
  );
}
