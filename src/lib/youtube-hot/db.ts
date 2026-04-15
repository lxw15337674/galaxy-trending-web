import { sql } from 'drizzle-orm';
import { db } from '@/db/index';
import { toBooleanInt, toJson, toNullableNumber, toNumber } from '@/lib/db/codec';
import { deleteRowsNotInList, negateRanksForSnapshot } from '@/lib/db/hourly-item-diff';
import { areComparableValuesEqual } from '@/lib/db/snapshot-write-guard';
import { nowUtcIso } from '@/lib/db/time';
import {
  type YouTubeCategory,
  type YouTubeHotFilters,
  type YouTubeHotLatestBatch,
  type YouTubeHotQueryItem,
  type YouTubeHotQueryParams,
  type YouTubeHotQueryResult,
  type YouTubeHotRegionResult,
  type YouTubeHotSort,
  type YouTubeRegion,
  normalizeYouTubeHotSort,
} from './types';

interface BatchIdRow {
  id: number;
}

interface CountRow {
  total: number;
}

interface BatchMetaRow {
  id: number;
  snapshotHour: string;
  generatedAt: string;
  regionCount: number;
  successRegionCount: number;
  failedRegionCount: number;
}

interface QueryRow {
  snapshotHour: string;
  fetchedAt: string;
  regionCode: string;
  regionName: string;
  rank: number;
  videoId: string;
  videoUrl: string;
  title: string;
  thumbnailUrl: string | null;
  categoryId: string | null;
  categoryTitle: string | null;
  publishedAt: string | null;
  durationIso: string | null;
  viewCount: number | null;
  likeCount: number | null;
  commentCount: number | null;
  channelId: string;
  channelTitle: string;
  channelUrl: string;
  channelAvatarUrl: string | null;
  subscriberCount: number | null;
  hiddenSubscriberCount: number;
  metadataJson: string | null;
  aggregateRegionCount?: number | null;
  aggregateRegionCodes?: string | null;
  aggregateRegionNames?: string | null;
  aggregateBestRank?: number | null;
  aggregateAvgRank?: number | null;
  aggregateScore?: number | null;
}

interface SnapshotCompareRow {
  id: number;
  regionCode: string;
  regionName: string;
  status: 'success' | 'failed';
  sourceUrl: string;
  itemCount: number;
  errorText: string | null;
}

interface ItemCompareRow {
  snapshotId: number;
  rank: number;
  videoId: string;
  videoUrl: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  categoryId: string | null;
  categoryTitle: string | null;
  publishedAt: string | null;
  durationIso: string | null;
  viewCount: number | null;
  likeCount: number | null;
  commentCount: number | null;
  channelId: string;
  channelTitle: string;
  channelUrl: string;
  channelAvatarUrl: string | null;
  subscriberCount: number | null;
  hiddenSubscriberCount: number;
  metadataJson: string | null;
}

type QueryExecutor = Pick<typeof db, 'all' | 'run'>;

const TRANSIENT_DB_RETRY_MAX_ATTEMPTS = 3;
const TRANSIENT_DB_RETRY_BASE_DELAY_MS = 300;

function parseMetadata(value: string | null): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function pickTagsFromMetadata(value: string | null): string[] {
  const metadata = parseMetadata(value);
  const rawTags = metadata?.videoTags;
  if (!Array.isArray(rawTags)) return [];

  return rawTags
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0)
    .slice(0, 12);
}

function parseCsvList(value: string | null | undefined): string[] {
  if (!value) return [];
  const unique = new Set(
    value
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0),
  );
  return Array.from(unique);
}

function parsePositiveInt(value: unknown, fallback: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), max);
}

function buildVisibleYouTubeHotItemSql(itemAlias: string) {
  return sql`(
    ${sql.raw(`${itemAlias}.view_count`)} IS NOT NULL
    AND (
      ${sql.raw(`${itemAlias}.hidden_subscriber_count`)} = 1
      OR ${sql.raw(`${itemAlias}.subscriber_count`)} IS NOT NULL
      OR ${sql.raw(`${itemAlias}.channel_avatar_url`)} IS NOT NULL
    )
  )`;
}

