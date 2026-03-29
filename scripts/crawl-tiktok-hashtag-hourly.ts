import { config as loadEnv } from 'dotenv';
import { crawlTikTokHashtagTargets } from '@/lib/tiktok-hashtag-trends/crawler';
import { loadTikTokHashtagTargetsFromEnv } from '@/lib/tiktok-hashtag-trends/targets';
import { parseSnapshotHour, toSnapshotHour } from '@/lib/tiktok-hashtag-trends/time';
import type { TikTokHashtagTarget, TikTokHashtagTargetResult } from '@/lib/tiktok-hashtag-trends/types';

loadEnv({ path: '.env' });
loadEnv({ path: '.env.local', override: true });
loadEnv({ path: '.dev.vars', override: true });

interface CliOptions {
  snapshotHour: string;
  countryCodes: string[] | null;
  limit: number;
  detailLimit: number;
  headless: boolean;
  timeoutMs: number;
  waitAfterLoadMs: number;
  jsonOnly: boolean;
}

function parsePositiveNumber(rawValue: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) return fallback;
  const normalized = Math.floor(parsed);
  if (normalized < min) return min;
  if (normalized > max) return max;
  return normalized;
}

function parseCountryList(rawValue: string | undefined) {
  if (!rawValue) return null;
  const countryCodes = Array.from(
    new Set(
      rawValue
        .split(',')
        .map((value) => value.trim().toUpperCase())
        .filter((value) => /^[A-Z]{2}$/.test(value)),
    ),
  );
  return countryCodes.length ? countryCodes : null;
}

function parseCliArgs(): CliOptions {
  const args = process.argv.slice(2);
  const hourArg = args.find((arg) => arg.startsWith('--hour='))?.split('=')[1];
  const snapshotHour = hourArg ? parseSnapshotHour(hourArg) : toSnapshotHour();
  if (!snapshotHour) {
    throw new Error('Invalid --hour format. Example: --hour=2026-03-29 17:00:00');
  }

  return {
    snapshotHour,
    countryCodes: parseCountryList(args.find((arg) => arg.startsWith('--countries='))?.split('=')[1]),
    limit: parsePositiveNumber(args.find((arg) => arg.startsWith('--limit='))?.split('=')[1], 20, 1, 100),
    detailLimit: parsePositiveNumber(
      args.find((arg) => arg.startsWith('--detail-limit='))?.split('=')[1],
      0,
      0,
      20,
    ),
    headless: !args.includes('--headed'),
    timeoutMs: parsePositiveNumber(args.find((arg) => arg.startsWith('--timeout-ms='))?.split('=')[1], 45_000, 5_000, 180_000),
    waitAfterLoadMs: parsePositiveNumber(
      args.find((arg) => arg.startsWith('--wait-after-load-ms='))?.split('=')[1],
      1_000,
      0,
      10_000,
    ),
    jsonOnly: args.includes('--json-only'),
  };
}

function filterTargets(targets: TikTokHashtagTarget[], countryCodes: string[] | null) {
  if (!countryCodes?.length) return targets;
  const allowed = new Set(countryCodes);
  return targets.filter((target) => allowed.has(target.countryCode));
}

function logTargetResult(result: TikTokHashtagTargetResult) {
  if (result.status === 'success') {
    console.log(
      [
        '[ok]',
        `country=${result.countryCode}`,
        `items=${result.items.length}`,
        `top=#${result.items[0]?.hashtagName ?? 'n/a'}`,
        `detailEnriched=${result.detailEnrichedCount}`,
        `fetchListMs=${result.timingsMs.fetchListMs}`,
        `totalMs=${result.timingsMs.totalMs}`,
      ].join(' '),
    );
    return;
  }

  console.log(
    [
      '[failed]',
      `country=${result.countryCode}`,
      `code=${result.errorCode}`,
      `fetchListMs=${result.timingsMs.fetchListMs}`,
      `totalMs=${result.timingsMs.totalMs}`,
      `error=${result.error}`,
    ].join(' '),
  );
}

async function main() {
  const options = parseCliArgs();
  const configuredTargets = loadTikTokHashtagTargetsFromEnv();
  const targets = filterTargets(configuredTargets, options.countryCodes);
  if (!targets.length) {
    throw new Error('No TikTok hashtag targets found after applying country filter.');
  }

  if (!options.jsonOnly) {
    console.log(
      [
        `snapshotHour=${options.snapshotHour}`,
        `countries=${targets.map((target) => target.countryCode).join(',')}`,
        `limit=${options.limit}`,
        `detailLimit=${options.detailLimit}`,
        `headless=${options.headless}`,
      ].join(' '),
    );
  }

  const crawlResult = await crawlTikTokHashtagTargets({
    targets,
    snapshotHour: options.snapshotHour,
    headless: options.headless,
    timeoutMs: options.timeoutMs,
    waitAfterLoadMs: options.waitAfterLoadMs,
    limit: options.limit,
    detailLimit: options.detailLimit,
    onTargetComplete: options.jsonOnly ? undefined : logTargetResult,
  });

  const summary = {
    snapshotHour: options.snapshotHour,
    bootstrapUrl: crawlResult.bootstrapUrl,
    availableCountryCount: crawlResult.availableCountries.length,
    targetCount: crawlResult.results.length,
    successCount: crawlResult.results.filter((result) => result.status === 'success').length,
    failedCount: crawlResult.results.filter((result) => result.status === 'failed').length,
  };

  let saveSummary:
    | {
        batchId: number;
        success: number;
        failed: number;
        batch: {
          snapshotHour: string;
          generatedAt: string;
          targetCountryCount: number;
          successCountryCount: number;
          failedCountryCount: number;
        };
      }
    | undefined;

  if (!options.jsonOnly) {
    const { saveTikTokHashtagHourlyResults } = await import('@/lib/tiktok-hashtag-trends/db');
    saveSummary = await saveTikTokHashtagHourlyResults(options.snapshotHour, crawlResult.results);
    console.log(
      [
        '[saved]',
        `batchId=${saveSummary.batchId}`,
        `snapshotHour=${saveSummary.batch.snapshotHour}`,
        `success=${saveSummary.success}`,
        `failed=${saveSummary.failed}`,
        `status=${saveSummary.batch.failedCountryCount === 0 ? 'published' : 'failed'}`,
      ].join(' '),
    );
  }

  const payload = {
    summary,
    saveSummary,
    availableCountries: crawlResult.availableCountries,
    results: crawlResult.results,
  };

  console.log(JSON.stringify(payload, null, 2));

  if (summary.failedCount > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('crawl-tiktok-hashtag-hourly failed:', error);
  process.exit(1);
});
