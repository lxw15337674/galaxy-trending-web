import { existsSync } from 'node:fs';
import { config as loadEnv } from 'dotenv';
import { chromium, type Browser, type BrowserContext, type LaunchOptions, type Page } from 'playwright-core';

loadEnv({ path: '.env' });
loadEnv({ path: '.env.local', override: true });
loadEnv({ path: '.dev.vars', override: true });

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

interface CliOptions {
  countryCode: string;
  period: number;
  limit: number;
  locale: string;
  headless: boolean;
  detail: boolean;
  browserExecutablePath?: string;
}

interface HashtagTrendPoint {
  time: number;
  value: number;
}

interface HashtagCreatorPreview {
  nickName?: string;
  avatarUrl?: string;
}

interface HashtagListItem {
  rank: number;
  hashtagId: string;
  hashtagName: string;
  publishCnt: number | null;
  videoViews: number | null;
  rankDiff: number | null;
  rankDiffType: number | null;
  trend: HashtagTrendPoint[];
  creators: HashtagCreatorPreview[];
  countryCode: string;
  detailPageUrl: string;
}

interface DetailCapture {
  postsLastPeriodText: string | null;
  postsOverallText: string | null;
  topRegions: Array<{ rank: number; region: string; score: string }>;
  relatedHashtags: string[];
  creatorCount: number;
  creatorNames: string[];
  requestUrls: string[];
}

function parsePositiveNumber(rawValue: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) return fallback;
  const normalized = Math.floor(parsed);
  if (normalized < min) return min;
  if (normalized > max) return max;
  return normalized;
}

function parseCliArgs(): CliOptions {
  const args = process.argv.slice(2);
  const countryCode = (
    args.find((arg) => arg.startsWith('--country='))?.split('=')[1] ??
    process.env.TIKTOK_TREND_TEST_COUNTRY ??
    'US'
  )
    .trim()
    .toUpperCase();
  const period = parsePositiveNumber(
    args.find((arg) => arg.startsWith('--period='))?.split('=')[1] ?? process.env.TIKTOK_TREND_TEST_PERIOD,
    7,
    1,
    365,
  );
  const limit = parsePositiveNumber(
    args.find((arg) => arg.startsWith('--limit='))?.split('=')[1] ?? process.env.TIKTOK_TREND_TEST_LIMIT,
    20,
    1,
    100,
  );
  const locale = (
    args.find((arg) => arg.startsWith('--locale='))?.split('=')[1] ??
    process.env.TIKTOK_TREND_TEST_LOCALE ??
    'en'
  ).trim();
  const browserExecutablePath =
    args.find((arg) => arg.startsWith('--browser-executable-path='))?.split('=')[1] ??
    process.env.TIKTOK_TREND_BROWSER_EXECUTABLE_PATH;

  return {
    countryCode,
    period,
    limit,
    locale,
    headless: !args.includes('--headed'),
    detail: !args.includes('--no-detail'),
    browserExecutablePath: browserExecutablePath?.trim() || undefined,
  };
}

function resolveBrowserExecutablePath(explicitPath?: string) {
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

function getLaunchOptions(options: CliOptions): LaunchOptions {
  const executablePath = resolveBrowserExecutablePath(options.browserExecutablePath);
  const launchOptions: LaunchOptions = {
    headless: options.headless,
    args: ['--disable-blink-features=AutomationControlled'],
  };

  if (executablePath) {
    launchOptions.executablePath = executablePath;
  }

  return launchOptions;
}

function getListPageUrl(options: CliOptions) {
  const url = new URL(`https://ads.tiktok.com/business/creativecenter/inspiration/popular/hashtag/pc/${options.locale}`);
  url.searchParams.set('countryCode', options.countryCode);
  url.searchParams.set('period', String(options.period));
  return url.toString();
}

function getDetailPageUrl(options: CliOptions, hashtagName: string) {
  const url = new URL(
    `https://ads.tiktok.com/business/creativecenter/hashtag/${encodeURIComponent(hashtagName)}/pc/${options.locale}`,
  );
  url.searchParams.set('countryCode', options.countryCode);
  url.searchParams.set('period', String(options.period));
  return url.toString();
}

async function openBrowser(options: CliOptions): Promise<{ browser: Browser; context: BrowserContext; page: Page }> {
  const browser = await chromium.launch(getLaunchOptions(options));
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1200 },
    locale: 'en-US',
    userAgent: DEFAULT_USER_AGENT,
  });
  const page = await context.newPage();
  return { browser, context, page };
}