function buildYouTubeHotOrderBySql(sort: YouTubeHotSort, shouldAggregateGlobal: boolean) {
  if (shouldAggregateGlobal) {
    switch (sort) {
      case 'rank_asc':
        return sql`
          ORDER BY
            aggregateBestRank ASC,
            aggregateRegionCount DESC,
            aggregateScore DESC,
            COALESCE(MAX(i.view_count), 0) DESC,
            i.video_id ASC
        `;
      case 'views_desc':
        return sql`
          ORDER BY
            COALESCE(MAX(i.view_count), 0) DESC,
            aggregateRegionCount DESC,
            aggregateScore DESC,
            aggregateBestRank ASC,
            i.video_id ASC
        `;
      case 'published_newest':
        return sql`
          ORDER BY
            COALESCE(MAX(i.published_at), '') DESC,
            aggregateRegionCount DESC,
            aggregateScore DESC,
            aggregateBestRank ASC,
            i.video_id ASC
        `;
      case 'region_coverage_desc':
      default:
        return sql`
          ORDER BY
            aggregateRegionCount DESC,
            aggregateScore DESC,
            aggregateBestRank ASC,
            COALESCE(MAX(i.view_count), 0) DESC,
            i.video_id ASC
        `;
    }
  }

  switch (sort) {
    case 'views_desc':
      return sql`
        ORDER BY
          COALESCE(i.view_count, 0) DESC,
          i.rank ASC,
          i.video_id ASC
      `;
    case 'published_newest':
      return sql`
        ORDER BY
          COALESCE(i.published_at, '') DESC,
          i.rank ASC,
          i.video_id ASC
      `;
    case 'rank_asc':
    case 'region_coverage_desc':
    default:
      return sql`
        ORDER BY
          i.rank ASC,
          i.video_id ASC
      `;
  }
}

function getErrorText(error: unknown) {
  const message = String((error as { message?: unknown })?.message ?? '');
  const causeMessage = String(
    (error as { cause?: { message?: unknown; proto?: { message?: unknown } } })?.cause?.message ??
      (error as { cause?: { message?: unknown; proto?: { message?: unknown } } })?.cause?.proto?.message ??
      '',
  );

  return `${message} ${causeMessage}`.toLowerCase();
}

function isTransientDbError(error: unknown) {
  const fullMessage = getErrorText(error);

  return (
    fullMessage.includes('econnreset') ||
    fullMessage.includes('fetch failed') ||
    fullMessage.includes('client network socket disconnected') ||
    fullMessage.includes('before secure tls connection was established') ||
    fullMessage.includes('etimedout') ||
    fullMessage.includes('timeout') ||
    fullMessage.includes('network')
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withYouTubeHotReadRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 1; attempt <= TRANSIENT_DB_RETRY_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      if (!isTransientDbError(error) || attempt >= TRANSIENT_DB_RETRY_MAX_ATTEMPTS) {
        throw error;
      }

      await sleep(TRANSIENT_DB_RETRY_BASE_DELAY_MS * attempt);
    }
  }

  throw new Error('Unexpected youtube hot query retry state');
}

function mapBatchRow(row: BatchMetaRow | undefined | null): YouTubeHotLatestBatch | null {
  if (!row) return null;

  return {
    id: toNumber(row.id, 0),
    snapshotHour: row.snapshotHour,
    generatedAt: row.generatedAt,
    regionCount: toNumber(row.regionCount, 0),
    successRegionCount: toNumber(row.successRegionCount, 0),
    failedRegionCount: toNumber(row.failedRegionCount, 0),
  };
}

async function upsertBatch(executor: QueryExecutor, snapshotHour: string) {
  const now = nowUtcIso();
  const rows = await executor.all<BatchIdRow>(sql`
    INSERT INTO youtube_hot_hourly_batches (
      snapshot_hour,
      batch_status,
      source_name,
      created_at,
      updated_at
    )
    VALUES (
      ${snapshotHour},
      'pending',
      'youtube-mostPopular',
      ${now},
      ${now}
    )
    ON CONFLICT(snapshot_hour)
    DO UPDATE SET
      updated_at = excluded.updated_at
    RETURNING id
  `);

  if (!rows[0]?.id) {
    throw new Error(`Failed to upsert youtube hot batch ${snapshotHour}`);
  }

  return rows[0].id;
}

