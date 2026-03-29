import { existsSync } from 'node:fs';
import { chromium, type Browser, type BrowserContext, type LaunchOptions, type Page } from 'playwright-core';
import type {
  TikTokVideoApiHeaders,
  TikTokVideoFailureCode,
  TikTokVideoItem,
  TikTokVideoTarget,
  TikTokVideoTargetResult,
  TikTokVideoTimingMetrics,
} from './types';

const DEFAULT_TIMEOUT_MS = 45_000;
const DEFAULT_WAIT_AFTER_LOAD_MS = 1_000;
const DEFAULT_LIMIT = 20;
const DEFAULT_MAX_PAGES = 5;
const BOOTSTRAP_URL_PREFIX = 'https://ads.tiktok.com/business/creativecenter/inspiration/popular/pc';
const CREATIVE_RADAR_API_PATH = '/creative_radar_api/';
const LIST_API_PATH = '/creative_radar_api/v1/popular_trend/list';
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

interface TikTokVideoListApiRecord {
  id?: string;
  item_id?: string;
  itemId?: string;
  item_url?: string;
  itemUrl?: string;
  title?: string;
  cover?: string;
  duration?: number;
  region?: string;
  [key: string]: unknown;
}

interface TikTokVideoListApiResponse {
  code?: number;
  msg?: string;
  data?: {
    list?: TikTokVideoListApiRecord[];
    videos?: TikTokVideoListApiRecord[];
    pagination?: {
      total_count?: number;
      has_more?: boolean;
      totalCount?: number;
      hasMore?: boolean;
    };
  };
}

class TikTokVideoCrawlerError extends Error {
  constructor(
    readonly code: TikTokVideoFailureCode,
    message: string,
  ) {
    super(message);
    this.name = 'TikTokVideoCrawlerError';
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toErrorText(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function getFailureCode(error: unknown, fallback: TikTokVideoFailureCode): TikTokVideoFailureCode {
  return error instanceof TikTokVideoCrawlerError ? error.code : fallback;
}

function buildTimings(scopeStartedAt: number, bootstrapMs: number, fetchListMs: number) {
  return {
    bootstrapMs,
    fetchListMs,
    totalMs: Math.max(0, Date.now() - scopeStartedAt),
  } satisfies TikTokVideoTimingMetrics;
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

function getLaunchOptions(target: TikTokVideoTarget, headless: boolean): LaunchOptions {
  const executablePath = resolveBrowserExecutablePath(target.browserExecutablePath);
  const launchOptions: LaunchOptions = {
    headless,
    args: ['--disable-blink-features=AutomationControlled'],
  };

  if (executablePath) {
    launchOptions.executablePath = executablePath;
  }

  return launchOptions;
}

async function openBrowserSession(params: { target: TikTokVideoTarget; headless: boolean }) {
  let browser: Browser;
  try {
    browser = await chromium.launch(getLaunchOptions(params.target, params.headless));
  } catch (error) {
    throw new TikTokVideoCrawlerError(
      'browser_launch_failed',
      `Failed to launch browser for country=${params.target.countryCode}: ${toErrorText(error)}`,
    );
  }

  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1200 },
      locale: 'en-US',
      userAgent: DEFAULT_USER_AGENT,
    });
    const page = await context.newPage();
    return { browser, context, page };
  } catch (error) {
    await browser.close().catch(() => {});
    throw new TikTokVideoCrawlerError(
      'session_bootstrap_failed',
      `Failed to create browser context for country=${params.target.countryCode}: ${toErrorText(error)}`,
    );
  }
}

function buildBootstrapUrl(locale: string) {
  return `${BOOTSTRAP_URL_PREFIX}/${locale}`;
}

function buildListApiUrl(params: {
  countryCode: string;
  period: number;
  orderBy: string;
  page: number;
  limit: number;
}) {
  const url = new URL('https://ads.tiktok.com/creative_radar_api/v1/popular_trend/list');
  url.searchParams.set('period', String(params.period));
  url.searchParams.set('page', String(params.page));
  url.searchParams.set('limit', String(params.limit));
  url.searchParams.set('order_by', params.orderBy);
  url.searchParams.set('country_code', params.countryCode);
  return url.toString();
}

function captureApiHeaders(headers: Record<string, string | undefined>): TikTokVideoApiHeaders | null {
  const timestamp = headers.timestamp?.trim();
  const lang = headers.lang?.trim();
  const referer = headers.referer?.trim();
  const userSign = headers['user-sign']?.trim();
  const anonymousUserId = headers['anonymous-user-id']?.trim();
  const userAgent = headers['user-agent']?.trim();
  const accept = headers.accept?.trim();
  const webId = headers['web-id']?.trim();

  if (!timestamp || !lang || !referer || !userSign || !anonymousUserId || !userAgent || !accept) {
    return null;
  }

  return {
    timestamp,
    lang,
    referer,
    userSign,
    anonymousUserId,
    userAgent,
    accept,
    webId,
  };
}

