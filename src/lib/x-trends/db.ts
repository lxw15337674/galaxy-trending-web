import { sql } from 'drizzle-orm';
import { db } from '@/db/index';
import { toBooleanInt, toJson, toNullableNumber, toNumber } from '@/lib/db/codec';
import { deleteRowsNotInList } from '@/lib/db/hourly-item-diff';
import { areComparableValuesEqual } from '@/lib/db/snapshot-write-guard';
import { nowUtcIso } from '@/lib/db/time';
import {
  type XTrendHistoryPoint,
  type XTrendHistorySeries,
  type XTrendLatestBatch,
  type XTrendRegionGroup,
  type XTrendQueryItem,
  type XTrendQueryResult,
  type XTrendRegionResult,
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
  targetRegionCount: number;
  successRegionCount: number;
  failedRegionCount: number;
}

interface QueryRow {
  snapshotHour: string;
  fetchedAt: string;
  regionKey: string;
  regionLabel: string;
  rank: number;
  trendName: string;
  normalizedKey: string;
  queryText: string | null;
  trendUrl: string | null;
  metaText: string | null;
  tweetVolume: number | null;
}

interface RegionRow {
  regionKey: string;
  regionLabel: string;
  itemCount: number;
}

interface SnapshotCompareRow {
  id: number;
  regionKey: string;
  regionLabel: string;
  status: 'success' | 'failed';
  sourceUrl: string;
  extractionSource: string;
  loggedIn: number;
  itemCount: number;
  errorText: string | null;
}

interface ItemCompareRow {
  snapshotId: number;
  rank: number;
  trendName: string;
  normalizedKey: string;
  queryText: string | null;
  trendUrl: string | null;
  metaText: string | null;
  tweetVolume: number | null;
}

type QueryExecutor = Pick<typeof db, 'all' | 'run'>;

function mapBatchRow(row: BatchMetaRow | null | undefined): XTrendLatestBatch | null {
  if (!row) return null;
  return {
    id: toNumber(row.id, 0),
    snapshotHour: row.snapshotHour,
    generatedAt: row.generatedAt,
    targetRegionCount: toNumber(row.targetRegionCount, 0),
    successRegionCount: toNumber(row.successRegionCount, 0),
    failedRegionCount: toNumber(row.failedRegionCount, 0),
  };
}

async function upsertBatch(executor: QueryExecutor, snapshotHour: string) {
  const now = nowUtcIso();
  const rows = await executor.all<BatchIdRow>(sql`
    INSERT INTO x_trend_hourly_batches (
      snapshot_hour,
      batch_status,
      source_name,
      created_at,
      updated_at
    )
    VALUES (
      ${snapshotHour},
      'pending',
      'x-trends',
      ${now},
      ${now}
    )
    ON CONFLICT(snapshot_hour)
    DO UPDATE SET
      updated_at = excluded.updated_at
    RETURNING id
  `);

  if (!rows[0]?.id) {
    throw new Error(`Failed to upsert x trends batch ${snapshotHour}`);
  }

  return rows[0].id;
}

