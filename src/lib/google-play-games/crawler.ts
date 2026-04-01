import { existsSync } from 'node:fs';
import { chromium, type Browser, type BrowserContext, type LaunchOptions, type Page, type Response } from 'playwright-core';
import { getGooglePlayGameCountryName } from './countries';
import type {
  GooglePlayGameChartItem,
  GooglePlayGameChartSnapshot,
  GooglePlayGameChartType,
} from './types';
import {
  GOOGLE_PLAY_GAME_PAGE_LIMIT,
  buildGooglePlayGameSourceUrl,
  getGooglePlayGameChartButtonLabel,
  normalizeGooglePlayGameCountryCode,
} from './types';

const DEFAULT_TIMEOUT_MS = 45_000;
const DEFAULT_WAIT_AFTER_LOAD_MS = 2_000;
const DEFAULT_SCROLL_WAIT_MS = 1_000;
const DEFAULT_WINDOWS_BROWSER_EXECUTABLE_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
] as const;
const DEFAULT_DARWIN_BROWSER_EXECUTABLE_PATHS = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
] as const;
const DEFAULT_LINUX_BROWSER_EXECUTABLE_PATHS = [
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  '/usr/bin/microsoft-edge',
] as const;
const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36';

interface GooglePlayGameCrawlerOptions {
  headless?: boolean;
  timeoutMs?: number;
  waitAfterLoadMs?: number;
  browserExecutablePath?: string | null;
}

interface ExtractedGooglePlayGameChartItem {
  rank: number | null;
  appId: string | null;
  appName: string | null;
  developerName: string | null;
  storeUrl: string | null;
  artworkUrl: string | null;
  ratingText: string | null;
  ratingValue: string | null;
  priceText: string | null;
  primaryGenre: string | null;
  genreSummary: string | null;
  rawItem: Record<string, unknown>;
}

