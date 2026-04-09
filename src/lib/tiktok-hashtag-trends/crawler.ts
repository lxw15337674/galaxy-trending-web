import { existsSync } from 'node:fs';
import { chromium, type Browser, type BrowserContext, type LaunchOptions, type Page } from 'playwright-core';
import type {
  TikTokHashtagApiHeaders,
  TikTokHashtagCountryOption,
  TikTokHashtagCreatorPreview,
  TikTokHashtagDetail,
  TikTokHashtagFailureCode,
  TikTokHashtagItem,
  TikTokHashtagTarget,
  TikTokHashtagTargetResult,
  TikTokHashtagTimingMetrics,
  TikTokHashtagTrendPoint,
} from './types';

const DEFAULT_TIMEOUT_MS = 45_000;
const DEFAULT_WAIT_AFTER_LOAD_MS = 1_000;
const DEFAULT_LIMIT = 20;
const DEFAULT_DETAIL_LIMIT = 0;
const BOOTSTRAP_URL_PREFIX = 'https://ads.tiktok.com/business/creativecenter/inspiration/popular/hashtag/pc';
const CREATIVE_RADAR_API_PATH = '/creative_radar_api/';
const FILTERS_API_PATH = '/creative_radar_api/v1/popular_trend/hashtag/filters';
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

interface TikTokFiltersResponse {
  code?: number;
  msg?: string;
  data?: {
    country?: Array<{ id?: string; value?: string }>;
  };
}

interface TikTokListApiRecord {
  hashtag_id?: string;
  hashtagId?: string;
  hashtag_name?: string;
  hashtagName?: string;
  publish_cnt?: number;
  publishCnt?: number;
  video_views?: number;
  videoViews?: number;
  rank?: number;
  rank_diff?: number;
  rankDiff?: number;
  rank_diff_type?: number;
  rankDiffType?: number;
  country_info?: { id?: string; value?: string };
  countryInfo?: { id?: string; value?: string };
  industry_info?: { value?: string };
  industryInfo?: { value?: string };
  trend?: TikTokHashtagTrendPoint[];
  creators?: Array<{ nick_name?: string; nickName?: string; avatar_url?: string; avatarUrl?: string }>;
}

interface TikTokListApiResponse {
  code?: number;
  msg?: string;
  data?: {
    list?: TikTokListApiRecord[];
  };
}

