import { config as loadEnv } from 'dotenv';
import { parseSnapshotHour, toSnapshotHour } from '@/lib/tiktok-hashtag-trends/time';
import { crawlTikTokVideoTargets } from '@/lib/tiktok-videos/crawler';
import { saveTikTokVideoHourlyResults } from '@/lib/tiktok-videos/db';
import { loadTikTokVideoTargetsFromEnv } from '@/lib/tiktok-videos/targets';
import type { TikTokVideoOrderBy, TikTokVideoTarget, TikTokVideoTargetResult } from '@/lib/tiktok-videos/types';

loadEnv({ path: '.env' });
loadEnv({ path: '.env.local', override: true });
loadEnv({ path: '.dev.vars', override: true });

interface CliOptions {
  snapshotHour: string;
  countryCodes: string[] | null;
  periods: number[] | null;
  sorts: TikTokVideoOrderBy[] | null;
  limit: number;
  maxPages: number;
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

function parsePeriodList(rawValue: string | undefined) {
  if (!rawValue) return null;
  const periods = Array.from(
    new Set(
      rawValue
        .split(',')
        .map((value) => Number(value.trim()))
        .filter((value) => Number.isFinite(value))
        .map((value) => Math.floor(value))
        .filter((value) => value > 0 && value <= 365),
    ),
  );
  return periods.length ? periods : null;
}

function parseSortList(rawValue: string | undefined) {
  if (!rawValue) return null;
  const allowed = new Set<TikTokVideoOrderBy>(['vv', 'like', 'comment', 'repost']);
  const sorts = Array.from(
    new Set(
      rawValue
        .split(',')
        .map((value) => value.trim().toLowerCase())
        .filter((value): value is TikTokVideoOrderBy => allowed.has(value as TikTokVideoOrderBy)),
    ),
  );
  return sorts.length ? sorts : null;
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
    periods: parsePeriodList(args.find((arg) => arg.startsWith('--periods='))?.split('=')[1]),
    sorts: parseSortList(args.find((arg) => arg.startsWith('--sorts='))?.split('=')[1]),
    limit: parsePositiveNumber(args.find((arg) => arg.startsWith('--limit='))?.split('=')[1], 20, 1, 20),
    maxPages: parsePositiveNumber(args.find((arg) => arg.startsWith('--max-pages='))?.split('=')[1], 5, 1, 25),
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

function filterTargets(
  targets: TikTokVideoTarget[],
  countryCodes: string[] | null,
  periods: number[] | null,
  sorts: TikTokVideoOrderBy[] | null,
) {
  const allowedCountries = countryCodes ? new Set(countryCodes) : null;
  const allowedPeriods = periods ? new Set(periods) : null;
  const allowedSorts = sorts ? new Set(sorts) : null;

  return targets
    .filter((target) => (allowedCountries ? allowedCountries.has(target.countryCode) : true))
    .map((target) => ({
      ...target,
      periods: target.periods.filter((period) => (allowedPeriods ? allowedPeriods.has(period) : true)),
      orderByList: target.orderByList.filter((sort) => (allowedSorts ? allowedSorts.has(sort) : true)),
    }))
    .filter((target) => target.periods.length > 0 && target.orderByList.length > 0);
}

function logTargetResult(result: TikTokVideoTargetResult) {
  if (result.status === 'success') {
    console.log(
      [
        '[ok]',
        `country=${result.countryCode}`,
        `period=${result.period}`,
        `sort=${result.orderBy}`,
        `items=${result.items.length}`,
        `pages=${result.pageCount}`,
        `top=${result.items[0]?.videoId ?? 'n/a'}`,
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
      `period=${result.period}`,
      `sort=${result.orderBy}`,
      `code=${result.errorCode}`,
      `fetchListMs=${result.timingsMs.fetchListMs}`,
      `totalMs=${result.timingsMs.totalMs}`,
      `error=${result.error}`,
    ].join(' '),
  );
}

async function main() {
  const options = parseCliArgs();
  const configuredTargets = loadTikTokVideoTargetsFromEnv();
  const targets = filterTargets(configuredTargets, options.countryCodes, options.periods, options.sorts);
  if (!targets.length) {
    throw new Error('No TikTok video targets found after applying CLI filters.');
  }

  if (!options.jsonOnly) {
    console.log(
      [
        `snapshotHour=${options.snapshotHour}`,
        `targets=${targets.map((target) => `${target.countryCode}:${target.periods.join('|')}:${target.orderByList.join('|')}`).join(',')}`,
        `limit=${options.limit}`,
        `maxPages=${options.maxPages}`,
        `headless=${options.headless}`,
      ].join(' '),
    );
  }

  const crawlResult = await crawlTikTokVideoTargets({
    targets,
    snapshotHour: options.snapshotHour,
    headless: options.headless,
    timeoutMs: options.timeoutMs,
    waitAfterLoadMs: options.waitAfterLoadMs,
    limit: options.limit,
    maxPages: options.maxPages,
    onTargetComplete: options.jsonOnly ? undefined : logTargetResult,
  });

  const summary = {
    snapshotHour: options.snapshotHour,
    bootstrapUrl: crawlResult.bootstrapUrl,
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
          targetScopeCount: number;
          successScopeCount: number;
          failedScopeCount: number;
        };
      }
    | undefined;

  if (!options.jsonOnly) {
    saveSummary = await saveTikTokVideoHourlyResults(options.snapshotHour, crawlResult.results);
    console.log(
      [
        '[saved]',
        `batchId=${saveSummary.batchId}`,
        `snapshotHour=${saveSummary.batch.snapshotHour}`,
        `success=${saveSummary.success}`,
        `failed=${saveSummary.failed}`,
        `status=${saveSummary.batch.successScopeCount > 0 ? 'published' : 'failed'}`,
      ].join(' '),
    );
  }

  console.log(
    JSON.stringify(
      {
        summary,
        saveSummary,
        results: crawlResult.results,
      },
      null,
      2,
    ),
  );

  if (summary.failedCount > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('crawl-tiktok-videos-hourly failed:', error);
  process.exit(1);
});