async function bootstrapApiAccess(page: Page, locale: string, timeoutMs: number, waitAfterLoadMs: number) {
  let apiHeaders: TikTokVideoApiHeaders | null = null;
  page.on('request', (request) => {
    if (!request.url().includes(CREATIVE_RADAR_API_PATH)) return;
    const capturedHeaders = captureApiHeaders(request.headers());
    if (capturedHeaders) {
      apiHeaders = capturedHeaders;
    }
  });

  try {
    await page.goto(buildBootstrapUrl(locale), { waitUntil: 'domcontentloaded', timeout: timeoutMs });
  } catch (error) {
    throw new TikTokVideoCrawlerError(
      'session_bootstrap_failed',
      `Failed to open TikTok videos bootstrap page: ${toErrorText(error)}`,
    );
  }

  const startedAt = Date.now();
  while (!apiHeaders && Date.now() - startedAt < timeoutMs) {
    await sleep(250);
  }

  if (waitAfterLoadMs > 0) {
    await sleep(waitAfterLoadMs);
  }

  if (!apiHeaders) {
    throw new TikTokVideoCrawlerError(
      'api_header_capture_failed',
      'TikTok videos API headers were not captured from the bootstrap page.',
    );
  }

  return {
    apiHeaders,
    bootstrapUrl: page.url(),
  };
}

async function fetchListPage(params: {
  page: Page;
  headers: TikTokVideoApiHeaders;
  countryCode: string;
  period: number;
  orderBy: string;
  pageNumber: number;
  limit: number;
}) {
  const listApiUrl = buildListApiUrl({
    countryCode: params.countryCode,
    period: params.period,
    orderBy: params.orderBy,
    page: params.pageNumber,
    limit: params.limit,
  });

  const response = await params.page.evaluate(
    async ({ url, headers: apiHeaders }) => {
      const response = await fetch(url, {
        credentials: 'include',
        headers: {
          accept: apiHeaders.accept,
          'anonymous-user-id': apiHeaders.anonymousUserId,
          lang: apiHeaders.lang,
          referer: apiHeaders.referer,
          timestamp: apiHeaders.timestamp,
          'user-agent': apiHeaders.userAgent,
          'user-sign': apiHeaders.userSign,
          ...(apiHeaders.webId ? { 'web-id': apiHeaders.webId } : {}),
        },
      });

      const json = (await response.json()) as TikTokVideoListApiResponse;
      return {
        status: response.status,
        json,
      };
    },
    {
      url: listApiUrl,
      headers: params.headers,
    },
  );

  if (response.status !== 200 || response.json.code !== 0) {
    throw new TikTokVideoCrawlerError(
      'list_fetch_failed',
      `TikTok videos list failed for country=${params.countryCode} period=${params.period} orderBy=${params.orderBy} page=${params.pageNumber} status=${response.status} code=${response.json.code ?? 'unknown'} msg=${response.json.msg ?? 'n/a'}`,
    );
  }

  return {
    listApiUrl,
    data: response.json,
  };
}

function mapListItem(
  record: TikTokVideoListApiRecord,
  countryCode: string,
  countryName: string,
  rank: number,
): TikTokVideoItem | null {
  const videoId = String(record.id ?? '').trim();
  const itemId = String(record.item_id ?? record.itemId ?? videoId).trim();
  const itemUrl = String(record.item_url ?? record.itemUrl ?? '').trim();
  const title = String(record.title ?? '').trim();

  if (!videoId || !itemId || !itemUrl || !title) {
    return null;
  }

  const duration = Number(record.duration);
  return {
    rank,
    videoId,
    itemId,
    itemUrl,
    title,
    coverUrl: typeof record.cover === 'string' && record.cover.trim() ? record.cover.trim() : null,
    durationSeconds: Number.isFinite(duration) ? Math.max(0, Math.floor(duration)) : null,
    countryCode,
    countryName,
    regionName: typeof record.region === 'string' && record.region.trim() ? record.region.trim() : null,
    rawItem: record,
  };
}