async function upsertSnapshot(
  executor: QueryExecutor,
  params: {
  batchId: number;
  regionKey: string;
  regionLabel: string;
  sourceUrl: string;
  extractionSource: string;
  loggedIn: boolean;
  status: 'success' | 'failed';
  itemCount: number;
  errorText: string | null;
  rawPayload: string | null;
},
) {
  const rows = await executor.all<BatchIdRow>(sql`
    INSERT INTO x_trend_hourly_snapshots (
      batch_id,
      region_key,
      region_label,
      fetched_at,
      status,
      source_url,
      extraction_source,
      logged_in,
      item_count,
      error_text,
      raw_payload
    )
    VALUES (
      ${params.batchId},
      ${params.regionKey},
      ${params.regionLabel},
      ${nowUtcIso()},
      ${params.status},
      ${params.sourceUrl},
      ${params.extractionSource},
      ${params.loggedIn ? 1 : 0},
      ${params.itemCount},
      ${params.errorText},
      ${params.rawPayload}
    )
    ON CONFLICT(batch_id, region_key)
    DO UPDATE SET
      region_label = excluded.region_label,
      fetched_at = excluded.fetched_at,
      source_url = excluded.source_url,
      extraction_source = excluded.extraction_source,
      logged_in = excluded.logged_in,
      status = CASE
        WHEN x_trend_hourly_snapshots.status = 'success' AND excluded.status = 'failed' THEN x_trend_hourly_snapshots.status
        ELSE excluded.status
      END,
      item_count = CASE
        WHEN x_trend_hourly_snapshots.status = 'success' AND excluded.status = 'failed' THEN x_trend_hourly_snapshots.item_count
        ELSE excluded.item_count
      END,
      error_text = CASE
        WHEN x_trend_hourly_snapshots.status = 'success' AND excluded.status = 'failed' THEN x_trend_hourly_snapshots.error_text
        ELSE excluded.error_text
      END,
      raw_payload = CASE
        WHEN x_trend_hourly_snapshots.status = 'success' AND excluded.status = 'failed' THEN x_trend_hourly_snapshots.raw_payload
        ELSE excluded.raw_payload
      END
    RETURNING id
  `);

  if (!rows[0]?.id) {
    throw new Error(`Failed to upsert x trends snapshot ${params.batchId}/${params.regionKey}`);
  }

  return rows[0].id;
}

function normalizeXTrendResultForComparison(result: XTrendRegionResult) {
  if (result.status === 'success') {
    return {
      regionKey: result.regionKey,
      regionLabel: result.regionLabel,
      status: 'success',
      sourceUrl: result.sourceUrl,
      extractionSource: result.extractionSource,
      loggedIn: result.loggedIn,
      items: result.items.map((item) => ({
        rank: item.rank,
        trendName: item.trendName,
        normalizedKey: item.normalizedKey,
        queryText: item.queryText,
        trendUrl: item.trendUrl,
        metaText: item.metaText,
        tweetVolume: item.tweetVolume,
      })),
    };
  }

  return {
    regionKey: result.regionKey,
    regionLabel: result.regionLabel,
    status: 'failed',
    sourceUrl: result.sourceUrl,
    extractionSource: result.extractionSource ?? 'network',
    loggedIn: result.loggedIn,
    errorText: `[${result.errorCode}] ${result.error}`.slice(0, 1000),
  };
}