interface CapturedRpcChartResponse {
  itemCount: number;
  responseText: string;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveBrowserExecutablePath(explicitPath?: string | null) {
  const normalizedExplicitPath = explicitPath?.trim();
  if (normalizedExplicitPath) {
    return normalizedExplicitPath;
  }

  const candidates =
    process.platform === 'win32'
      ? DEFAULT_WINDOWS_BROWSER_EXECUTABLE_PATHS
      : process.platform === 'darwin'
        ? DEFAULT_DARWIN_BROWSER_EXECUTABLE_PATHS
        : DEFAULT_LINUX_BROWSER_EXECUTABLE_PATHS;

  return candidates.find((candidate) => existsSync(candidate));
}

function getLaunchOptions(options: GooglePlayGameCrawlerOptions): LaunchOptions {
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

function mapExtractedItem(item: ExtractedGooglePlayGameChartItem): GooglePlayGameChartItem | null {
  if (!item.rank || !item.appId || !item.appName || !item.storeUrl) {
    return null;
  }

  return {
    rank: item.rank,
    appId: item.appId,
    appName: item.appName,
    developerName: item.developerName,
    storeUrl: item.storeUrl,
    artworkUrl: item.artworkUrl,
    ratingText: item.ratingText,
    ratingValue: item.ratingValue,
    priceText: item.priceText,
    primaryGenre: item.primaryGenre,
    genreSummary: item.genreSummary,
    rawItem: item.rawItem,
  } satisfies GooglePlayGameChartItem;
}

function toText(value: unknown) {
  const normalized = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
  return normalized.length > 0 ? normalized : null;
}

function toAbsoluteUrl(href: unknown, sourceUrl: string) {
  const normalizedHref = toText(href);
  if (!normalizedHref) {
    return null;
  }

  try {
    return new URL(normalizedHref, sourceUrl).toString();
  } catch {
    return normalizedHref;
  }
}

function getChartTabId(chartType: GooglePlayGameChartType) {
  if (chartType === 'topgrossing') {
    return 'ct|apps_topgrossing';
  }

  if (chartType === 'toppaid') {
    return 'ct|apps_topselling_paid';
  }

  return 'ct|apps_topselling_free';
}

function parseRpcPayload(responseText: string) {
  const payloadLine = responseText
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.startsWith('[['));

  if (!payloadLine) {
    return null;
  }

  try {
    const outerPayload = JSON.parse(payloadLine) as unknown[];
    const innerPayloadText = outerPayload?.[0]?.[2];
    if (typeof innerPayloadText !== 'string') {
      return null;
    }

    return JSON.parse(innerPayloadText) as unknown[];
  } catch {
    return null;
  }
}

function extractGenreTokens(rawMeta: unknown) {
  const tokens: string[] = [];

  const visit = (value: unknown) => {
    if (!Array.isArray(value)) {
      return;
    }

    const maybeLabel = value[3];
    if (Array.isArray(maybeLabel) && typeof maybeLabel[0] === 'string') {
      const token = toText(maybeLabel[0]);
      if (token) {
        tokens.push(token);
      }
    }

    for (const item of value) {
      visit(item);
    }
  };

  visit(rawMeta);

  return Array.from(new Set(tokens));
}

function extractRpcChartItems(responseText: string, sourceUrl: string) {
  const parsedPayload = parseRpcPayload(responseText);
  const rawEntries = parsedPayload?.[0]?.[1]?.[0]?.[28]?.[0];
  if (!Array.isArray(rawEntries)) {
    return [];
  }

  return rawEntries
    .map((rawEntry, index) => {
      if (!Array.isArray(rawEntry)) {
        return null;
      }

      const base = Array.isArray(rawEntry[0]) ? rawEntry[0] : null;
      if (!base) {
        return null;
      }

      const appId = toText(base[0]?.[0]);
      const appName = toText(base[3]);
      const ratingValue = toText(base[4]?.[0]);
      const primaryGenre = toText(base[5]);
      const offerInfo = base[8];
      const storeUrl =
        toAbsoluteUrl(base[10]?.[4]?.[2], sourceUrl) ?? toAbsoluteUrl(base[8]?.[6]?.[5]?.[2], sourceUrl);
      const developerName = toText(base[14]);
      const artworkUrl =
        toAbsoluteUrl(base[1]?.[3]?.[2], sourceUrl) ?? toAbsoluteUrl(base[22]?.[3]?.[2], sourceUrl);
      const genreTokens = extractGenreTokens(rawEntry[1]);
      const ratingText = ratingValue ? `${ratingValue} stars` : null;
      const priceText = toText(offerInfo?.[1]?.[0]?.[2]);
      const rawRank = index + 1;

      return mapExtractedItem({
        rank: rawRank,
        appId,
        appName,
        developerName,
        storeUrl,
        artworkUrl,
        ratingText,
        ratingValue,
        priceText,
        primaryGenre: primaryGenre ?? genreTokens[0] ?? null,
        genreSummary: genreTokens.length > 0 ? genreTokens.join(' / ') : null,
        rawItem: {
          source: 'vyAe2',
          base,
          meta: rawEntry[1] ?? null,
          rankIndex: rawEntry[2] ?? null,
          listIndex: index,
        },
      });
    })
    .filter((item): item is GooglePlayGameChartItem => item !== null);
}

async function waitForChartTabs(page: Page, timeoutMs: number) {
  const chartTabs = page.locator('[id="ct|apps_topselling_free"]');
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const isVisible = await chartTabs.first().isVisible().catch(() => false);
    if (isVisible) {
      return;
    }

    await page.evaluate(() => {
      window.scrollBy(0, Math.max(window.innerHeight * 1.1, 1400));
    });
    await sleep(DEFAULT_SCROLL_WAIT_MS);
  }

  throw new Error('Google Play top charts tabs did not appear in time');
}

