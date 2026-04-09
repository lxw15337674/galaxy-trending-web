import { sql } from 'drizzle-orm';
import { db } from '@/db/index';
import { parseJsonObject, toJson, toNullableNumber, toNumber } from '@/lib/db/codec';
import { nowUtcIso } from '@/lib/db/time';
import type {
  TikTokVideoCountryFilter,
  TikTokVideoLatestBatch,
  TikTokVideoOrderBy,
  TikTokVideoQueryResult,
  TikTokVideoScopeFilter,
  TikTokVideoTargetResult,
} from './types';

interface BatchIdRow {
  id: number;
}

interface BatchMetaRow {
  id: number;
  snapshotHour: string;
  generatedAt: string;
  targetScopeCount: number;
  successScopeCount: number;
  failedScopeCount: number;
}

interface ScopeRow {
  period: number;
  orderBy: TikTokVideoOrderBy;
  countryCount: number;
}

interface CountryRow {
  countryCode: string;
  countryName: string;
  itemCount: number;
}

interface QueryRow {
  snapshotHour: string;
  fetchedAt: string;
  countryCode: string;
  countryName: string;
  period: number;
  orderBy: TikTokVideoOrderBy;
  rank: number;
  videoId: string;
  itemId: string;
  itemUrl: string;
  title: string;
  coverUrl: string | null;
  durationSeconds: number | null;
  regionName: string | null;
  rawItemJson: string | null;
}

function mapBatchRow(row: BatchMetaRow | null | undefined): TikTokVideoLatestBatch | null {
  if (!row) return null;
  return {
    id: toNumber(row.id, 0),
    snapshotHour: row.snapshotHour,
    generatedAt: row.generatedAt,
    targetScopeCount: toNumber(row.targetScopeCount, 0),
    successScopeCount: toNumber(row.successScopeCount, 0),
    failedScopeCount: toNumber(row.failedScopeCount, 0),
  };
}

async function upsertBatch(snapshotHour: string) {
  const now = nowUtcIso();
  const rows = await db.all<BatchIdRow>(sql`
    INSERT INTO tiktok_video_hourly_batches (
      snapshot_hour,
      batch_status,
      source_name,
      created_at,
      updated_at
    )
    VALUES (
      ${snapshotHour},
      'pending',
      'tiktok-creative-center-videos',
      ${now},
      ${now}
    )
    ON CONFLICT(snapshot_hour)
    DO UPDATE SET
      updated_at = excluded.updated_at
    RETURNING id
  `);

  if (!rows[0]?.id) {
    throw new Error(`Failed to upsert TikTok videos batch ${snapshotHour}`);
  }

  return rows[0].id;
}

