import { config as loadEnv } from 'dotenv';
import { crawlXTrendTarget } from '../src/lib/x-trends/crawler';
import { loadXTrendTargetsFromEnv } from '../src/lib/x-trends/targets';
import { parseSnapshotHour, toSnapshotHour } from '../src/lib/x-trends/time';
import type { XTrendRegionResult, XTrendTarget } from '../src/lib/x-trends/types';

loadEnv({ path: '.env' });
loadEnv({ path: '.env.local', override: true });
loadEnv({ path: '.dev.vars', override: true });

interface CliOptions {
  snapshotHour: string;
  dryRun: boolean;
  headless: boolean;
  timeoutMs: number;
  waitAfterLoadMs: number;
  noRetry: boolean;
  retryDelayMs: number;
  regionKeys: string[] | null;
}

function parsePositiveNumber(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const normalized = Math.floor(parsed);
  if (normalized < min) return min;
  if (normalized > max) return max;
  return normalized;
}

function parseRegionList(value: string | undefined) {
  if (!value) return null;
  const regions = Array.from(
    new Set(
      value
        .split(',')
        .map((part) => part.trim().toLowerCase())
        .filter((part) => /^[a-z0-9_-]+$/.test(part)),
    ),
  );
  return regions.length ? regions : null;
}

function parseCliArgs(): CliOptions {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const headless = !args.includes('--headed');
  const noRetry = args.includes('--no-retry');

  const hourArg = args.find((arg) => arg.startsWith('--hour='))?.split('=')[1];
  const snapshotHour = hourArg ? parseSnapshotHour(hourArg) : toSnapshotHour();
  if (!snapshotHour) {
    throw new Error('Invalid --hour format. Example: --hour=2026-03-28 11:00:00');
  }

  const timeoutMs = parsePositiveNumber(
    args.find((arg) => arg.startsWith('--timeout-ms='))?.split('=')[1],
    60_000,
    5_000,
    180_000,
  );

  const waitAfterLoadMs = parsePositiveNumber(
    args.find((arg) => arg.startsWith('--wait-after-load-ms='))?.split('=')[1],
    5_000,
    0,
    60_000,
  );

  const retryDelayMs = parsePositiveNumber(
    args.find((arg) => arg.startsWith('--retry-delay-ms='))?.split('=')[1],
    5_000,
    0,
    120_000,
  );

  const regionKeys = parseRegionList(args.find((arg) => arg.startsWith('--regions='))?.split('=')[1]);

  return {
    snapshotHour,
    dryRun,
    headless,
    timeoutMs,
    waitAfterLoadMs,
    noRetry,
    retryDelayMs,
    regionKeys,
  };
}

function filterTargets(targets: XTrendTarget[], regionKeys: string[] | null) {
  if (!regionKeys?.length) return targets;
  const allowed = new Set(regionKeys);
  return targets.filter((target) => allowed.has(target.regionKey));
}

async function runTargets(options: CliOptions, targets: XTrendTarget[]) {
  const results: XTrendRegionResult[] = [];

  for (const target of targets) {
    console.log(`crawl region=${target.regionKey} label="${target.regionLabel}" headless=${options.headless}`);
    const result = await crawlXTrendTarget({
      target,
      snapshotHour: options.snapshotHour,
      headless: options.headless,
      timeoutMs: options.timeoutMs,
      waitAfterLoadMs: options.waitAfterLoadMs,
    });

    if (result.status === 'success') {
      console.log(
        `  [ok] region=${result.regionKey} source=${result.extractionSource} loggedIn=${result.loggedIn} items=${result.items.length} top=${result.items[0]?.trendName ?? 'N/A'}`,
      );
    } else {
      console.log(
        `  [failed] region=${result.regionKey} source=${result.extractionSource ?? 'n/a'} loggedIn=${result.loggedIn} error=${result.error}`,
      );
    }

    results.push(result);
  }

  return results;
}

async function retryFailedIfNeeded(
  options: CliOptions,
  targets: XTrendTarget[],
  results: XTrendRegionResult[],
) {
  if (options.noRetry) return results;

  const failedTargetKeys = new Set(results.filter((item) => item.status === 'failed').map((item) => item.regionKey));
  if (!failedTargetKeys.size) return results;

  console.log(`retrying failed regions after ${options.retryDelayMs}ms: ${Array.from(failedTargetKeys).join(', ')}`);
  await new Promise((resolve) => setTimeout(resolve, options.retryDelayMs));

  const retryTargets = targets.filter((target) => failedTargetKeys.has(target.regionKey));
  const retryResults = await runTargets(options, retryTargets);
  const retryMap = new Map(retryResults.map((item) => [item.regionKey, item]));

  return results.map((item) => retryMap.get(item.regionKey) ?? item);
}

async function main() {
  const options = parseCliArgs();
  console.log(
    `snapshotHour=${options.snapshotHour}, dryRun=${options.dryRun}, headless=${options.headless}, timeoutMs=${options.timeoutMs}, waitAfterLoadMs=${options.waitAfterLoadMs}`,
  );

  const configuredTargets = loadXTrendTargetsFromEnv();
  const targets = filterTargets(configuredTargets, options.regionKeys);
  if (!targets.length) {
    throw new Error('No X trend targets found after applying region filter.');
  }

  console.log(`targetCount=${targets.length} regions=${targets.map((target) => target.regionKey).join(',')}`);

  const initialResults = await runTargets(options, targets);
  const finalResults = await retryFailedIfNeeded(options, targets, initialResults);

  if (options.dryRun) {
    console.log('dry-run complete, no database writes');
    return;
  }

  const { ensureXTrendSchema } = await import('../src/lib/x-trends/ensure-schema');
  const { saveXTrendHourlyResults } = await import('../src/lib/x-trends/db');
  await ensureXTrendSchema();
  const summary = await saveXTrendHourlyResults(options.snapshotHour, finalResults);
  console.log(
    `stored x trends snapshot hour=${options.snapshotHour} success=${summary.success} failed=${summary.failed} status=${summary.batch.failedRegionCount === 0 ? 'published' : 'failed'}`,
  );

  if (summary.failed > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('crawl-x-trending-hourly failed:', error);
  process.exit(1);
});