async function upsertSnapshot(
  executor: QueryExecutor,
  params: {
  batchId: number;
  regionCode: string;
  regionName: string;
  sourceUrl: string;
  status: 'success' | 'failed';
  itemCount: number;
  errorText: string | null;
  rawPayload: string | null;
},
) {
  const rows = await executor.all<BatchIdRow>(sql`
    INSERT INTO youtube_hot_hourly_snapshots (
      batch_id,
      region_code,
      region_name,
      fetched_at,
      status,
      source_url,
      item_count,
      error_text,
      raw_payload
    )
    VALUES (
      ${params.batchId},
      ${params.regionCode},
      ${params.regionName},
      ${nowUtcIso()},
      ${params.status},
      ${params.sourceUrl},
      ${params.itemCount},
      ${params.errorText},
      ${params.rawPayload}
    )
    ON CONFLICT(batch_id, region_code)
    DO UPDATE SET
      region_name = excluded.region_name,
      fetched_at = excluded.fetched_at,
      source_url = excluded.source_url,
      status = CASE
        WHEN youtube_hot_hourly_snapshots.status = 'success' AND excluded.status = 'failed' THEN youtube_hot_hourly_snapshots.status
        ELSE excluded.status
      END,
      item_count = CASE
        WHEN youtube_hot_hourly_snapshots.status = 'success' AND excluded.status = 'failed' THEN youtube_hot_hourly_snapshots.item_count
        ELSE excluded.item_count
      END,
      error_text = CASE
        WHEN youtube_hot_hourly_snapshots.status = 'success' AND excluded.status = 'failed' THEN youtube_hot_hourly_snapshots.error_text
        ELSE excluded.error_text
      END,
      raw_payload = CASE
        WHEN youtube_hot_hourly_snapshots.status = 'success' AND excluded.status = 'failed' THEN youtube_hot_hourly_snapshots.raw_payload
        ELSE excluded.raw_payload
      END
    RETURNING id
  `);

  if (!rows[0]?.id) {
    throw new Error(`Failed to upsert youtube snapshot ${params.batchId}/${params.regionCode}`);
  }

  return rows[0].id;
}

function normalizeYouTubeHotResultForComparison(result: YouTubeHotRegionResult) {
  if (result.status === 'success') {
    return {
      regionCode: result.regionCode,
      regionName: result.regionName,
      status: 'success',
      sourceUrl: result.sourceUrl,
      items: result.items.map((item) => ({
        rank: item.rank,
        videoId: item.videoId,
        videoUrl: item.videoUrl,
        title: item.title,
        description: item.description,
        thumbnailUrl: item.thumbnailUrl,
        categoryId: item.categoryId,
        categoryTitle: item.categoryTitle,
        publishedAt: item.publishedAt,
        durationIso: item.durationIso,
        viewCount: item.viewCount,
        likeCount: item.likeCount,
        commentCount: item.commentCount,
        channelId: item.channelId,
        channelTitle: item.channelTitle,
        channelUrl: item.channelUrl,
        channelAvatarUrl: item.channelAvatarUrl,
        subscriberCount: item.subscriberCount,
        hiddenSubscriberCount: item.hiddenSubscriberCount,
        metadata: item.metadata ?? null,
      })),
    };
  }

  return {
    regionCode: result.regionCode,
    regionName: result.regionName,
    status: 'failed',
    sourceUrl: result.sourceUrl,
    errorText: result.error.slice(0, 500),
  };
}

