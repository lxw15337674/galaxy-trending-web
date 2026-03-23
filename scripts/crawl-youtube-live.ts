import { config as loadEnv } from 'dotenv';
import { YouTubeDataApiClient } from '../src/lib/youtube-hot/client';

loadEnv({ path: '.env' });
loadEnv({ path: '.env.local', override: true });
loadEnv({ path: '.dev.vars', override: true });

interface CliOptions {
  dryRun: boolean;
  maxResults: number;
  searchPages: number;
  retentionDays: number;
  query: string;
}

function parsePositiveNumber(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const normalized = Math.floor(parsed);
  if (normalized < min) return min;
  if (normalized > max) return max;
  return normalized;
}

function parseCliArgs(): CliOptions {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  const maxResults = parsePositiveNumber(
    args.find((arg) => arg.startsWith('--max-results='))?.split('=')[1],
    200,
    1,
    200,
  );

  const searchPages = parsePositiveNumber(
    args.find((arg) => arg.startsWith('--search-pages='))?.split('=')[1],
    4,
    1,
    10,
  );

  const retentionDays = parsePositiveNumber(
    args.find((arg) => arg.startsWith('--retention-days='))?.split('=')[1],
    30,
    1,
    365,
  );

  const query = args.find((arg) => arg.startsWith('--query='))?.split('=')[1]?.trim() || 'live';

  return {
    dryRun,
    maxResults,
    searchPages,
    retentionDays,
    query,
  };
}

function buildCutoffIso(retentionDays: number) {
  const now = Date.now();
  const cutoff = new Date(now - retentionDays * 24 * 60 * 60 * 1000);
  return cutoff.toISOString();
}

function estimateYouTubeLiveQuotaUnits(maxResults: number, searchPages: number) {
  const detailCalls = Math.ceil(Math.max(1, Math.min(200, maxResults)) / 50);
  return {
    searchCalls: Math.max(1, Math.min(10, searchPages)),
    detailCalls,
    channelCalls: detailCalls,
    categoryCalls: 1,
    estimatedUnits: Math.max(1, Math.min(10, searchPages)) * 100 + detailCalls * 2 + 1,
  };
}

async function main() {
  const startedAtMs = Date.now();
  const options = parseCliArgs();
  const crawledAt = new Date().toISOString();
  console.log(
    `crawledAt=${crawledAt}, dryRun=${options.dryRun}, maxResults=${options.maxResults}, searchPages=${options.searchPages}, retentionDays=${options.retentionDays}, query=${options.query}`,
  );

  const apiKey = process.env.YOUTUBE_API_KEY_LIVE?.trim();
  if (!apiKey) {
    throw new Error('YOUTUBE_API_KEY_LIVE is missing');
  }

  const client = new YouTubeDataApiClient(apiKey);
  let status: 'success' | 'failed' = 'success';
  let sourceUrl = '';
  let detailSourceUrl = '';
  let errorText: string | null = null;
  let items = [] as Awaited<ReturnType<YouTubeDataApiClient['listGlobalLiveTopVideos']>>['items'];

  try {
    const result = await client.listGlobalLiveTopVideos(
      options.maxResults,
      options.query,
      options.searchPages,
    );
    sourceUrl = result.sourceUrl;
    detailSourceUrl = result.detailSourceUrl;
    items = result.items;
    console.log(`fetched items=${items.length}, top=${items[0]?.title ?? 'N/A'}`);
  } catch (error) {
    status = 'failed';
    errorText = error instanceof Error ? error.message : String(error);
    console.error(`fetch failed: ${errorText}`);
  }

  if (options.dryRun) {
    console.log('dry-run complete, no database writes');
    return;
  }

  const tursoUrl = process.env.TURSO_DATABASE_URL?.trim();
  if (!tursoUrl) {
    throw new Error('TURSO_DATABASE_URL is missing. Set it in .env or .env.local before writing snapshots.');
  }

  const { purgeYouTubeLiveSnapshotsBefore, saveYouTubeLiveSnapshot } = await import(
    '../src/lib/youtube-live/db'
  );

  const snapshotId = await saveYouTubeLiveSnapshot({
    crawledAt,
    sourceUrl,
    detailSourceUrl,
    status,
    items,
    errorText,
  });
  console.log(`stored snapshot id=${snapshotId} status=${status} itemCount=${items.length}`);

  const cutoffIso = buildCutoffIso(options.retentionDays);
  const purgeSummary = await purgeYouTubeLiveSnapshotsBefore(cutoffIso);
  console.log(
    `purged snapshots=${purgeSummary.deletedSnapshots}, items=${purgeSummary.deletedItems}, cutoff=${cutoffIso}`,
  );

  const quota = estimateYouTubeLiveQuotaUnits(options.maxResults, options.searchPages);
  const elapsedMs = Date.now() - startedAtMs;
  console.log(
    `metrics durationMs=${elapsedMs} status=${status} fetchedItems=${items.length} searchCalls=${quota.searchCalls} detailCalls=${quota.detailCalls} channelCalls=${quota.channelCalls} categoryCalls=${quota.categoryCalls} estimatedQuotaUnits=${quota.estimatedUnits}`,
  );

  if (status === 'failed') {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('crawl-youtube-live failed:', error);
  process.exit(1);
});
