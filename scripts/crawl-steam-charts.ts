import process from 'node:process';
import { loadScriptEnv } from './_shared/load-env';
import { parseEnumList, parseSnapshotHourArg } from './_shared/cli-parsers';
import { SteamChartsCrawler } from '../src/lib/steam/crawler';
import { saveSteamChartSnapshot } from '../src/lib/steam/db';
import { STEAM_CHART_TYPES, type SteamChartType } from '../src/lib/steam/types';
import { parseSnapshotHour, toSnapshotHour } from '../src/lib/youtube-hot/time';

loadScriptEnv();

const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [1000, 3000, 5000];

function parseCliArgs(argv: string[]) {
  const chartsInlineArg = argv.find((arg) => arg.startsWith('--charts='))?.split('=')[1];
  const chartsFlagIndex = argv.findIndex((arg) => arg === '--charts');
  const chartsArg =
    chartsInlineArg ||
    (chartsFlagIndex >= 0 && chartsFlagIndex < argv.length - 1 ? argv[chartsFlagIndex + 1] : undefined);

  return {
    dryRun: argv.includes('--dry-run'),
    snapshotHour: parseSnapshotHourArg(argv, {
      parseSnapshotHour,
      toSnapshotHour,
      example: '2026-04-01 12:00:00',
    }),
    chartTypes: parseEnumList(chartsArg, STEAM_CHART_TYPES) ?? [...STEAM_CHART_TYPES],
  } satisfies {
    dryRun: boolean;
    snapshotHour: string;
    chartTypes: SteamChartType[];
  };
}

async function delay(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(crawler: SteamChartsCrawler, chartType: SteamChartType, snapshotHour: string) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt += 1) {
    try {
      return await crawler.fetchChart(chartType, snapshotHour);
    } catch (error) {
      lastError = error;
      if (attempt > MAX_RETRIES) {
        break;
      }

      const delayMs = RETRY_DELAYS_MS[Math.min(attempt - 1, RETRY_DELAYS_MS.length - 1)];
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`chart=${chartType} attempt=${attempt}/${MAX_RETRIES + 1} failed: ${message}; retrying in ${delayMs}ms`);
      await delay(delayMs);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function main() {
  const options = parseCliArgs(process.argv.slice(2));
  const crawler = new SteamChartsCrawler();
  const failures: Array<{ chartType: SteamChartType; errorText: string }> = [];
  let successCount = 0;

  console.log(`snapshotHour=${options.snapshotHour} dryRun=${options.dryRun} charts=${options.chartTypes.join(',')}`);

  for (const chartType of options.chartTypes) {
    try {
      const snapshot = await fetchWithRetry(crawler, chartType, options.snapshotHour);
      console.log(
        `chart=${chartType}, fetchedAt=${snapshot.fetchedAt}, itemCount=${snapshot.items.length}, top=${snapshot.items[0]?.gameName ?? 'N/A'}`,
      );

      if (!options.dryRun) {
        const snapshotId = await saveSteamChartSnapshot(snapshot);
        console.log(`stored snapshot id=${snapshotId} chart=${chartType} snapshotHour=${snapshot.snapshotHour}`);
      }

      successCount += 1;
    } catch (error) {
      const errorText = error instanceof Error ? error.message : String(error);
      failures.push({ chartType, errorText });
      console.error(`chart=${chartType} failed after ${MAX_RETRIES + 1} attempts: ${errorText}`);
    }
  }

  if (options.dryRun) {
    console.log('dry-run complete, no database writes');
  }

  console.log(`summary success=${successCount} failed=${failures.length} total=${options.chartTypes.length}`);
  for (const failure of failures) {
    console.log(`failure chart=${failure.chartType} error=${failure.errorText}`);
  }

  if (failures.length > 0) {
    throw new Error(`crawl-steam-charts completed with ${failures.length} failed charts`);
  }
}

main().catch((error) => {
  console.error('crawl-steam-charts failed:', error);
  process.exit(1);
});
