import { sql } from 'drizzle-orm';
import { db } from '@/db/index';
import { ensureXTrendSchema } from './ensure-schema';
import {
  type XTrendHistoryPoint,
  type XTrendHistorySeries,
  type XTrendLatestBatch,
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

function nowUtcIso() {
  return new Date().toISOString();
}

function toJson(value: unknown) {
  if (value == null) return null;
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toNullableNumber(value: unknown) {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toBooleanInt(value: unknown) {
  return toNumber(value, 0) === 1;
}

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

async function upsertBatch(snapshotHour: string) {
  const now = nowUtcIso();
  const rows = await db.all<BatchIdRow>(sql`
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

async function upsertSnapshot(params: {
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
}) {
  const rows = await db.all<BatchIdRow>(sql`
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

async function replaceSnapshotItems(
  snapshotId: number,
  result: Extract<XTrendRegionResult, { status: 'success' }>,
) {
  await db.run(sql`DELETE FROM x_trend_hourly_items WHERE snapshot_id = ${snapshotId}`);
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

  await db.run(sql`
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
  `);
}

async function updateBatchSummary(batchId: number, targetRegionCount: number) {
  const rows = await db.all<BatchMetaRow>(sql`
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

  await db.run(sql`
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
  await ensureXTrendSchema();
  const batchId = await upsertBatch(snapshotHour);
  let success = 0;
  let failed = 0;

  for (const result of results) {
    if (result.status === 'success') {
      const snapshotId = await upsertSnapshot({
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
      await replaceSnapshotItems(snapshotId, result);
      success += 1;
      continue;
    }

    await upsertSnapshot({
      batchId,
      regionKey: result.regionKey,
      regionLabel: result.regionLabel,
      sourceUrl: result.sourceUrl,
      extractionSource: result.extractionSource ?? 'network',
      loggedIn: result.loggedIn,
      status: 'failed',
      itemCount: 0,
      errorText: result.error.slice(0, 1000),
      rawPayload: toJson(result.rawPayload),
    });
    failed += 1;
  }

  const batch = await updateBatchSummary(batchId, results.length);
  return {
    batchId,
    success,
    failed,
    batch,
  };
}

export async function getLatestPublishedXTrendBatch(): Promise<XTrendLatestBatch | null> {
  await ensureXTrendSchema();
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

export async function queryLatestXTrends(params: {
  regionKey: string;
  page?: number;
  pageSize?: number;
}): Promise<XTrendQueryResult> {
  await ensureXTrendSchema();
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

export async function getRecentXTrendHistory(regionKey: string, limitHours = 24): Promise<XTrendHistorySeries[]> {
  await ensureXTrendSchema();
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
  await ensureXTrendSchema();
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