async function upsertSnapshot(params: {
  batchId: number;
  countryCode: string;
  countryName: string;
  period: number;
  orderBy: TikTokVideoOrderBy;
  sourceUrl: string;
  listApiUrl: string | null;
  status: 'success' | 'failed';
  pageCount: number;
  itemCount: number;
  totalCount: number;
  errorText: string | null;
  warningsJson: string | null;
  timingsJson: string | null;
  rawPayload: string | null;
}) {
  const rows = await db.all<BatchIdRow>(sql`
    INSERT INTO tiktok_video_hourly_snapshots (
      batch_id,
      country_code,
      country_name,
      period,
      order_by,
      fetched_at,
      status,
      source_url,
      list_api_url,
      page_count,
      item_count,
      total_count,
      error_text,
      warnings_json,
      timings_json,
      raw_payload
    )
    VALUES (
      ${params.batchId},
      ${params.countryCode},
      ${params.countryName},
      ${params.period},
      ${params.orderBy},
      ${nowUtcIso()},
      ${params.status},
      ${params.sourceUrl},
      ${params.listApiUrl},
      ${params.pageCount},
      ${params.itemCount},
      ${params.totalCount},
      ${params.errorText},
      ${params.warningsJson},
      ${params.timingsJson},
      ${params.rawPayload}
    )
    ON CONFLICT(batch_id, country_code, period, order_by)
    DO UPDATE SET
      country_name = excluded.country_name,
      fetched_at = excluded.fetched_at,
      status = CASE
        WHEN tiktok_video_hourly_snapshots.status = 'success' AND excluded.status = 'failed' THEN tiktok_video_hourly_snapshots.status
        ELSE excluded.status
      END,
      source_url = excluded.source_url,
      list_api_url = excluded.list_api_url,
      page_count = CASE
        WHEN tiktok_video_hourly_snapshots.status = 'success' AND excluded.status = 'failed' THEN tiktok_video_hourly_snapshots.page_count
        ELSE excluded.page_count
      END,
      item_count = CASE
        WHEN tiktok_video_hourly_snapshots.status = 'success' AND excluded.status = 'failed' THEN tiktok_video_hourly_snapshots.item_count
        ELSE excluded.item_count
      END,
      total_count = CASE
        WHEN tiktok_video_hourly_snapshots.status = 'success' AND excluded.status = 'failed' THEN tiktok_video_hourly_snapshots.total_count
        ELSE excluded.total_count
      END,
      error_text = CASE
        WHEN tiktok_video_hourly_snapshots.status = 'success' AND excluded.status = 'failed' THEN tiktok_video_hourly_snapshots.error_text
        ELSE excluded.error_text
      END,
      warnings_json = CASE
        WHEN tiktok_video_hourly_snapshots.status = 'success' AND excluded.status = 'failed' THEN tiktok_video_hourly_snapshots.warnings_json
        ELSE excluded.warnings_json
      END,
      timings_json = excluded.timings_json,
      raw_payload = CASE
        WHEN tiktok_video_hourly_snapshots.status = 'success' AND excluded.status = 'failed' THEN tiktok_video_hourly_snapshots.raw_payload
        ELSE excluded.raw_payload
      END
    RETURNING id
  `);

  if (!rows[0]?.id) {
    throw new Error(
      `Failed to upsert TikTok videos snapshot ${params.batchId}/${params.countryCode}/${params.period}/${params.orderBy}`,
    );
  }

  return rows[0].id;
}

async function replaceSnapshotItems(
  snapshotId: number,
  result: Extract<TikTokVideoTargetResult, { status: 'success' }>,
) {
  await db.run(sql`DELETE FROM tiktok_video_hourly_items WHERE snapshot_id = ${snapshotId}`);
  if (!result.items.length) return;

  const createdAt = nowUtcIso();
  const valueRows = result.items.map((item) => sql`
    (
      ${snapshotId},
      ${item.rank},
      ${item.videoId},
      ${item.itemId},
      ${item.itemUrl},
      ${item.title},
      ${item.coverUrl},
      ${item.durationSeconds},
      ${item.regionName},
      ${toJson(item.rawItem)},
      ${createdAt}
    )
  `);

  await db.run(sql`
    INSERT INTO tiktok_video_hourly_items (
      snapshot_id,
      rank,
      video_id,
      item_id,
      item_url,
      title,
      cover_url,
      duration_seconds,
      region_name,
      raw_item_json,
      created_at
    )
    VALUES ${sql.join(valueRows, sql`, `)}
  `);
}

async function updateBatchSummary(batchId: number, targetScopeCount: number) {
  const rows = await db.all<BatchMetaRow>(sql`
    SELECT
      b.id as id,
      b.snapshot_hour as snapshotHour,
      COALESCE(MAX(s.fetched_at), b.updated_at) as generatedAt,
      ${targetScopeCount} as targetScopeCount,
      SUM(CASE WHEN s.status = 'success' THEN 1 ELSE 0 END) as successScopeCount,
      SUM(CASE WHEN s.status = 'failed' THEN 1 ELSE 0 END) as failedScopeCount
    FROM tiktok_video_hourly_batches b
    LEFT JOIN tiktok_video_hourly_snapshots s ON s.batch_id = b.id
    WHERE b.id = ${batchId}
    GROUP BY b.id, b.snapshot_hour, b.updated_at
  `);

  const summary = mapBatchRow(rows[0]);
  if (!summary) {
    throw new Error(`Failed to recalculate TikTok videos batch ${batchId}`);
  }

  const nextStatus =
    summary.successScopeCount > 0
      ? 'published'
      : 'failed';
  const generatedAt = summary.snapshotHour;

  await db.run(sql`
    UPDATE tiktok_video_hourly_batches
    SET
      batch_status = ${nextStatus},
      generated_at = ${generatedAt},
      target_scope_count = ${targetScopeCount},
      success_scope_count = ${summary.successScopeCount},
      failed_scope_count = ${summary.failedScopeCount},
      updated_at = ${nowUtcIso()}
    WHERE id = ${batchId}
  `);

  return {
    ...summary,
    generatedAt,
    targetScopeCount,
  } satisfies TikTokVideoLatestBatch;
}