function captureChartResponse(page: Page, sourceUrl: string, captures: CapturedRpcChartResponse[]) {
  const handler = async (response: Response) => {
    if (!response.url().includes('rpcids=vyAe2')) {
      return;
    }

    try {
      const responseText = await response.text();
      const itemCount = extractRpcChartItems(responseText, sourceUrl).length;
      if (itemCount > 0) {
        captures.push({ itemCount, responseText });
      }
    } catch {
      // Ignore malformed or unrelated vyAe2 responses.
    }
  };

  page.on('response', handler);
  return () => {
    page.off('response', handler);
  };
}

async function waitForCapturedResponse(
  captures: CapturedRpcChartResponse[],
  minIndex: number,
  timeoutMs: number,
): Promise<CapturedRpcChartResponse> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const match = captures.slice(minIndex).findLast((capture) => capture.itemCount > 0);
    if (match) {
      return match;
    }

    await sleep(200);
  }

  throw new Error('Timed out waiting for Google Play chart RPC response');
}

export class GooglePlayGameChartsCrawler {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;

  constructor(private readonly options: GooglePlayGameCrawlerOptions = {}) {}

  private async ensureContext() {
    if (this.browser && this.context) {
      return { browser: this.browser, context: this.context };
    }

    this.browser = await chromium.launch(getLaunchOptions(this.options));
    this.context = await this.browser.newContext({
      locale: 'en-US',
      viewport: { width: 1440, height: 2000 },
      userAgent: DEFAULT_USER_AGENT,
    });

    return { browser: this.browser, context: this.context };
  }

  async fetchChart(
    countryCodeInput: string,
    chartType: GooglePlayGameChartType,
    snapshotHour: string,
  ): Promise<GooglePlayGameChartSnapshot> {
    const { context } = await this.ensureContext();
    const timeoutMs = this.options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const waitAfterLoadMs = this.options.waitAfterLoadMs ?? DEFAULT_WAIT_AFTER_LOAD_MS;
    const countryCode = normalizeGooglePlayGameCountryCode(countryCodeInput);
    const countryName = getGooglePlayGameCountryName(countryCode);
    const sourceUrl = buildGooglePlayGameSourceUrl(countryCode);
    const chartButtonLabel = getGooglePlayGameChartButtonLabel(chartType);
    const page = await context.newPage();
    const chartResponses: CapturedRpcChartResponse[] = [];
    const detachResponseHandler = captureChartResponse(page, sourceUrl, chartResponses);

    try {
      await page.goto(sourceUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
      await page.waitForLoadState('networkidle', { timeout: Math.min(timeoutMs, 10_000) }).catch(() => {});
      await waitForChartTabs(page, timeoutMs);
      await page.waitForTimeout(waitAfterLoadMs);

      let capturedResponse: CapturedRpcChartResponse;
      if (chartType === 'topfree') {
        capturedResponse = await waitForCapturedResponse(chartResponses, 0, timeoutMs);
      } else {
        const responseCountBeforeClick = chartResponses.length;
        const chartButton = page.locator(`[id="${getChartTabId(chartType)}"]`).first();
        await chartButton.click();
        capturedResponse = await waitForCapturedResponse(chartResponses, responseCountBeforeClick, timeoutMs);
      }

      const items = extractRpcChartItems(capturedResponse.responseText, sourceUrl).slice(0, GOOGLE_PLAY_GAME_PAGE_LIMIT);
      if (items.length === 0) {
        throw new Error(`Google Play ${chartType} parser returned 0 items for ${countryCode}`);
      }

      const pageTitle = await page.title();
      const fetchedAt = new Date().toISOString();

      return {
        chartType,
        countryCode,
        countryName,
        snapshotHour,
        fetchedAt,
        sourceUrl,
        pageTitle,
        items,
        rawPayload: {
          chartButtonLabel,
          finalPageUrl: page.url(),
          pageTitle,
          itemCount: items.length,
          responseItemCount: capturedResponse.itemCount,
          items,
        },
      } satisfies GooglePlayGameChartSnapshot;
    } finally {
      detachResponseHandler();
      await page.close().catch(() => {});
    }
  }

  async close() {
    await this.context?.close().catch(() => {});
    await this.browser?.close().catch(() => {});
    this.context = null;
    this.browser = null;
  }
}