async function waitForListData(page: Page) {
  await page.waitForFunction(() => {
    const nextData = (window as { __NEXT_DATA__?: unknown }).__NEXT_DATA__ as
      | {
          props?: {
            pageProps?: {
              dehydratedState?: {
                queries?: Array<{
                  queryKey?: unknown;
                  state?: { data?: unknown };
                }>;
              };
            };
          };
        }
      | undefined;

    const queries = nextData?.props?.pageProps?.dehydratedState?.queries ?? [];
    return queries.some((query) => JSON.stringify(query.queryKey ?? []).includes('"trend","hashtag","list"'));
  });
}

async function extractListItems(page: Page, options: CliOptions): Promise<HashtagListItem[]> {
  return page.evaluate(
    ({ countryCode, limit, locale, period }) => {
      const nextData = (window as { __NEXT_DATA__?: unknown }).__NEXT_DATA__ as
        | {
            props?: {
              pageProps?: {
                dehydratedState?: {
                  queries?: Array<{
                    queryKey?: unknown;
                    state?: { data?: { pages?: Array<{ list?: unknown[] }> } };
                  }>;
                };
              };
            };
          }
        | undefined;

      const queries = nextData?.props?.pageProps?.dehydratedState?.queries ?? [];
      const listQuery = queries.find((query) => JSON.stringify(query.queryKey ?? []).includes('"trend","hashtag","list"'));
      const pages = listQuery?.state?.data?.pages ?? [];
      const rawItems = pages.flatMap((item) => item.list ?? []);

      return rawItems.slice(0, limit).map((item) => {
        const record = item as {
          rank?: number;
          hashtagId?: string;
          hashtagName?: string;
          publishCnt?: number;
          videoViews?: number;
          rankDiff?: number;
          rankDiffType?: number;
          trend?: HashtagTrendPoint[];
          creators?: HashtagCreatorPreview[];
        };

        const hashtagName = record.hashtagName ?? '';

        return {
          rank: record.rank ?? 0,
          hashtagId: record.hashtagId ?? '',
          hashtagName,
          publishCnt: Number.isFinite(record.publishCnt) ? Number(record.publishCnt) : null,
          videoViews: Number.isFinite(record.videoViews) ? Number(record.videoViews) : null,
          rankDiff: Number.isFinite(record.rankDiff) ? Number(record.rankDiff) : null,
          rankDiffType: Number.isFinite(record.rankDiffType) ? Number(record.rankDiffType) : null,
          trend: Array.isArray(record.trend) ? record.trend : [],
          creators: Array.isArray(record.creators) ? record.creators : [],
          countryCode,
          detailPageUrl: `https://ads.tiktok.com/business/creativecenter/hashtag/${encodeURIComponent(hashtagName)}/pc/${locale}?countryCode=${countryCode}&period=${period}`,
        } satisfies HashtagListItem;
      });
    },
    {
      countryCode: options.countryCode,
      limit: options.limit,
      locale: options.locale,
      period: options.period,
    },
  );
}