async function fetchAllListItems(params: {
  page: Page;
  headers: TikTokVideoApiHeaders;
  target: TikTokVideoTarget;
  period: number;
  orderBy: string;
  limit: number;
  maxPages: number;
}) {
  const items: TikTokVideoItem[] = [];
  const seenVideoIds = new Set<string>();
  let listApiUrl = '';
  let pageCount = 0;
  let totalCount = 0;

  for (let pageNumber = 1; pageNumber <= params.maxPages; pageNumber += 1) {
    const pageResponse = await fetchListPage({
      page: params.page,
      headers: params.headers,
      countryCode: params.target.countryCode,
      period: params.period,
      orderBy: params.orderBy,
      pageNumber,
      limit: params.limit,
    });
    listApiUrl = pageResponse.listApiUrl;
    pageCount = pageNumber;

    const records = pageResponse.data.data?.list ?? pageResponse.data.data?.videos ?? [];
    const pagination = pageResponse.data.data?.pagination;
    totalCount = Number.isFinite(pagination?.total_count)
      ? Number(pagination?.total_count)
      : Number.isFinite(pagination?.totalCount)
        ? Number(pagination?.totalCount)
        : totalCount;

    for (const record of records) {
      const mapped = mapListItem(record, params.target.countryCode, params.target.countryName, items.length + 1);
      if (!mapped || seenVideoIds.has(mapped.videoId)) continue;
      seenVideoIds.add(mapped.videoId);
      items.push(mapped);
    }

    const hasMore = Boolean(pagination?.has_more ?? pagination?.hasMore);
    if (!hasMore || !records.length || (totalCount > 0 && items.length >= totalCount)) {
      break;
    }
  }

  if (!items.length) {
    throw new TikTokVideoCrawlerError(
      'list_data_empty',
      `TikTok videos list returned no items for country=${params.target.countryCode} period=${params.period} orderBy=${params.orderBy}.`,
    );
  }

  return {
    listApiUrl,
    pageCount,
    totalCount,
    items,
  };
}

export async function crawlTikTokVideoTargets(params: {
  targets: TikTokVideoTarget[];
  snapshotHour: string;
  headless?: boolean;
  timeoutMs?: number;
  waitAfterLoadMs?: number;
  limit?: number;
  maxPages?: number;
  onTargetComplete?: (result: TikTokVideoTargetResult) => void | Promise<void>;
}) {
  const {
    targets,
    snapshotHour,
    headless = true,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    waitAfterLoadMs = DEFAULT_WAIT_AFTER_LOAD_MS,
    limit = DEFAULT_LIMIT,
    maxPages = DEFAULT_MAX_PAGES,
    onTargetComplete,
  } = params;

  if (!targets.length) {
    return {
      results: [] as TikTokVideoTargetResult[],
      bootstrapUrl: buildBootstrapUrl('en'),
    };
  }

  let browser: Browser | null = null;
  let context: BrowserContext | null = null;

  try {
    const session = await openBrowserSession({ target: targets[0], headless });
    browser = session.browser;
    context = session.context;
    const page = session.page;

    const bootstrapStartedAt = Date.now();
    const bootstrap = await bootstrapApiAccess(page, targets[0].locale, timeoutMs, waitAfterLoadMs);
    const bootstrapMs = Date.now() - bootstrapStartedAt;

    const results: TikTokVideoTargetResult[] = [];
    for (const target of targets) {
      for (const period of target.periods) {
        for (const orderBy of target.orderByList) {
          const scopeStartedAt = Date.now();
          let fetchListMs = 0;
          let listApiUrl: string | null = null;
          let pageCount = 0;
          let totalCount = 0;

          try {
            const fetchStartedAt = Date.now();
            const listResponse = await fetchAllListItems({
              page,
              headers: bootstrap.apiHeaders,
              target,
              period,
              orderBy,
              limit,
              maxPages,
            });
            fetchListMs = Date.now() - fetchStartedAt;
            listApiUrl = listResponse.listApiUrl;
            pageCount = listResponse.pageCount;
            totalCount = listResponse.totalCount;

            const result = {
              status: 'success',
              snapshotHour,
              countryCode: target.countryCode,
              countryName: target.countryName,
              period,
              orderBy,
              sourceUrl: bootstrap.bootstrapUrl,
              listApiUrl,
              pageCount,
              totalCount,
              timingsMs: buildTimings(scopeStartedAt, bootstrapMs, fetchListMs),
              items: listResponse.items,
              warnings: [],
            } satisfies TikTokVideoTargetResult;
            results.push(result);
            await onTargetComplete?.(result);
          } catch (error) {
            const failureResult = {
              status: 'failed',
              snapshotHour,
              countryCode: target.countryCode,
              countryName: target.countryName,
              period,
              orderBy,
              sourceUrl: bootstrap.bootstrapUrl,
              listApiUrl,
              pageCount,
              totalCount,
              timingsMs: buildTimings(scopeStartedAt, bootstrapMs, fetchListMs),
              errorCode: getFailureCode(error, 'unknown'),
              error: toErrorText(error),
            } satisfies TikTokVideoTargetResult;
            results.push(failureResult);
            await onTargetComplete?.(failureResult);
          }
        }
      }
    }

    return {
      results,
      bootstrapUrl: bootstrap.bootstrapUrl,
    };
  } finally {
    await context?.close().catch(() => {});
    await browser?.close().catch(() => {});
  }
}
