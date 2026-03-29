import type { YouTubeMusicChartsClient } from '../src/lib/youtube-music/client';
import type {
  YouTubeMusicDailyVideoSnapshot,
  YouTubeMusicShortsSongDailySnapshot,
  YouTubeMusicWeeklyChartSnapshot,
} from '../src/lib/youtube-music/types';

type SupportedSnapshot =
  | YouTubeMusicWeeklyChartSnapshot
  | YouTubeMusicDailyVideoSnapshot
  | YouTubeMusicShortsSongDailySnapshot;

interface CrawlCliOptions {
  dryRun: boolean;
  countriesArg?: string;
}

interface RunCrawlOptions<TSnapshot extends SupportedSnapshot> {
  scriptName: string;
  client: YouTubeMusicChartsClient;
  cliOptions: CrawlCliOptions;
  envCountries: string | undefined;
  discoverCountries?: () => Promise<string[]>;
  fetchSnapshot: (countryCode: string) => Promise<TSnapshot>;
  saveSnapshot: (snapshot: TSnapshot) => Promise<number>;
  topLabel: (snapshot: TSnapshot) => string;
}

const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [1000, 3000, 5000];

function normalizeCountryCode(value: string) {
  return value.trim().toLowerCase() === 'global' ? 'global' : value.trim().toUpperCase();
}

export function parseMusicCrawlerCliArgs(argv: string[]) {
  const countriesInlineArg = argv.find((arg) => arg.startsWith('--countries='))?.split('=')[1];
  const countriesFlagIndex = argv.findIndex((arg) => arg === '--countries');
  const countriesArg =
    countriesInlineArg ||
    (countriesFlagIndex >= 0 && countriesFlagIndex < argv.length - 1 ? argv[countriesFlagIndex + 1] : undefined);
  return {
    dryRun: argv.includes('--dry-run'),
    countriesArg: countriesArg?.trim() || undefined,
  } satisfies CrawlCliOptions;
}

export function parseCountryList(value: string | undefined) {
  if (!value) return [];

  return Array.from(
    new Set(
      value
        .split(/[,\s]+/)
        .map((part) => part.trim())
        .filter(Boolean)
        .map(normalizeCountryCode),
    ),
  );
}

async function delay(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function resolveTargetCountries(
  client: YouTubeMusicChartsClient,
  countriesArg?: string,
  envCountries?: string,
  discoverCountries?: () => Promise<string[]>,
) {
  const explicitCountries = parseCountryList(countriesArg || envCountries);
  if (explicitCountries.length > 0) {
    return explicitCountries;
  }

  if (discoverCountries) {
    return discoverCountries();
  }

  const discovered = await client.listAvailableChartCountries();
  return discovered.map((entry) => entry.countryCode);
}

async function fetchWithRetry<TSnapshot extends SupportedSnapshot>(
  countryCode: string,
  fetchSnapshot: (countryCode: string) => Promise<TSnapshot>,
) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt += 1) {
    try {
      return await fetchSnapshot(countryCode);
    } catch (error) {
      lastError = error;
      if (attempt > MAX_RETRIES) {
        break;
      }

      const delayMs = RETRY_DELAYS_MS[Math.min(attempt - 1, RETRY_DELAYS_MS.length - 1)];
      const message = error instanceof Error ? error.message : String(error);
      console.warn(
        `country=${countryCode} attempt=${attempt}/${MAX_RETRIES + 1} failed: ${message}; retrying in ${delayMs}ms`,
      );
      await delay(delayMs);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export async function runYouTubeMusicSerialCrawl<TSnapshot extends SupportedSnapshot>({
  scriptName,
  client,
  cliOptions,
  envCountries,
  discoverCountries,
  fetchSnapshot,
  saveSnapshot,
  topLabel,
}: RunCrawlOptions<TSnapshot>) {
  const countries = await resolveTargetCountries(client, cliOptions.countriesArg, envCountries, discoverCountries);
  console.log(`targetCountryCount=${countries.length} countries=${countries.join(',')}`);

  const failures: Array<{ countryCode: string; errorText: string }> = [];
  let successCount = 0;

  for (const countryCode of countries) {
    try {
      const snapshot = await fetchWithRetry(countryCode, fetchSnapshot);
      console.log(
        `country=${snapshot.countryCode}, chartEndDate=${snapshot.chartEndDate}, fetchedAt=${snapshot.fetchedAt}, itemCount=${snapshot.items.length}, top=${topLabel(snapshot)}`,
      );

      if (!cliOptions.dryRun) {
        const snapshotId = await saveSnapshot(snapshot);
        console.log(
          `stored snapshot id=${snapshotId} country=${snapshot.countryCode} chartEndDate=${snapshot.chartEndDate} itemCount=${snapshot.items.length}`,
        );
      }

      successCount += 1;
    } catch (error) {
      const errorText = error instanceof Error ? error.message : String(error);
      failures.push({ countryCode, errorText });
      console.error(`country=${countryCode} failed after ${MAX_RETRIES + 1} attempts: ${errorText}`);
    }
  }

  if (cliOptions.dryRun) {
    console.log('dry-run complete, no database writes');
  }

  console.log(`summary success=${successCount} failed=${failures.length} total=${countries.length}`);
  for (const failure of failures) {
    console.log(`failure country=${failure.countryCode} error=${failure.errorText}`);
  }

  if (failures.length > 0) {
    throw new Error(`${scriptName} completed with ${failures.length} failed countries`);
  }
}