async function loadExistingYouTubeHotBatchComparison(snapshotHour: string) {
  const batchRows = await db.all<BatchIdRow>(sql`
    SELECT id
    FROM youtube_hot_hourly_batches
    WHERE snapshot_hour = ${snapshotHour}
    LIMIT 1
  `);
  const batchId = batchRows[0]?.id;
  if (!batchId) return null;

  const snapshotRows = await db.all<SnapshotCompareRow>(sql`
    SELECT
      id,
      region_code as regionCode,
      region_name as regionName,
      status,
      source_url as sourceUrl,
      item_count as itemCount,
      error_text as errorText
    FROM youtube_hot_hourly_snapshots
    WHERE batch_id = ${batchId}
    ORDER BY region_code ASC
  `);

  const successSnapshotIds = snapshotRows.filter((row) => row.status === 'success').map((row) => row.id);
  const itemRows = successSnapshotIds.length
    ? await db.all<ItemCompareRow>(sql`
        SELECT
          snapshot_id as snapshotId,
          rank,
          video_id as videoId,
          video_url as videoUrl,
          title,
          description,
          thumbnail_url as thumbnailUrl,
          category_id as categoryId,
          category_title as categoryTitle,
          published_at as publishedAt,
          duration_iso as durationIso,
          view_count as viewCount,
          like_count as likeCount,
          comment_count as commentCount,
          channel_id as channelId,
          channel_title as channelTitle,
          channel_url as channelUrl,
          channel_avatar_url as channelAvatarUrl,
          subscriber_count as subscriberCount,
          hidden_subscriber_count as hiddenSubscriberCount,
          metadata_json as metadataJson
        FROM youtube_hot_hourly_items
        WHERE snapshot_id IN (${sql.join(successSnapshotIds.map((id) => sql`${id}`), sql`, `)})
        ORDER BY snapshot_id ASC, rank ASC
      `)
    : [];

  const itemsBySnapshotId = new Map<number, ItemCompareRow[]>();
  for (const row of itemRows) {
    const bucket = itemsBySnapshotId.get(row.snapshotId);
    if (bucket) {
      bucket.push(row);
    } else {
      itemsBySnapshotId.set(row.snapshotId, [row]);
    }
  }

  return {
    batchId,
    results: snapshotRows.map((row) => {
      if (row.status === 'success') {
        return {
          regionCode: row.regionCode,
          regionName: row.regionName,
          status: 'success',
          sourceUrl: row.sourceUrl,
          items: (itemsBySnapshotId.get(row.id) ?? []).map((item) => ({
            rank: item.rank,
            videoId: item.videoId,
            videoUrl: item.videoUrl,
            title: item.title,
            description: item.description,
            thumbnailUrl: item.thumbnailUrl,
            categoryId: item.categoryId,
            categoryTitle: item.categoryTitle,
            publishedAt: item.publishedAt,
            durationIso: item.durationIso,
            viewCount: toNullableNumber(item.viewCount),
            likeCount: toNullableNumber(item.likeCount),
            commentCount: toNullableNumber(item.commentCount),
            channelId: item.channelId,
            channelTitle: item.channelTitle,
            channelUrl: item.channelUrl,
            channelAvatarUrl: item.channelAvatarUrl,
            subscriberCount: toNullableNumber(item.subscriberCount),
            hiddenSubscriberCount: toBooleanInt(item.hiddenSubscriberCount),
            metadata: parseMetadata(item.metadataJson),
          })),
        };
      }

      return {
        regionCode: row.regionCode,
        regionName: row.regionName,
        status: 'failed',
        sourceUrl: row.sourceUrl,
        errorText: row.errorText,
      };
    }),
  };
}

async function replaceSnapshotItems(
  executor: QueryExecutor,
  snapshotId: number,
  result: Extract<YouTubeHotRegionResult, { status: 'success' }>,
) {
  const now = nowUtcIso();
  await deleteRowsNotInList({
    executor,
    tableName: 'youtube_hot_hourly_items',
    snapshotId,
    keyColumn: 'video_id',
    keepKeys: Array.from(new Set(result.items.map((item) => item.videoId))),
  });
  if (!result.items.length) return;

  await negateRanksForSnapshot({
    executor,
    tableName: 'youtube_hot_hourly_items',
    snapshotId,
  });

  const valueRows = result.items.map((item) => sql`
    (
      ${snapshotId},
      ${item.rank},
      ${item.videoId},
      ${item.videoUrl},
      ${item.title},
      ${item.description},
      ${item.thumbnailUrl},
      ${item.categoryId},
      ${item.categoryTitle},
      ${item.publishedAt},
      ${item.durationIso},
      ${item.viewCount},
      ${item.likeCount},
      ${item.commentCount},
      ${item.channelId},
      ${item.channelTitle},
      ${item.channelUrl},
      ${item.channelAvatarUrl},
      ${item.subscriberCount},
      ${item.hiddenSubscriberCount ? 1 : 0},
      ${toJson(item.metadata)},
      ${now}
    )
  `);

  await executor.run(sql`
    INSERT INTO youtube_hot_hourly_items (
      snapshot_id,
      rank,
      video_id,
      video_url,
      title,
      description,
      thumbnail_url,
      category_id,
      category_title,
      published_at,
      duration_iso,
      view_count,
      like_count,
      comment_count,
      channel_id,
      channel_title,
      channel_url,
      channel_avatar_url,
      subscriber_count,
      hidden_subscriber_count,
      metadata_json,
      created_at
    )
    VALUES ${sql.join(valueRows, sql`, `)}
    ON CONFLICT(snapshot_id, video_id)
    DO UPDATE SET
      rank = excluded.rank,
      video_url = excluded.video_url,
      title = excluded.title,
      description = excluded.description,
      thumbnail_url = excluded.thumbnail_url,
      category_id = excluded.category_id,
      category_title = excluded.category_title,
      published_at = excluded.published_at,
      duration_iso = excluded.duration_iso,
      view_count = excluded.view_count,
      like_count = excluded.like_count,
      comment_count = excluded.comment_count,
      channel_id = excluded.channel_id,
      channel_title = excluded.channel_title,
      channel_url = excluded.channel_url,
      channel_avatar_url = excluded.channel_avatar_url,
      subscriber_count = excluded.subscriber_count,
      hidden_subscriber_count = excluded.hidden_subscriber_count,
      metadata_json = excluded.metadata_json
  `);
}

