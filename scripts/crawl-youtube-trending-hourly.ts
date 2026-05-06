import { config as loadEnv } from 'dotenv';
import { YouTubeDataApiClient } from '../src/lib/youtube-hot/client';
import { DEFAULT_YOUTUBE_HOT_REGION_CODES } from '../src/lib/youtube-hot/default-regions';
import { parseSnapshotHour, toSnapshotHour } from '../src/lib/youtube-hot/time';
import type { YouTubeHotRegionResult, YouTubeRegion } from '../src/lib/youtube-hot/types';

loadEnv({ path: '.env' });
loadEnv({ path: '.env.local', override: true });
loadEnv({ path: '.dev.vars', override: true });

interface CliOptions {
  snapshotHour: string;
  dryRun: boolean;
  noRetry: boolean;
  retryDelayMs: number;
  maxResults: number;
  concurrency: number;
  regions: string[] | null;
}

const YOUTUBE_HOT_BATCH_INTERVAL_HOURS = 6;

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
        .map((part) => part.trim().toUpperCase())
        .filter((part) => /^[A-Z]{2}$/.test(part)),
    ),
  );
  return regions.length ? regions : null;
}

function normalizeBatchSnapshotHour(snapshotHour: string) {
  const parsed = parseSnapshotHour(snapshotHour);
  if (!parsed) {
    return null;
  }

  const hour = Number(parsed.slice(11, 13));
  if (!Number.isFinite(hour)) {
    return null;
  }

  const normalizedHour = Math.floor(hour / YOUTUBE_HOT_BATCH_INTERVAL_HOURS) * YOUTUBE_HOT_BATCH_INTERVAL_HOURS;
  return `${parsed.slice(0, 11)}${String(normalizedHour).padStart(2, '0')}:00:00`;
}

function parseCliArgs(): CliOptions {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const noRetry = args.includes('--no-retry');

  const hourArg = args.find((arg) => arg.startsWith('--hour='))?.split('=')[1];
  const resolvedSnapshotHour = hourArg ? parseSnapshotHour(hourArg) : toSnapshotHour();
  const snapshotHour = resolvedSnapshotHour ? normalizeBatchSnapshotHour(resolvedSnapshotHour) : null;
  if (!snapshotHour) {
    throw new Error('Invalid --hour format. Example: --hour=2026-03-23 11:00:00');
  }

  const retryDelayMs = parsePositiveNumber(
    args.find((arg) => arg.startsWith('--retry-delay-ms='))?.split('=')[1],
    2000,
    0,
    120000,
  );

  const maxResults = parsePositiveNumber(
    args.find((arg) => arg.startsWith('--max-results='))?.split('=')[1],
    100,
    1,
    200,
  );

  const concurrency = parsePositiveNumber(
    args.find((arg) => arg.startsWith('--concurrency='))?.split('=')[1],
    6,
    1,
    20,
  );

  const cliRegions = parseRegionList(args.find((arg) => arg.startsWith('--regions='))?.split('=')[1]);

  return {
    snapshotHour,
    dryRun,
    noRetry,
    retryDelayMs,
    maxResults,
    concurrency,
    regions: cliRegions,
  };
}