class TikTokHashtagCrawlerError extends Error {
  constructor(
    readonly code: TikTokHashtagFailureCode,
    message: string,
  ) {
    super(message);
    this.name = 'TikTokHashtagCrawlerError';
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toErrorText(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function getFailureCode(error: unknown, fallback: TikTokHashtagFailureCode): TikTokHashtagFailureCode {
  return error instanceof TikTokHashtagCrawlerError ? error.code : fallback;
}

function buildTimings(regionStartedAt: number, bootstrapMs: number, fetchListMs: number, enrichDetailsMs: number) {
  return {
    bootstrapMs,
    fetchListMs,
    enrichDetailsMs,
    totalMs: Math.max(0, Date.now() - regionStartedAt),
  } satisfies TikTokHashtagTimingMetrics;
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

function getLaunchOptions(target: TikTokHashtagTarget, headless: boolean): LaunchOptions {
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

async function openBrowserSession(params: { target: TikTokHashtagTarget; headless: boolean }) {
  let browser: Browser;
  try {
    browser = await chromium.launch(getLaunchOptions(params.target, params.headless));
  } catch (error) {
    throw new TikTokHashtagCrawlerError(
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
    throw new TikTokHashtagCrawlerError(
      'session_bootstrap_failed',
      `Failed to create browser context for country=${params.target.countryCode}: ${toErrorText(error)}`,
    );
  }
}

function buildBootstrapUrl(locale: string) {
  return `${BOOTSTRAP_URL_PREFIX}/${locale}`;
}

function buildListApiUrl(target: TikTokHashtagTarget, limit: number) {
  const url = new URL('https://ads.tiktok.com/creative_radar_api/v1/popular_trend/hashtag/list');
  url.searchParams.set('page', '1');
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('period', String(target.period));
  url.searchParams.set('country_code', target.countryCode);
  url.searchParams.set('industryIds', target.industryIds);
  url.searchParams.set('keyword', target.keyword);
  url.searchParams.set('filterBy', target.filterBy);
  return url.toString();
}

function buildDetailPageUrl(target: TikTokHashtagTarget, hashtagName: string) {
  const url = new URL(
    `https://ads.tiktok.com/business/creativecenter/hashtag/${encodeURIComponent(hashtagName)}/pc/${target.locale}`,
  );
  url.searchParams.set('countryCode', target.countryCode);
  url.searchParams.set('period', String(target.period));
  return url.toString();
}

function captureApiHeaders(headers: Record<string, string | undefined>): TikTokHashtagApiHeaders | null {
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

function normalizeCountryOptions(response: TikTokFiltersResponse): TikTokHashtagCountryOption[] {
  return (response.data?.country ?? [])
    .map((country) => {
      const countryCode = country.id?.trim().toUpperCase() ?? '';
      const countryName = country.value?.trim() ?? '';
      if (!countryCode || !countryName) return null;
      return { countryCode, countryName } satisfies TikTokHashtagCountryOption;
    })
    .filter((item): item is TikTokHashtagCountryOption => item !== null);
}

async function bootstrapApiAccess(page: Page, locale: string, timeoutMs: number, waitAfterLoadMs: number) {
  let apiHeaders: TikTokHashtagApiHeaders | null = null;
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
    throw new TikTokHashtagCrawlerError(
      'session_bootstrap_failed',
      `Failed to open TikTok hashtag bootstrap page: ${toErrorText(error)}`,
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
    throw new TikTokHashtagCrawlerError(
      'api_header_capture_failed',
      'TikTok hashtag API headers were not captured from the bootstrap page.',
    );
  }
  const resolvedApiHeaders = apiHeaders;

  const filtersResponse = await page.evaluate(
    async (input: { headers: TikTokHashtagApiHeaders; url: string }) => {
      const apiHeaders = input.headers;
      const response = await fetch(input.url, {
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

      const json = (await response.json()) as TikTokFiltersResponse;
      return {
        status: response.status,
        json,
      };
    },
    {
      headers: resolvedApiHeaders,
      url: `https://ads.tiktok.com${FILTERS_API_PATH}`,
    },
  );

  let filtersJson: TikTokFiltersResponse;
  try {
    filtersJson = filtersResponse.json;
  } catch (error) {
    throw new TikTokHashtagCrawlerError(
      'filters_fetch_failed',
      `Failed to parse TikTok hashtag filters response: ${toErrorText(error)}`,
    );
  }

  if (filtersResponse.status !== 200 || filtersJson.code !== 0) {
    throw new TikTokHashtagCrawlerError(
      'filters_fetch_failed',
      `TikTok hashtag filters returned status=${filtersResponse.status} code=${filtersJson.code ?? 'unknown'} msg=${filtersJson.msg ?? 'n/a'}`,
    );
  }

  return {
    apiHeaders,
    availableCountries: normalizeCountryOptions(filtersJson),
    bootstrapUrl: page.url(),
  };
}

async function fetchListResponse(page: Page, target: TikTokHashtagTarget, headers: TikTokHashtagApiHeaders, limit: number) {
  const listApiUrl = buildListApiUrl(target, limit);
  const response = await page.evaluate(
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

      const json = (await response.json()) as TikTokListApiResponse;
      return {
        status: response.status,
        json,
      };
    },
    {
      url: listApiUrl,
      headers,
    },
  );

  if (response.status !== 200 || response.json.code !== 0) {
    throw new TikTokHashtagCrawlerError(
      'list_fetch_failed',
      `TikTok hashtag list failed for country=${target.countryCode} status=${response.status} code=${response.json.code ?? 'unknown'} msg=${response.json.msg ?? 'n/a'}`,
    );
  }

  return {
    listApiUrl,
    data: response.json,
  };
}

function mapCreatorPreview(creators: TikTokListApiRecord['creators']) {
  return (creators ?? [])
    .map((creator) => {
      const nickName = creator.nick_name?.trim() || creator.nickName?.trim() || '';
      if (!nickName) return null;
      return {
        nickName,
        avatarUrl: creator.avatar_url?.trim() || creator.avatarUrl?.trim() || null,
      } satisfies TikTokHashtagCreatorPreview;
    })
    .filter((item): item is TikTokHashtagCreatorPreview => item !== null);
}

function mapListItems(target: TikTokHashtagTarget, records: TikTokListApiRecord[]): TikTokHashtagItem[] {
  return records
    .map((record) => {
      const hashtagId = record.hashtag_id?.trim() || record.hashtagId?.trim() || '';
      const hashtagName = record.hashtag_name?.trim() || record.hashtagName?.trim() || '';
      const rank = Number(record.rank);
      if (!hashtagId || !hashtagName || !Number.isFinite(rank)) {
        return null;
      }

      return {
        rank,
        hashtagId,
        hashtagName,
        publishCount: Number.isFinite(record.publish_cnt) ? Number(record.publish_cnt) : Number.isFinite(record.publishCnt) ? Number(record.publishCnt) : null,
        videoViews: Number.isFinite(record.video_views) ? Number(record.video_views) : Number.isFinite(record.videoViews) ? Number(record.videoViews) : null,
        rankDiff: Number.isFinite(record.rank_diff) ? Number(record.rank_diff) : Number.isFinite(record.rankDiff) ? Number(record.rankDiff) : null,
        rankDiffType:
          Number.isFinite(record.rank_diff_type) ? Number(record.rank_diff_type) : Number.isFinite(record.rankDiffType) ? Number(record.rankDiffType) : null,
        countryCode: target.countryCode,
        countryName: target.countryName,
        industryName: record.industry_info?.value?.trim() || record.industryInfo?.value?.trim() || null,
        trendPoints: Array.isArray(record.trend) ? record.trend : [],
        creatorPreview: mapCreatorPreview(record.creators),
        detailPageUrl: buildDetailPageUrl(target, hashtagName),
      } satisfies TikTokHashtagItem;
    })
    .filter((item): item is TikTokHashtagItem => item !== null);
}

async function enrichDetail(detailPage: Page, item: TikTokHashtagItem, timeoutMs: number, waitAfterLoadMs: number): Promise<TikTokHashtagDetail> {
  const captures: Array<{ url: string; body: string }> = [];
  const onResponse = async (response: Awaited<ReturnType<Page['waitForResponse']>>) => {
    const url = response.url();
    if (!url.includes('/creative_radar_api/v1/popular_trend/hashtag/')) {
      return;
    }

    try {
      captures.push({
        url,
        body: await response.text(),
      });
    } catch {
      captures.push({ url, body: '' });
    }
  };

  detailPage.on('response', onResponse);

  try {
    await detailPage.goto(item.detailPageUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    if (waitAfterLoadMs > 0) {
      await sleep(waitAfterLoadMs);
    }

    const detailData = await detailPage.evaluate(() => {
      const bodyText = document.body.innerText.replace(/\s+/g, ' ').trim();
      const relatedHashtags = Array.from(document.querySelectorAll('a[href*="/business/creativecenter/hashtag/"]'))
        .map((node) => node.textContent?.replace(/\s+/g, ' ').trim() ?? '')
        .filter((value) => value.startsWith('#'));
      const postsMatch = bodyText.match(/Posts\s+(.+?)\s+Overall/i);
      const overallMatch = bodyText.match(/(\d+(?:\.\d+)?[KMB]?)\s+Overall/i);

      return {
        postsLastPeriodText: postsMatch?.[1]?.trim() ?? null,
        postsOverallText: overallMatch?.[1]?.trim() ?? null,
        relatedHashtags,
      };
    });

    const creatorCapture = captures.find((entry) => entry.url.includes('/popular_trend/hashtag/creator?'));
    let creatorNames: string[] = [];
    if (creatorCapture?.body) {
      try {
        const parsed = JSON.parse(creatorCapture.body) as {
          data?: { creators?: Array<{ nick_name?: string }> };
        };
        creatorNames = (parsed.data?.creators ?? [])
          .map((creator) => creator.nick_name?.trim())
          .filter((value): value is string => Boolean(value));
      } catch {
        creatorNames = [];
      }
    }

    return {
      postsLastPeriodText: detailData.postsLastPeriodText,
      postsOverallText: detailData.postsOverallText,
      relatedHashtags: detailData.relatedHashtags,
      creatorNames,
      creatorCount: creatorNames.length,
      requestUrls: captures.map((entry) => entry.url),
    } satisfies TikTokHashtagDetail;
  } finally {
    detailPage.off('response', onResponse);
  }
}

export async function crawlTikTokHashtagTargets(params: {
  targets: TikTokHashtagTarget[];
  snapshotHour: string;
  headless?: boolean;
  timeoutMs?: number;
  waitAfterLoadMs?: number;
  limit?: number;
  detailLimit?: number;
  onTargetComplete?: (result: TikTokHashtagTargetResult) => void | Promise<void>;
}) {
  const {
    targets,
    snapshotHour,
    headless = true,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    waitAfterLoadMs = DEFAULT_WAIT_AFTER_LOAD_MS,
    limit = DEFAULT_LIMIT,
    detailLimit = DEFAULT_DETAIL_LIMIT,
    onTargetComplete,
  } = params;

  if (!targets.length) {
    return {
      availableCountries: [] as TikTokHashtagCountryOption[],
      results: [] as TikTokHashtagTargetResult[],
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

    const results: TikTokHashtagTargetResult[] = [];
    for (const target of targets) {
      const targetStartedAt = Date.now();
      let fetchListMs = 0;
      let enrichDetailsMs = 0;
      let listApiUrl: string | null = null;

      try {
        const fetchStartedAt = Date.now();
        const listResponse = await fetchListResponse(page, target, bootstrap.apiHeaders, limit);
        fetchListMs = Date.now() - fetchStartedAt;
        listApiUrl = listResponse.listApiUrl;

        const items = mapListItems(target, listResponse.data.data?.list ?? []);
        if (!items.length) {
          throw new TikTokHashtagCrawlerError(
            'list_data_empty',
            `TikTok hashtag list returned no items for country=${target.countryCode}.`,
          );
        }

        const warnings: string[] = [];
        let detailEnrichedCount = 0;
        if (detailLimit > 0) {
          const detailPage = await context.newPage();
          try {
            const detailStartedAt = Date.now();
            for (const item of items.slice(0, Math.min(detailLimit, items.length))) {
              try {
                item.detail = await enrichDetail(detailPage, item, timeoutMs, waitAfterLoadMs);
                detailEnrichedCount += 1;
              } catch (error) {
                warnings.push(`detail country=${target.countryCode} hashtag=#${item.hashtagName}: ${toErrorText(error)}`);
              }
            }
            enrichDetailsMs = Date.now() - detailStartedAt;
          } finally {
            await detailPage.close().catch(() => {});
          }
        }

        const result = {
          status: 'success',
          snapshotHour,
          countryCode: target.countryCode,
          countryName: target.countryName,
          sourceUrl: bootstrap.bootstrapUrl,
          listApiUrl,
          timingsMs: buildTimings(targetStartedAt, bootstrapMs, fetchListMs, enrichDetailsMs),
          items,
          detailEnrichedCount,
          warnings,
        } satisfies TikTokHashtagTargetResult;
        results.push(result);
        await onTargetComplete?.(result);
      } catch (error) {
        const failureResult = {
          status: 'failed',
          snapshotHour,
          countryCode: target.countryCode,
          countryName: target.countryName,
          sourceUrl: bootstrap.bootstrapUrl,
          listApiUrl,
          timingsMs: buildTimings(targetStartedAt, bootstrapMs, fetchListMs, enrichDetailsMs),
          errorCode: getFailureCode(error, 'unknown'),
          error: toErrorText(error),
        } satisfies TikTokHashtagTargetResult;
        results.push(failureResult);
        await onTargetComplete?.(failureResult);
      }
    }

    return {
      availableCountries: bootstrap.availableCountries,
      results,
      bootstrapUrl: bootstrap.bootstrapUrl,
    };
  } finally {
    await context?.close().catch(() => {});
    await browser?.close().catch(() => {});
  }
}