async function updateBatchSummary(executor: QueryExecutor, batchId: number) {
  const rows = await executor.all<BatchMetaRow>(sql`
    SELECT
      b.id as id,
      b.snapshot_hour as snapshotHour,
      COALESCE(MAX(s.fetched_at), b.updated_at) as generatedAt,
      COUNT(s.id) as regionCount,
      SUM(CASE WHEN s.status = 'success' THEN 1 ELSE 0 END) as successRegionCount,
      SUM(CASE WHEN s.status = 'failed' THEN 1 ELSE 0 END) as failedRegionCount
    FROM youtube_hot_hourly_batches b
    LEFT JOIN youtube_hot_hourly_snapshots s ON s.batch_id = b.id
    WHERE b.id = ${batchId}
    GROUP BY b.id, b.snapshot_hour, b.updated_at
  `);

  const summary = mapBatchRow(rows[0]);
  if (!summary) {
    throw new Error(`Failed to recalculate youtube batch ${batchId}`);
  }

  const nextStatus = summary.regionCount > 0 && summary.failedRegionCount === 0 ? 'published' : 'failed';
  const generatedAt = summary.snapshotHour;
  await executor.run(sql`
    UPDATE youtube_hot_hourly_batches
    SET
      batch_status = ${nextStatus},
      generated_at = ${generatedAt},
      region_count = ${summary.regionCount},
      success_region_count = ${summary.successRegionCount},
      failed_region_count = ${summary.failedRegionCount},
      updated_at = ${nowUtcIso()}
    WHERE id = ${batchId}
  `);

  return {
    ...summary,
    generatedAt,
  } satisfies YouTubeHotLatestBatch;
}

export async function saveYouTubeHotHourlyResults(snapshotHour: string, results: YouTubeHotRegionResult[]) {
  const normalizedResults = results
    .map(normalizeYouTubeHotResultForComparison)
    .sort((left, right) => left.regionCode.localeCompare(right.regionCode));
  const existingBatch = await loadExistingYouTubeHotBatchComparison(snapshotHour);
  if (existingBatch) {
    const existingResults = [...existingBatch.results].sort((left, right) => left.regionCode.localeCompare(right.regionCode));
    if (areComparableValuesEqual(existingResults, normalizedResults)) {
      const success = results.filter((result) => result.status === 'success').length;
      const failed = results.length - success;
      console.log(`[youtube-hot] skipped batch save for ${snapshotHour}; content unchanged`);
      return {
        batchId: existingBatch.batchId,
        success,
        failed,
        batch: {
          id: existingBatch.batchId,
          snapshotHour,
          generatedAt: snapshotHour,
          regionCount: results.length,
          successRegionCount: success,
          failedRegionCount: failed,
        } satisfies YouTubeHotLatestBatch,
      };
    }
  }

  return db.transaction(async (tx) => {
    const batchId = await upsertBatch(tx, snapshotHour);
    const summary = {
      success: 0,
      failed: 0,
      batchId,
    };

    for (const result of results) {
      if (result.status === 'success') {
        const snapshotId = await upsertSnapshot(tx, {
          batchId,
          regionCode: result.regionCode,
          regionName: result.regionName,
          sourceUrl: result.sourceUrl,
          status: 'success',
          itemCount: result.items.length,
          errorText: null,
          rawPayload: null,
        });

        await replaceSnapshotItems(tx, snapshotId, result);
        summary.success += 1;
        continue;
      }

      await upsertSnapshot(tx, {
        batchId,
        regionCode: result.regionCode,
        regionName: result.regionName,
        sourceUrl: result.sourceUrl,
        status: 'failed',
        itemCount: 0,
        errorText: result.error.slice(0, 500),
        rawPayload: null,
      });

      summary.failed += 1;
    }

    const batch = await updateBatchSummary(tx, batchId);
    return {
      ...summary,
      batch,
    };
  });
}