async function extractDetailData(page: Page, detailPageUrl: string): Promise<DetailCapture> {
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
      captures.push({
        url,
        body: '',
      });
    }
  };

  page.on('response', onResponse);
  try {
    await page.goto(detailPageUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForTimeout(4_000);

    const pageData = await page.evaluate(() => {
      const metricRows = Array.from(document.querySelectorAll('*'))
        .map((node) => node.textContent?.replace(/\s+/g, ' ').trim() ?? '')
        .filter(Boolean);
      const bodyText = document.body.innerText.replace(/\s+/g, ' ').trim();

      const topRegions: Array<{ rank: number; region: string; score: string }> = [];
      const relatedHashtags = Array.from(document.querySelectorAll('a[href*="/business/creativecenter/hashtag/"]'))
        .map((node) => node.textContent?.replace(/\s+/g, ' ').trim() ?? '')
        .filter((value) => value.startsWith('#'));

      const topRegionContainer = Array.from(document.querySelectorAll('*')).find((node) =>
        node.textContent?.includes('Top regions'),
      );
      if (topRegionContainer) {
        const entries = Array.from(topRegionContainer.parentElement?.querySelectorAll('*') ?? []);
        const texts = entries
          .map((node) => node.textContent?.replace(/\s+/g, ' ').trim() ?? '')
          .filter(Boolean);

        for (let index = 0; index + 2 < texts.length && topRegions.length < 5; index += 3) {
          const rank = Number(texts[index]);
          const region = texts[index + 1];
          const score = texts[index + 2];
          if (Number.isFinite(rank) && region && score) {
            topRegions.push({ rank, region, score });
          }
        }
      }

      const postsMatch = bodyText.match(/Posts\s+(.+?)\s+Overall/i);
      const postsLastPeriodText = postsMatch?.[1]?.trim() ?? null;
      const overallMatch = bodyText.match(/(\d+(?:\.\d+)?[KMB]?)\s+Overall/i);
      const postsOverallText = overallMatch?.[1]?.trim() ?? null;

      return {
        postsLastPeriodText,
        postsOverallText,
        topRegions,
        relatedHashtags,
      };
    });

    const creatorCapture = captures.find((item) => item.url.includes('/popular_trend/hashtag/creator?'));
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
      postsLastPeriodText: pageData.postsLastPeriodText,
      postsOverallText: pageData.postsOverallText,
      topRegions: pageData.topRegions,
      relatedHashtags: pageData.relatedHashtags,
      creatorCount: creatorNames.length,
      creatorNames,
      requestUrls: captures.map((item) => item.url),
    };
  } finally {
    page.off('response', onResponse);
  }
}

function formatCount(value: number | null) {
  if (value == null) return 'n/a';
  return value.toLocaleString('en-US');
}

async function main() {
  const options = parseCliArgs();
  const { browser, context, page } = await openBrowser(options);

  try {
    const listPageUrl = getListPageUrl(options);
    console.log(`open list page: ${listPageUrl}`);
    await page.goto(listPageUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await waitForListData(page);
    await page.waitForTimeout(2_000);

    const listItems = await extractListItems(page, options);
    if (!listItems.length) {
      throw new Error('No hashtag items found in __NEXT_DATA__.');
    }

    console.log(`list items extracted: ${listItems.length}`);
    listItems.slice(0, Math.min(5, listItems.length)).forEach((item) => {
      console.log(
        [
          `rank=${item.rank}`,
          `hashtag=#${item.hashtagName}`,
          `posts=${formatCount(item.publishCnt)}`,
          `views=${formatCount(item.videoViews)}`,
          `rankDiff=${item.rankDiff ?? 'n/a'}`,
          `trendPoints=${item.trend.length}`,
          `creatorPreview=${item.creators.length}`,
        ].join(' | '),
      );
    });

    if (!options.detail) {
      return;
    }

    const detailPage = await context.newPage();
    const firstItem = listItems.find((item) => item.creators.length > 0) ?? listItems[0];
    const detailPageUrl = getDetailPageUrl(options, firstItem.hashtagName);
    console.log(`open detail page: ${detailPageUrl}`);
    const detail = await extractDetailData(detailPage, detailPageUrl);

    console.log(
      JSON.stringify(
        {
          hashtag: `#${firstItem.hashtagName}`,
          postsLastPeriodText: detail.postsLastPeriodText,
          postsOverallText: detail.postsOverallText,
          topRegions: detail.topRegions,
          relatedHashtags: detail.relatedHashtags.slice(0, 5),
          creatorCount: detail.creatorCount,
          creatorNames: detail.creatorNames.slice(0, 5),
          requestUrls: detail.requestUrls,
        },
        null,
        2,
      ),
    );

    await detailPage.close();
  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch((error) => {
  console.error('spike-tiktok-hashtag-trends failed:', error);
  process.exit(1);
});
