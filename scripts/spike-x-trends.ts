import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium, type Browser, type BrowserContext, type Page, type Response } from 'playwright-core';

interface CliOptions {
  headless: boolean;
  timeoutMs: number;
  userDataDir: string;
  outFile: string;
  locale: string;
  storageStateFile: string | null;
}

interface TrendItem {
  rank: number;
  name: string;
  query: string | null;
  url: string | null;
  meta: string | null;
  tweetVolume: number | null;
  raw: unknown;
}

interface TimelineInstruction {
  entries?: unknown[];
  addEntries?: unknown[];
}

interface TrendExtractionResult {
  pageUrl: string;
  extractedAt: string;
  source: 'network' | 'dom';
  trendCount: number;
  trends: TrendItem[];
}

const DEFAULT_TIMEOUT_MS = 45_000;
const DEFAULT_LOCALE = 'zh-CN';
const EDGE_EXECUTABLE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

function parseCliArgs(): CliOptions {
  const args = process.argv.slice(2);
  const headless = !args.includes('--headed');
  const timeoutArg = args.find((arg) => arg.startsWith('--timeout-ms='))?.split('=')[1];
  const timeoutMs = Number(timeoutArg);
  const normalizedTimeoutMs =
    Number.isFinite(timeoutMs) && timeoutMs >= 5_000 ? Math.floor(timeoutMs) : DEFAULT_TIMEOUT_MS;

  const userDataDirArg = args.find((arg) => arg.startsWith('--user-data-dir='))?.split('=')[1];
  const outFileArg = args.find((arg) => arg.startsWith('--out-file='))?.split('=')[1];
  const localeArg = args.find((arg) => arg.startsWith('--locale='))?.split('=')[1];
  const storageStateArg = args.find((arg) => arg.startsWith('--storage-state='))?.split('=')[1];

  return {
    headless,
    timeoutMs: normalizedTimeoutMs,
    userDataDir: path.resolve(userDataDirArg || '.tmp/x-trends-edge-profile'),
    outFile: path.resolve(outFileArg || '.tmp/x-trends-sample.json'),
    locale: (localeArg || DEFAULT_LOCALE).trim() || DEFAULT_LOCALE,
    storageStateFile: storageStateArg ? path.resolve(storageStateArg) : null,
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatError(error: unknown) {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
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

    if (predicate(current)) {
      return current;
    }

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

function toTrendItems(rawItems: unknown[]): TrendItem[] {
  return rawItems
    .map((raw, index) => {
      const name = getTrendName(raw);
      if (!name) return null;

      return {
        rank: index + 1,
        name,
        query: getTrendQuery(raw),
        url: getTrendUrl(raw),
        meta: getTrendMeta(raw),
        tweetVolume: getTweetVolume(raw),
        raw,
      } satisfies TrendItem;
    })
    .filter((item): item is TrendItem => item !== null);
}

async function extractFromTimelineResponse(response: Response): Promise<TrendExtractionResult | null> {
  const url = response.url();
  if (!url.includes('GenericTimelineById') && !url.includes('ExplorePage')) {
    return null;
  }

  const contentType = response.headers()['content-type'] || '';
  if (!contentType.includes('application/json')) {
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
    (candidate): candidate is TimelineInstruction => !!candidate && typeof candidate === 'object' && ('entries' in (candidate as object) || 'addEntries' in (candidate as object)),
  );

  const searchRoot = instructions ?? payload;
  const trendObjects = collectTrendObjects(searchRoot);
  const trends = toTrendItems(trendObjects);
  if (!trends.length) return null;

  return {
    pageUrl: url,
    extractedAt: new Date().toISOString(),
    source: 'network',
    trendCount: trends.length,
    trends,
  };
}

async function extractFromDom(page: Page): Promise<TrendExtractionResult | null> {
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
    extractedAt: new Date().toISOString(),
    source: 'dom',
    trendCount: trends.length,
    trends,
  };
}

async function ensureDirectory(filePath: string) {
  await mkdir(path.dirname(filePath), { recursive: true });
}

async function createContext(options: CliOptions): Promise<{ browser: Browser | null; context: BrowserContext }> {
  const launchOptions = {
    executablePath: EDGE_EXECUTABLE_PATH,
    headless: options.headless,
    locale: options.locale,
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36 Edg/134.0.0.0',
    viewport: { width: 1440, height: 1600 },
    args: ['--disable-blink-features=AutomationControlled'] as string[],
  };

  if (options.storageStateFile) {
    const browser = await chromium.launch(launchOptions);
    const context = await browser.newContext({
      locale: options.locale,
      viewport: { width: 1440, height: 1600 },
      storageState: options.storageStateFile,
      userAgent: launchOptions.userAgent,
    });

    return { browser, context };
  }

  await mkdir(options.userDataDir, { recursive: true });
  const context = await chromium.launchPersistentContext(options.userDataDir, launchOptions);
  return { browser: null, context };
}

async function isLoggedIn(page: Page) {
  return page.evaluate(() => {
    const text = document.body.innerText || '';
    return !/登录|登入|sign in|log in|create account/i.test(text);
  });
}

async function main() {
  const options = parseCliArgs();
  console.log(`headless=${options.headless} timeoutMs=${options.timeoutMs}`);
  console.log(`userDataDir=${options.userDataDir}`);
  console.log(`outFile=${options.outFile}`);
  if (options.storageStateFile) {
    console.log(`storageStateFile=${options.storageStateFile}`);
  }

  const { browser, context } = await createContext(options);

  try {
    const page = context.pages()[0] ?? (await context.newPage());
    const networkHits: TrendExtractionResult[] = [];

    page.on('response', async (response) => {
      try {
        const extracted = await extractFromTimelineResponse(response);
        if (extracted) {
          networkHits.push(extracted);
        }
      } catch (error) {
        console.warn(`response parse failed: ${formatError(error)}`);
      }
    });

    await page.goto('https://x.com/explore/tabs/trending', {
      waitUntil: 'domcontentloaded',
      timeout: options.timeoutMs,
    });

    await page.waitForLoadState('networkidle', { timeout: options.timeoutMs }).catch(() => {});
    await sleep(5_000);

    const loggedIn = await isLoggedIn(page);
    const networkResult = networkHits.sort((left, right) => right.trendCount - left.trendCount)[0] ?? null;
    const domResult = await extractFromDom(page);
    const finalResult = networkResult ?? domResult;

    if (!finalResult) {
      throw new Error(
        `No trend data extracted. loggedIn=${loggedIn} currentUrl=${page.url()}. Try --headed for manual login bootstrap.`,
      );
    }

    await ensureDirectory(options.outFile);
    await writeFile(
      options.outFile,
      JSON.stringify(
        {
          ...finalResult,
          loggedIn,
          currentUrl: page.url(),
        },
        null,
        2,
      ),
      'utf8',
    );

    console.log(`source=${finalResult.source} trendCount=${finalResult.trendCount} loggedIn=${loggedIn}`);
    console.log(`sample=${finalResult.trends.slice(0, 5).map((item) => item.name).join(' | ')}`);
    console.log(`saved=${options.outFile}`);
  } finally {
    await context.close();
    await browser?.close();
  }
}

main().catch((error) => {
  console.error(formatError(error));
  process.exitCode = 1;
});