export async function saveTikTokVideoHourlyResults(snapshotHour: string, results: TikTokVideoTargetResult[]) {
  const batchId = await upsertBatch(snapshotHour);
  let success = 0;
  let failed = 0;

  for (const result of results) {
    if (result.status === 'success') {
      const snapshotId = await upsertSnapshot({
        batchId,
        countryCode: result.countryCode,
        countryName: result.countryName,
        period: result.period,
        orderBy: result.orderBy,
        sourceUrl: result.sourceUrl,
        listApiUrl: result.listApiUrl,
        status: 'success',
        pageCount: result.pageCount,
        itemCount: result.items.length,
        totalCount: result.totalCount,
        errorText: null,
        warningsJson: toJson(result.warnings),
        timingsJson: toJson(result.timingsMs),
        rawPayload: toJson(result),
      });
      await replaceSnapshotItems(snapshotId, result);
      success += 1;
      continue;
    }

    await upsertSnapshot({
      batchId,
      countryCode: result.countryCode,
      countryName: result.countryName,
      period: result.period,
      orderBy: result.orderBy,
      sourceUrl: result.sourceUrl,
      listApiUrl: result.listApiUrl,
      status: 'failed',
      pageCount: result.pageCount,
      itemCount: 0,
      totalCount: result.totalCount,
      errorText: `[${result.errorCode}] ${result.error}`.slice(0, 1000),
      warningsJson: null,
      timingsJson: toJson(result.timingsMs),
      rawPayload: toJson(result),
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

export async function getLatestPublishedTikTokVideoBatch(): Promise<TikTokVideoLatestBatch | null> {
  const rows = await db.all<BatchMetaRow>(sql`
    SELECT
      id,
      snapshot_hour as snapshotHour,
      generated_at as generatedAt,
      target_scope_count as targetScopeCount,
      success_scope_count as successScopeCount,
      failed_scope_count as failedScopeCount
    FROM tiktok_video_hourly_batches
    WHERE batch_status = 'published'
    ORDER BY snapshot_hour DESC
    LIMIT 1
  `);

  return mapBatchRow(rows[0]);
}

export async function getLatestCompleteTikTokVideoBatch(): Promise<TikTokVideoLatestBatch | null> {
  const rows = await db.all<BatchMetaRow>(sql`
    SELECT
      id,
      snapshot_hour as snapshotHour,
      generated_at as generatedAt,
      target_scope_count as targetScopeCount,
      success_scope_count as successScopeCount,
      failed_scope_count as failedScopeCount
    FROM tiktok_video_hourly_batches
    WHERE
      target_scope_count > 0
      AND success_scope_count = target_scope_count
      AND failed_scope_count = 0
    ORDER BY snapshot_hour DESC
    LIMIT 1
  `);

  return mapBatchRow(rows[0]);
}

export async function listLatestTikTokVideoScopes(): Promise<TikTokVideoScopeFilter[]> {
  const batch = await getLatestPublishedTikTokVideoBatch();
  if (!batch) return [];

  const rows = await db.all<ScopeRow>(sql`
    SELECT
      s.period as period,
      s.order_by as orderBy,
      COUNT(*) as countryCount
    FROM tiktok_video_hourly_snapshots s
    WHERE s.batch_id = ${batch.id} AND s.status = 'success'
    GROUP BY s.period, s.order_by
    ORDER BY s.period ASC, s.order_by ASC
  `);

  return rows.map((row) => ({
    period: toNumber(row.period, 0),
    orderBy: row.orderBy,
    countryCount: toNumber(row.countryCount, 0),
  }));
}

export async function listLatestTikTokVideoCountries(
  period: number,
  orderBy: TikTokVideoOrderBy,
): Promise<TikTokVideoCountryFilter[]> {
  const batch = await getLatestPublishedTikTokVideoBatch();
  if (!batch) return [];

  const rows = await db.all<CountryRow>(sql`
    SELECT
      s.country_code as countryCode,
      s.country_name as countryName,
      s.item_count as itemCount
    FROM tiktok_video_hourly_snapshots s
    WHERE
      s.batch_id = ${batch.id}
      AND s.status = 'success'
      AND s.period = ${period}
      AND s.order_by = ${orderBy}
    ORDER BY s.country_code ASC
  `);

  return rows.map((row) => ({
    countryCode: row.countryCode,
    countryName: row.countryName,
    itemCount: toNumber(row.itemCount, 0),
  }));
}

export async function queryLatestTikTokVideos(params: {
  countryCode: string;
  period: number;
  orderBy: TikTokVideoOrderBy;
}): Promise<TikTokVideoQueryResult> {
  const normalizedCountryCode = params.countryCode.trim().toUpperCase();
  const batch = await getLatestPublishedTikTokVideoBatch();

  if (!batch) {
    return {
      batch: null,
      country: null,
      data: [],
    };
  }

  const countryRows = await db.all<CountryRow>(sql`
    SELECT
      s.country_code as countryCode,
      s.country_name as countryName,
      s.item_count as itemCount
    FROM tiktok_video_hourly_snapshots s
    WHERE
      s.batch_id = ${batch.id}
      AND s.status = 'success'
      AND s.country_code = ${normalizedCountryCode}
      AND s.period = ${params.period}
      AND s.order_by = ${params.orderBy}
    LIMIT 1
  `);
  const countryRow = countryRows[0];

  if (!countryRow) {
    return {
      batch,
      country: null,
      data: [],
    };
  }

  const rows = await db.all<QueryRow>(sql`
    SELECT
      ${batch.snapshotHour} as snapshotHour,
      s.fetched_at as fetchedAt,
      s.country_code as countryCode,
      s.country_name as countryName,
      s.period as period,
      s.order_by as orderBy,
      i.rank as rank,
      i.video_id as videoId,
      i.item_id as itemId,
      i.item_url as itemUrl,
      i.title as title,
      i.cover_url as coverUrl,
      i.duration_seconds as durationSeconds,
      i.region_name as regionName,
      i.raw_item_json as rawItemJson
    FROM tiktok_video_hourly_items i
    JOIN tiktok_video_hourly_snapshots s ON s.id = i.snapshot_id
    WHERE
      s.batch_id = ${batch.id}
      AND s.status = 'success'
      AND s.country_code = ${normalizedCountryCode}
      AND s.period = ${params.period}
      AND s.order_by = ${params.orderBy}
    ORDER BY i.rank ASC
  `);

  return {
    batch,
    country: {
      countryCode: countryRow.countryCode,
      countryName: countryRow.countryName,
      itemCount: toNumber(countryRow.itemCount, 0),
    },
    data: rows.map((row) => ({
      snapshotHour: row.snapshotHour,
      fetchedAt: row.fetchedAt,
      countryCode: row.countryCode,
      countryName: row.countryName,
      period: toNumber(row.period, 0),
      orderBy: row.orderBy,
      rank: toNumber(row.rank, 0),
      videoId: row.videoId,
      itemId: row.itemId,
      itemUrl: row.itemUrl,
      title: row.title,
      coverUrl: row.coverUrl,
      durationSeconds: toNullableNumber(row.durationSeconds),
      regionName: row.regionName,
      rawItem: parseJsonObject<Record<string, unknown>>(row.rawItemJson),
    })),
  };
}

export async function getLatestTikTokVideoBatchHealth() {
  const rows = await db.all<
    {
      snapshotHour: string;
      generatedAt: string;
      batchStatus: string;
      targetScopeCount: number;
      successScopeCount: number;
      failedScopeCount: number;
    }
  >(sql`
    SELECT
      snapshot_hour as snapshotHour,
      generated_at as generatedAt,
      batch_status as batchStatus,
      target_scope_count as targetScopeCount,
      success_scope_count as successScopeCount,
      failed_scope_count as failedScopeCount
    FROM tiktok_video_hourly_batches
    ORDER BY snapshot_hour DESC
    LIMIT 1
  `);

  const row = rows[0];
  if (!row) return null;

  return {
    snapshotHour: row.snapshotHour,
    generatedAt: row.generatedAt,
    batchStatus: row.batchStatus,
    targetScopeCount: toNumber(row.targetScopeCount, 0),
    successScopeCount: toNumber(row.successScopeCount, 0),
    failedScopeCount: toNumber(row.failedScopeCount, 0),
    isComplete:
      toNumber(row.targetScopeCount, 0) > 0 &&
      toNumber(row.successScopeCount, 0) === toNumber(row.targetScopeCount, 0) &&
      toNumber(row.failedScopeCount, 0) === 0,
  };
}