async function crawlOneRegion(params: {
  client: YouTubeDataApiClient;
  snapshotHour: string;
  region: YouTubeRegion;
  maxResults: number;
}): Promise<YouTubeHotRegionResult> {
  try {
    const [categories, popularVideos] = await Promise.all([
      params.client.listCategories(params.region.regionCode),
      params.client.listMostPopularVideos(params.region.regionCode, params.maxResults),
    ]);

    const categoryNameMap = new Map(categories.map((item) => [item.categoryId, item.categoryTitle]));
    const channelStatsMap = await params.client.getChannelStatsByIds(
      popularVideos.items.map((item) => item.channelId),
    );

    const items = popularVideos.items.map((video, index) => {
      const channel = channelStatsMap.get(video.channelId);
      return {
        rank: index + 1,
        videoId: video.videoId,
        videoUrl: video.videoUrl,
        title: video.title,
        thumbnailUrl: video.thumbnailUrl,
        categoryId: video.categoryId,
        categoryTitle: video.categoryId ? categoryNameMap.get(video.categoryId) ?? null : null,
        publishedAt: video.publishedAt,
        durationIso: video.durationIso,
        viewCount: video.viewCount,
        likeCount: video.likeCount,
        commentCount: video.commentCount,
        channelId: video.channelId,
        channelTitle: channel?.channelTitle ?? video.channelTitle,
        channelUrl: channel?.channelUrl ?? `https://www.youtube.com/channel/${video.channelId}`,
        channelAvatarUrl: channel?.channelAvatarUrl ?? null,
        subscriberCount: channel?.subscriberCount ?? null,
        hiddenSubscriberCount: channel?.hiddenSubscriberCount ?? false,
        tags: video.tags,
        metadata: {
          sourceRegion: params.region.regionCode,
          videoTags: video.tags,
        },
      };
    });

    if (!items.length) {
      throw new Error(`No videos found for ${params.region.regionCode}`);
    }

    return {
      status: 'success',
      snapshotHour: params.snapshotHour,
      regionCode: params.region.regionCode,
      regionName: params.region.regionName,
      sourceUrl: popularVideos.sourceUrl,
      items,
      rawPayload: popularVideos.rawPayload,
    };
  } catch (error) {
    return {
      status: 'failed',
      snapshotHour: params.snapshotHour,
      regionCode: params.region.regionCode,
      regionName: params.region.regionName,
      sourceUrl: `https://www.googleapis.com/youtube/v3/videos?chart=mostPopular&regionCode=${params.region.regionCode}`,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function runWithConcurrency<TInput, TOutput>(
  inputs: TInput[],
  concurrency: number,
  worker: (input: TInput) => Promise<TOutput>,
): Promise<TOutput[]> {
  const results: TOutput[] = new Array(inputs.length);
  let index = 0;

  async function consume() {
    while (index < inputs.length) {
      const currentIndex = index;
      index += 1;
      results[currentIndex] = await worker(inputs[currentIndex]);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, inputs.length) }, () => consume());
  await Promise.all(workers);
  return results;
}

function printSummary(title: string, results: YouTubeHotRegionResult[]) {
  const success = results.filter((item) => item.status === 'success');
  const failed = results.filter((item) => item.status === 'failed');
  console.log(`\n${title}`);
  console.log(`success=${success.length}, failed=${failed.length}`);

  for (const item of success) {
    console.log(`  [ok] ${item.regionCode} items=${item.items.length} top=${item.items[0]?.title ?? 'N/A'}`);
  }
  for (const item of failed) {
    console.log(`  [failed] ${item.regionCode} ${item.error}`);
  }
}

async function retryFailedIfNeeded(
  options: CliOptions,
  client: YouTubeDataApiClient,
  regions: YouTubeRegion[],
  results: YouTubeHotRegionResult[],
): Promise<YouTubeHotRegionResult[]> {
  if (options.noRetry) return results;

  const failedRegionCodes = new Set(
    results.filter((item) => item.status === 'failed').map((item) => item.regionCode),
  );

  if (!failedRegionCodes.size) return results;

  await new Promise((resolve) => setTimeout(resolve, options.retryDelayMs));

  const retryRegions = regions.filter((region) => failedRegionCodes.has(region.regionCode));
  const retryResults = await runWithConcurrency(retryRegions, options.concurrency, (region) =>
    crawlOneRegion({
      client,
      snapshotHour: options.snapshotHour,
      region,
      maxResults: options.maxResults,
    }),
  );

  const retryMap = new Map(retryResults.map((item) => [item.regionCode, item]));
  return results.map((result) => retryMap.get(result.regionCode) ?? result);
}

function resolveTargetRegionCodes(cliRegions: string[] | null) {
  if (cliRegions?.length) return cliRegions;
  const envRegions = parseRegionList(process.env.YOUTUBE_HOT_REGION_CODES);
  if (envRegions?.length) return envRegions;
  return [...DEFAULT_YOUTUBE_HOT_REGION_CODES];
}

async function main() {
  const options = parseCliArgs();
  console.log(
    `snapshotHour=${options.snapshotHour}, dryRun=${options.dryRun}, maxResults=${options.maxResults}, concurrency=${options.concurrency}`,
  );

  const apiKey = process.env.YOUTUBE_API_KEY_DAILY?.trim();
  if (!apiKey) {
    throw new Error('YOUTUBE_API_KEY_DAILY is missing');
  }

  const client = new YouTubeDataApiClient(apiKey);
  const availableRegions = await client.listRegions();
  const targetRegionCodes = new Set(resolveTargetRegionCodes(options.regions));
  const regions = availableRegions.filter((region) => targetRegionCodes.has(region.regionCode));

  if (!regions.length) {
    throw new Error('No valid regions found. Check --regions input or YOUTUBE_HOT_REGION_CODES.');
  }

  console.log(`regionCount=${regions.length}`);

  const initialResults = await runWithConcurrency(regions, options.concurrency, (region) =>
    crawlOneRegion({
      client,
      snapshotHour: options.snapshotHour,
      region,
      maxResults: options.maxResults,
    }),
  );

  printSummary('initial crawl', initialResults);

  const finalResults = await retryFailedIfNeeded(options, client, regions, initialResults);
  if (finalResults !== initialResults) {
    printSummary('after retry', finalResults);
  }

  if (options.dryRun) {
    console.log('\ndry-run complete, no database writes');
    return;
  }

  const { saveYouTubeHotHourlyResults } = await import('../src/lib/youtube-hot/db');
  const summary = await saveYouTubeHotHourlyResults(options.snapshotHour, finalResults);
  console.log(
    `\nstored youtube trending snapshot hour=${options.snapshotHour} snapshotDate=${summary.batch.snapshotDate} success=${summary.success} failed=${summary.failed} status=${summary.failed === 0 ? 'published' : 'failed'} dailyItems=${summary.batch.itemCount}`,
  );
}

main().catch((error) => {
  console.error('crawl-youtube-hot-hourly failed:', error);
  process.exit(1);
});