export async function getLatestPublishedBatch(): Promise<YouTubeHotLatestBatch | null> {
  return withYouTubeHotReadRetry(async () => {
    const rows = await db.all<BatchMetaRow>(sql`
      SELECT
        id,
        snapshot_hour as snapshotHour,
        generated_at as generatedAt,
        region_count as regionCount,
        success_region_count as successRegionCount,
        failed_region_count as failedRegionCount
      FROM youtube_hot_hourly_batches
      WHERE batch_status = 'published'
      ORDER BY snapshot_hour DESC
      LIMIT 1
    `);

    return mapBatchRow(rows[0]);
  });
}

export async function listLatestYouTubeHotFilters(region?: string | null): Promise<YouTubeHotFilters> {
  return withYouTubeHotReadRetry(async () => {
    const batch = await getLatestPublishedBatch();
    if (!batch) {
      return {
        regions: [],
        categories: [],
      };
    }

    const visibleItemSql = buildVisibleYouTubeHotItemSql('i');
    const normalizedRegion = region?.trim().toUpperCase() || null;
    const [regions, rawCategories] = await Promise.all([
      db.all<YouTubeRegion>(sql`
        SELECT
          s.region_code as regionCode,
          MAX(s.region_name) as regionName
        FROM youtube_hot_hourly_snapshots s
        JOIN youtube_hot_hourly_items i ON i.snapshot_id = s.id
        WHERE s.batch_id = ${batch.id} AND s.status = 'success' AND ${visibleItemSql}
        GROUP BY s.region_code
        ORDER BY s.region_code ASC
      `),
      db.all<YouTubeCategory>(sql`
        SELECT
          i.category_id as categoryId,
          MAX(i.category_title) as categoryTitle,
          COUNT(*) as count
        FROM youtube_hot_hourly_items i
        JOIN youtube_hot_hourly_snapshots s ON s.id = i.snapshot_id
        WHERE
          s.batch_id = ${batch.id}
          AND s.status = 'success'
          AND i.category_id IS NOT NULL
          AND ${visibleItemSql}
          ${normalizedRegion ? sql`AND s.region_code = ${normalizedRegion}` : sql``}
        GROUP BY i.category_id
        ORDER BY CAST(i.category_id AS INTEGER) ASC
      `),
    ]);

    const categories = rawCategories.map((item) => ({
      categoryId: item.categoryId,
      categoryTitle: item.categoryTitle,
      count: toNumber(item.count, 0),
    }));

    return {
      regions,
      categories,
    };
  });
}