async function loadExistingXTrendBatchComparison(snapshotHour: string) {
  const batchRows = await db.all<BatchIdRow>(sql`
    SELECT id
    FROM x_trend_hourly_batches
    WHERE snapshot_hour = ${snapshotHour}
    LIMIT 1
  `);
  const batchId = batchRows[0]?.id;
  if (!batchId) return null;

  const snapshotRows = await db.all<SnapshotCompareRow>(sql`
    SELECT
      id,
      region_key as regionKey,
      region_label as regionLabel,
      status,
      source_url as sourceUrl,
      extraction_source as extractionSource,
      logged_in as loggedIn,
      item_count as itemCount,
      error_text as errorText
    FROM x_trend_hourly_snapshots
    WHERE batch_id = ${batchId}
    ORDER BY region_key ASC
  `);

  const successSnapshotIds = snapshotRows.filter((row) => row.status === 'success').map((row) => row.id);
  const itemRows = successSnapshotIds.length
    ? await db.all<ItemCompareRow>(sql`
        SELECT
          snapshot_id as snapshotId,
          rank,
          trend_name as trendName,
          normalized_key as normalizedKey,
          query_text as queryText,
          trend_url as trendUrl,
          meta_text as metaText,
          tweet_volume as tweetVolume
        FROM x_trend_hourly_items
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
          regionKey: row.regionKey,
          regionLabel: row.regionLabel,
          status: 'success',
          sourceUrl: row.sourceUrl,
          extractionSource: row.extractionSource,
          loggedIn: toBooleanInt(row.loggedIn),
          items: (itemsBySnapshotId.get(row.id) ?? []).map((item) => ({
            rank: item.rank,
            trendName: item.trendName,
            normalizedKey: item.normalizedKey,
            queryText: item.queryText,
            trendUrl: item.trendUrl,
            metaText: item.metaText,
            tweetVolume: toNullableNumber(item.tweetVolume),
          })),
        };
      }

      return {
        regionKey: row.regionKey,
        regionLabel: row.regionLabel,
        status: 'failed',
        sourceUrl: row.sourceUrl,
        extractionSource: row.extractionSource,
        loggedIn: toBooleanInt(row.loggedIn),
        errorText: row.errorText,
      };
    }),
  };
}

async function replaceSnapshotItems(
  executor: QueryExecutor,
  snapshotId: number,
  result: Extract<XTrendRegionResult, { status: 'success' }>,
) {
  await deleteRowsNotInList({
    executor,
    tableName: 'x_trend_hourly_items',
    snapshotId,
    keyColumn: 'rank',
    keepKeys: Array.from(new Set(result.items.map((item) => item.rank))),
  });
  if (!result.items.length) return;

  const createdAt = nowUtcIso();
  const valueRows = result.items.map((item) => sql`
    (
      ${snapshotId},
      ${item.rank},
      ${item.trendName},
      ${item.normalizedKey},
      ${item.queryText},
      ${item.trendUrl},
      ${item.metaText},
      ${item.tweetVolume},
      ${createdAt}
    )
  `);

  await executor.run(sql`
    INSERT INTO x_trend_hourly_items (
      snapshot_id,
      rank,
      trend_name,
      normalized_key,
      query_text,
      trend_url,
      meta_text,
      tweet_volume,
      created_at
    )
    VALUES ${sql.join(valueRows, sql`, `)}
    ON CONFLICT(snapshot_id, rank)
    DO UPDATE SET
      trend_name = excluded.trend_name,
      normalized_key = excluded.normalized_key,
      query_text = excluded.query_text,
      trend_url = excluded.trend_url,
      meta_text = excluded.meta_text,
      tweet_volume = excluded.tweet_volume
  `);
}

async function updateBatchSummary(executor: QueryExecutor, batchId: number, targetRegionCount: number) {
  const rows = await executor.all<BatchMetaRow>(sql`
    SELECT
      b.id as id,
      b.snapshot_hour as snapshotHour,
      COALESCE(MAX(s.fetched_at), b.updated_at) as generatedAt,
      ${targetRegionCount} as targetRegionCount,
      SUM(CASE WHEN s.status = 'success' THEN 1 ELSE 0 END) as successRegionCount,
      SUM(CASE WHEN s.status = 'failed' THEN 1 ELSE 0 END) as failedRegionCount
    FROM x_trend_hourly_batches b
    LEFT JOIN x_trend_hourly_snapshots s ON s.batch_id = b.id
    WHERE b.id = ${batchId}
    GROUP BY b.id, b.snapshot_hour, b.updated_at
  `);

  const summary = mapBatchRow(rows[0]);
  if (!summary) {
    throw new Error(`Failed to recalculate x trends batch ${batchId}`);
  }

  const nextStatus =
    summary.successRegionCount > 0 && summary.failedRegionCount === 0 && summary.successRegionCount === targetRegionCount
      ? 'published'
      : 'failed';
  const generatedAt = summary.snapshotHour;

  await executor.run(sql`
    UPDATE x_trend_hourly_batches
    SET
      batch_status = ${nextStatus},
      generated_at = ${generatedAt},
      target_region_count = ${targetRegionCount},
      success_region_count = ${summary.successRegionCount},
      failed_region_count = ${summary.failedRegionCount},
      updated_at = ${nowUtcIso()}
    WHERE id = ${batchId}
  `);

  return {
    ...summary,
    generatedAt,
    targetRegionCount,
  } satisfies XTrendLatestBatch;
}

export async function saveXTrendHourlyResults(snapshotHour: string, results: XTrendRegionResult[]) {
  const normalizedResults = results
    .map(normalizeXTrendResultForComparison)
    .sort((left, right) => left.regionKey.localeCompare(right.regionKey));
  const existingBatch = await loadExistingXTrendBatchComparison(snapshotHour);
  if (existingBatch) {
    const existingResults = [...existingBatch.results].sort((left, right) => left.regionKey.localeCompare(right.regionKey));
    if (areComparableValuesEqual(existingResults, normalizedResults)) {
      const success = results.filter((result) => result.status === 'success').length;
      const failed = results.length - success;
      console.log(`[x-trends] skipped batch save for ${snapshotHour}; content unchanged`);
      return {
        batchId: existingBatch.batchId,
        success,
        failed,
        batch: {
          id: existingBatch.batchId,
          snapshotHour,
          generatedAt: snapshotHour,
          targetRegionCount: results.length,
          successRegionCount: success,
          failedRegionCount: failed,
        } satisfies XTrendLatestBatch,
      };
    }
  }

  return db.transaction(async (tx) => {
    const batchId = await upsertBatch(tx, snapshotHour);
    let success = 0;
    let failed = 0;

    for (const result of results) {
      if (result.status === 'success') {
        const snapshotId = await upsertSnapshot(tx, {
          batchId,
          regionKey: result.regionKey,
          regionLabel: result.regionLabel,
          sourceUrl: result.sourceUrl,
          extractionSource: result.extractionSource,
          loggedIn: result.loggedIn,
          status: 'success',
          itemCount: result.items.length,
          errorText: null,
          rawPayload: toJson(result.rawPayload),
        });
        await replaceSnapshotItems(tx, snapshotId, result);
        success += 1;
        continue;
      }

      await upsertSnapshot(tx, {
        batchId,
        regionKey: result.regionKey,
        regionLabel: result.regionLabel,
        sourceUrl: result.sourceUrl,
        extractionSource: result.extractionSource ?? 'network',
        loggedIn: result.loggedIn,
        status: 'failed',
        itemCount: 0,
        errorText: `[${result.errorCode}] ${result.error}`.slice(0, 1000),
        rawPayload: toJson(result.rawPayload),
      });
      failed += 1;
    }

    const batch = await updateBatchSummary(tx, batchId, results.length);
    return {
      batchId,
      success,
      failed,
      batch,
    };
  });
}

export async function getLatestPublishedXTrendBatch(): Promise<XTrendLatestBatch | null> {
  const rows = await db.all<BatchMetaRow>(sql`
    SELECT
      id,
      snapshot_hour as snapshotHour,
      generated_at as generatedAt,
      target_region_count as targetRegionCount,
      success_region_count as successRegionCount,
      failed_region_count as failedRegionCount
    FROM x_trend_hourly_batches
    WHERE batch_status = 'published'
    ORDER BY snapshot_hour DESC
    LIMIT 1
  `);

  return mapBatchRow(rows[0]);
}

export async function listLatestXTrendRegions() {
  const batch = await getLatestPublishedXTrendBatch();
  if (!batch) return [];

  const rows = await db.all<RegionRow>(sql`
    SELECT
      s.region_key as regionKey,
      s.region_label as regionLabel,
      s.item_count as itemCount
    FROM x_trend_hourly_snapshots s
    WHERE s.batch_id = ${batch.id} AND s.status = 'success'
    ORDER BY s.id ASC
  `);

  return rows.map((row) => ({
    regionKey: row.regionKey,
    regionLabel: row.regionLabel,
    itemCount: toNumber(row.itemCount, 0),
  }));
}

export async function queryLatestXTrends(params: {
  regionKey: string;
  page?: number;
  pageSize?: number;
}): Promise<XTrendQueryResult> {
  const page = Math.max(1, Math.floor(params.page ?? 1));
  const pageSize = Math.min(100, Math.max(1, Math.floor(params.pageSize ?? 30)));
  const offset = (page - 1) * pageSize;
  const regionKey = params.regionKey.trim().toLowerCase();
  const batch = await getLatestPublishedXTrendBatch();

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

  const countRows = await db.all<CountRow>(sql`
    SELECT COUNT(*) as total
    FROM x_trend_hourly_items i
    JOIN x_trend_hourly_snapshots s ON s.id = i.snapshot_id
    WHERE s.batch_id = ${batch.id} AND s.status = 'success' AND s.region_key = ${regionKey}
  `);

  const rows = await db.all<QueryRow>(sql`
    SELECT
      ${batch.snapshotHour} as snapshotHour,
      s.fetched_at as fetchedAt,
      s.region_key as regionKey,
      s.region_label as regionLabel,
      i.rank as rank,
      i.trend_name as trendName,
      i.normalized_key as normalizedKey,
      i.query_text as queryText,
      i.trend_url as trendUrl,
      i.meta_text as metaText,
      i.tweet_volume as tweetVolume
    FROM x_trend_hourly_items i
    JOIN x_trend_hourly_snapshots s ON s.id = i.snapshot_id
    WHERE s.batch_id = ${batch.id} AND s.status = 'success' AND s.region_key = ${regionKey}
    ORDER BY i.rank ASC
    LIMIT ${pageSize}
    OFFSET ${offset}
  `);

  const total = toNumber(countRows[0]?.total, 0);
  return {
    batch,
    page,
    pageSize,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    data: rows.map((row) => ({
      snapshotHour: row.snapshotHour,
      fetchedAt: row.fetchedAt,
      regionKey: row.regionKey,
      regionLabel: row.regionLabel,
      rank: toNumber(row.rank, 0),
      trendName: row.trendName,
      normalizedKey: row.normalizedKey,
      queryText: row.queryText,
      trendUrl: row.trendUrl,
      metaText: row.metaText,
      tweetVolume: toNullableNumber(row.tweetVolume),
    })),
  };
}

export async function queryLatestXTrendRegionGroups(limitPerRegion = 20): Promise<{
  batch: XTrendLatestBatch | null;
  groups: XTrendRegionGroup[];
}> {
  const batch = await getLatestPublishedXTrendBatch();
  const normalizedLimit = Math.min(50, Math.max(1, Math.floor(limitPerRegion)));

  if (!batch) {
    return {
      batch: null,
      groups: [],
    };
  }

  const regions = await listLatestXTrendRegions();
  if (!regions.length) {
    return {
      batch,
      groups: [],
    };
  }

  const rows = await db.all<QueryRow>(sql`
    SELECT
      ${batch.snapshotHour} as snapshotHour,
      s.fetched_at as fetchedAt,
      s.region_key as regionKey,
      s.region_label as regionLabel,
      i.rank as rank,
      i.trend_name as trendName,
      i.normalized_key as normalizedKey,
      i.query_text as queryText,
      i.trend_url as trendUrl,
      i.meta_text as metaText,
      i.tweet_volume as tweetVolume
    FROM x_trend_hourly_items i
    JOIN x_trend_hourly_snapshots s ON s.id = i.snapshot_id
    WHERE
      s.batch_id = ${batch.id}
      AND s.status = 'success'
      AND i.rank <= ${normalizedLimit}
    ORDER BY s.id ASC, i.rank ASC
  `);

  const itemsByRegion = new Map<string, XTrendQueryItem[]>();
  for (const row of rows) {
    const regionItems = itemsByRegion.get(row.regionKey) ?? [];
    regionItems.push({
      snapshotHour: row.snapshotHour,
      fetchedAt: row.fetchedAt,
      regionKey: row.regionKey,
      regionLabel: row.regionLabel,
      rank: toNumber(row.rank, 0),
      trendName: row.trendName,
      normalizedKey: row.normalizedKey,
      queryText: row.queryText,
      trendUrl: row.trendUrl,
      metaText: row.metaText,
      tweetVolume: toNullableNumber(row.tweetVolume),
    });
    itemsByRegion.set(row.regionKey, regionItems);
  }

  return {
    batch,
    groups: regions.map((region) => ({
      regionKey: region.regionKey,
      regionLabel: region.regionLabel,
      itemCount: region.itemCount,
      items: itemsByRegion.get(region.regionKey) ?? [],
    })),
  };
}

export async function getRecentXTrendHistory(regionKey: string, limitHours = 24): Promise<XTrendHistorySeries[]> {
  const normalizedRegionKey = regionKey.trim().toLowerCase();
  const rows = await db.all<QueryRow>(sql`
    SELECT
      b.snapshot_hour as snapshotHour,
      s.fetched_at as fetchedAt,
      s.region_key as regionKey,
      s.region_label as regionLabel,
      i.rank as rank,
      i.trend_name as trendName,
      i.normalized_key as normalizedKey,
      i.query_text as queryText,
      i.trend_url as trendUrl,
      i.meta_text as metaText,
      i.tweet_volume as tweetVolume
    FROM x_trend_hourly_items i
    JOIN x_trend_hourly_snapshots s ON s.id = i.snapshot_id
    JOIN x_trend_hourly_batches b ON b.id = s.batch_id
    WHERE
      s.status = 'success'
      AND b.batch_status = 'published'
      AND s.region_key = ${normalizedRegionKey}
    ORDER BY b.snapshot_hour DESC, i.rank ASC
    LIMIT ${Math.max(1, Math.floor(limitHours)) * 50}
  `);

  const seriesMap = new Map<string, XTrendHistorySeries>();

  for (const row of rows) {
    const point: XTrendHistoryPoint = {
      snapshotHour: row.snapshotHour,
      fetchedAt: row.fetchedAt,
      regionKey: row.regionKey,
      regionLabel: row.regionLabel,
      rank: toNumber(row.rank, 0),
      trendName: row.trendName,
      normalizedKey: row.normalizedKey,
      queryText: row.queryText,
      trendUrl: row.trendUrl,
      metaText: row.metaText,
      tweetVolume: toNullableNumber(row.tweetVolume),
    };

    const current = seriesMap.get(point.normalizedKey);
    if (!current) {
      seriesMap.set(point.normalizedKey, {
        normalizedKey: point.normalizedKey,
        trendName: point.trendName,
        appearances: 1,
        bestRank: point.rank,
        latestRank: point.rank,
        maxTweetVolume: point.tweetVolume,
        points: [point],
      });
      continue;
    }

    current.appearances += 1;
    current.bestRank = Math.min(current.bestRank, point.rank);
    current.latestRank = point.rank;
    current.maxTweetVolume =
      current.maxTweetVolume == null
        ? point.tweetVolume
        : point.tweetVolume == null
          ? current.maxTweetVolume
          : Math.max(current.maxTweetVolume, point.tweetVolume);
    current.points.push(point);
  }

  return Array.from(seriesMap.values())
    .map((series) => ({
      ...series,
      points: [...series.points].sort((left, right) => left.snapshotHour.localeCompare(right.snapshotHour)),
    }))
    .sort((left, right) => left.bestRank - right.bestRank || right.appearances - left.appearances);
}

export async function getLatestXTrendSnapshotHealth(regionKey: string) {
  const rows = await db.all<
    {
      snapshotHour: string;
      fetchedAt: string;
      status: string;
      extractionSource: string;
      loggedIn: number;
      itemCount: number;
      errorText: string | null;
    }
  >(sql`
    SELECT
      b.snapshot_hour as snapshotHour,
      s.fetched_at as fetchedAt,
      s.status as status,
      s.extraction_source as extractionSource,
      s.logged_in as loggedIn,
      s.item_count as itemCount,
      s.error_text as errorText
    FROM x_trend_hourly_snapshots s
    JOIN x_trend_hourly_batches b ON b.id = s.batch_id
    WHERE s.region_key = ${regionKey.trim().toLowerCase()}
    ORDER BY b.snapshot_hour DESC
    LIMIT 1
  `);

  const row = rows[0];
  if (!row) return null;

  return {
    snapshotHour: row.snapshotHour,
    fetchedAt: row.fetchedAt,
    status: row.status,
    extractionSource: row.extractionSource,
    loggedIn: toBooleanInt(row.loggedIn),
    itemCount: toNumber(row.itemCount, 0),
    errorText: row.errorText,
  };
}