export async function queryLatestYouTubeHot(params: YouTubeHotQueryParams): Promise<YouTubeHotQueryResult> {
  const page = parsePositiveInt(params.page, 1, 100000);
  const pageSize = parsePositiveInt(params.pageSize, 20, 100);
  const normalizedRegion = params.region?.trim().toUpperCase() || null;
  const normalizedCategory = params.category?.trim() || null;
  const shouldAggregateGlobal = !normalizedRegion;
  const normalizedSort = normalizeYouTubeHotSort(params.sort, normalizedRegion);

  return withYouTubeHotReadRetry(async () => {
    const batch = await getLatestPublishedBatch();
    if (!batch) {
      return {
        batch: null,
        page,
        pageSize,
        total: 0,
        totalPages: 0,
        data: [],
      };
    }

    const visibleItemSql = buildVisibleYouTubeHotItemSql('i');
    const wherePartsBase: ReturnType<typeof sql>[] = [
      sql`s.batch_id = ${batch.id}`,
      sql`s.status = 'success'`,
      visibleItemSql,
    ];

    if (normalizedCategory) {
      wherePartsBase.push(sql`i.category_id = ${normalizedCategory}`);
    }

    const wherePartsList = [...wherePartsBase];
    if (normalizedRegion) {
      wherePartsList.push(sql`s.region_code = ${normalizedRegion}`);
    }

    const whereSqlBase = sql`WHERE ${sql.join(wherePartsBase, sql` AND `)}`;
    const whereSqlList = sql`WHERE ${sql.join(wherePartsList, sql` AND `)}`;
    const offset = (page - 1) * pageSize;

    let total = 0;
    let rows: QueryRow[] = [];

    if (shouldAggregateGlobal) {
      const countRows = await db.all<CountRow>(sql`
        SELECT COUNT(*) as total
        FROM (
          SELECT i.video_id
          FROM youtube_hot_hourly_items i
          JOIN youtube_hot_hourly_snapshots s ON s.id = i.snapshot_id
          ${whereSqlBase}
          GROUP BY i.video_id
        ) t
      `);

      total = toNumber(countRows[0]?.total, 0);
      rows = await db.all<QueryRow>(sql`
        SELECT
          ${batch.snapshotHour} as snapshotHour,
          MAX(s.fetched_at) as fetchedAt,
          'GLOBAL' as regionCode,
          'Global' as regionName,
          MIN(i.rank) as rank,
          i.video_id as videoId,
          MAX(i.video_url) as videoUrl,
          MAX(i.title) as title,
          MAX(i.thumbnail_url) as thumbnailUrl,
          MAX(i.category_id) as categoryId,
          MAX(i.category_title) as categoryTitle,
          MAX(i.published_at) as publishedAt,
          MAX(i.duration_iso) as durationIso,
          MAX(i.view_count) as viewCount,
          MAX(i.like_count) as likeCount,
          MAX(i.comment_count) as commentCount,
          MAX(i.channel_id) as channelId,
          MAX(i.channel_title) as channelTitle,
          MAX(i.channel_url) as channelUrl,
          MAX(i.channel_avatar_url) as channelAvatarUrl,
          MAX(i.subscriber_count) as subscriberCount,
          MAX(i.hidden_subscriber_count) as hiddenSubscriberCount,
          MAX(i.metadata_json) as metadataJson,
          COUNT(DISTINCT s.region_code) as aggregateRegionCount,
          GROUP_CONCAT(DISTINCT s.region_code) as aggregateRegionCodes,
          GROUP_CONCAT(DISTINCT s.region_name) as aggregateRegionNames,
          MIN(i.rank) as aggregateBestRank,
          AVG(i.rank) as aggregateAvgRank,
          SUM(CASE WHEN i.rank <= 100 THEN 101 - i.rank ELSE 1 END) as aggregateScore
        FROM youtube_hot_hourly_items i
        JOIN youtube_hot_hourly_snapshots s ON s.id = i.snapshot_id
        ${whereSqlBase}
        GROUP BY i.video_id
        ${buildYouTubeHotOrderBySql(normalizedSort, true)}
        LIMIT ${pageSize}
        OFFSET ${offset}
      `);
    } else {
      const countRows = await db.all<CountRow>(sql`
        SELECT COUNT(*) as total
        FROM youtube_hot_hourly_items i
        JOIN youtube_hot_hourly_snapshots s ON s.id = i.snapshot_id
        ${whereSqlList}
      `);

      total = toNumber(countRows[0]?.total, 0);
      rows = await db.all<QueryRow>(sql`
        SELECT
          ${batch.snapshotHour} as snapshotHour,
          s.fetched_at as fetchedAt,
          s.region_code as regionCode,
          s.region_name as regionName,
          i.rank as rank,
          i.video_id as videoId,
          i.video_url as videoUrl,
          i.title as title,
          i.thumbnail_url as thumbnailUrl,
          i.category_id as categoryId,
          i.category_title as categoryTitle,
          i.published_at as publishedAt,
          i.duration_iso as durationIso,
          i.view_count as viewCount,
          i.like_count as likeCount,
          i.comment_count as commentCount,
          i.channel_id as channelId,
          i.channel_title as channelTitle,
          i.channel_url as channelUrl,
          i.channel_avatar_url as channelAvatarUrl,
          i.subscriber_count as subscriberCount,
          i.hidden_subscriber_count as hiddenSubscriberCount,
          i.metadata_json as metadataJson,
          agg.aggregateRegionCount as aggregateRegionCount,
          agg.aggregateRegionCodes as aggregateRegionCodes,
          agg.aggregateRegionNames as aggregateRegionNames,
          agg.aggregateBestRank as aggregateBestRank,
          agg.aggregateAvgRank as aggregateAvgRank,
          agg.aggregateScore as aggregateScore
        FROM youtube_hot_hourly_items i
        JOIN youtube_hot_hourly_snapshots s ON s.id = i.snapshot_id
        LEFT JOIN (
          SELECT
            i.video_id as videoId,
            COUNT(DISTINCT s.region_code) as aggregateRegionCount,
            GROUP_CONCAT(DISTINCT s.region_code) as aggregateRegionCodes,
            GROUP_CONCAT(DISTINCT s.region_name) as aggregateRegionNames,
            MIN(i.rank) as aggregateBestRank,
            AVG(i.rank) as aggregateAvgRank,
            SUM(CASE WHEN i.rank <= 100 THEN 101 - i.rank ELSE 1 END) as aggregateScore
          FROM youtube_hot_hourly_items i
          JOIN youtube_hot_hourly_snapshots s ON s.id = i.snapshot_id
          ${whereSqlBase}
          GROUP BY i.video_id
        ) agg ON agg.videoId = i.video_id
        ${whereSqlList}
        ${buildYouTubeHotOrderBySql(normalizedSort, false)}
        LIMIT ${pageSize}
        OFFSET ${offset}
      `);
    }

    const data: YouTubeHotQueryItem[] = rows.map((row, index) => {
      const aggregateRegionCount = toNumber(row.aggregateRegionCount, 0);
      const aggregateBestRank = toNumber(row.aggregateBestRank, 0);
      const aggregateAvgRank = toNumber(row.aggregateAvgRank, 0);
      const aggregateScore = toNumber(row.aggregateScore, 0);

      return {
        snapshotHour: row.snapshotHour,
        fetchedAt: row.fetchedAt,
        regionCode: row.regionCode,
        regionName: row.regionName,
        rank: shouldAggregateGlobal ? offset + index + 1 : toNumber(row.rank, 0),
        videoId: row.videoId,
        videoUrl: row.videoUrl,
        title: row.title,
        thumbnailUrl: row.thumbnailUrl,
        categoryId: row.categoryId,
        categoryTitle: row.categoryTitle,
        publishedAt: row.publishedAt,
        durationIso: row.durationIso,
        viewCount: toNullableNumber(row.viewCount),
        likeCount: toNullableNumber(row.likeCount),
        commentCount: toNullableNumber(row.commentCount),
        channelId: row.channelId,
        channelTitle: row.channelTitle,
        channelUrl: row.channelUrl,
        channelAvatarUrl: row.channelAvatarUrl,
        subscriberCount: toNullableNumber(row.subscriberCount),
        hiddenSubscriberCount: toBooleanInt(row.hiddenSubscriberCount),
        tags: pickTagsFromMetadata(row.metadataJson),
        isGlobalAggregate: shouldAggregateGlobal,
        aggregateRegionCount: aggregateRegionCount > 0 ? aggregateRegionCount : undefined,
        aggregateRegionCodes: parseCsvList(row.aggregateRegionCodes),
        aggregateRegionNames: parseCsvList(row.aggregateRegionNames),
        aggregateBestRank: aggregateBestRank > 0 ? aggregateBestRank : undefined,
        aggregateAvgRank: aggregateAvgRank > 0 ? Number(aggregateAvgRank.toFixed(2)) : undefined,
        aggregateScore: aggregateScore > 0 ? aggregateScore : undefined,
      };
    });

    return {
      batch,
      page,
      pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
      data,
    };
  });
}
