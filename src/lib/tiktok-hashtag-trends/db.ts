import { sql } from 'drizzle-orm';
import { db } from '@/db/index';
import { parseJsonObject, toJson, toNullableNumber, toNumber } from '@/lib/db/codec';
import { nowUtcIso } from '@/lib/db/time';
import type {
  TikTokHashtagCountryFilter,
  TikTokHashtagCreatorPreview,
  TikTokHashtagDetail,
  TikTokHashtagLatestBatch,
  TikTokHashtagQueryResult,
  TikTokHashtagTargetResult,
  TikTokHashtagTrendPoint,
} from './types';
import { buildTikTokPublicTagUrl } from './types';

interface BatchIdRow {
  id: number;
}

interface BatchMetaRow {
  id: number;
  snapshotHour: string;
  generatedAt: string;
  targetCountryCount: number;
  successCountryCount: number;
  failedCountryCount: number;
}

interface CountryRow {
  countryCode: string;
  countryName: string;
  itemCount: number;
}

interface CountRow {
  total: number;
}

interface QueryRow {
  snapshotHour: string;
  fetchedAt: string;
  countryCode: string;
  countryName: string;
  rank: number;
  hashtagId: string;
  hashtagName: string;
  publishCount: number | null;
  videoViews: number | null;
  rankDiff: number | null;
  rankDiffType: number | null;
  industryName: string | null;
  detailPageUrl: string;
  trendPointsJson: string | null;
  creatorPreviewJson: string | null;
  detailJson: string | null;
}

function parseTrendPoints(value: string | null): TikTokHashtagTrendPoint[] {
  const parsed = parseJsonObject<unknown>(value);
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const time = Number(record.time);
      const pointValue = Number(record.value);
      if (!Number.isFinite(time) || !Number.isFinite(pointValue)) return null;
      return {
        time,
        value: pointValue,
      } satisfies TikTokHashtagTrendPoint;
    })
    .filter((item): item is TikTokHashtagTrendPoint => item !== null);
}

function parseCreatorPreview(value: string | null): TikTokHashtagCreatorPreview[] {
  const parsed = parseJsonObject<unknown>(value);
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const nickName = typeof record.nickName === 'string' ? record.nickName.trim() : '';
      if (!nickName) return null;
      return {
        nickName,
        avatarUrl: typeof record.avatarUrl === 'string' ? record.avatarUrl : null,
      } satisfies TikTokHashtagCreatorPreview;
    })
    .filter((item): item is TikTokHashtagCreatorPreview => item !== null);
}

function parseDetail(value: string | null): TikTokHashtagDetail | null {
  const parsed = parseJsonObject<unknown>(value);
  if (!parsed || typeof parsed !== 'object') return null;
  const record = parsed as Record<string, unknown>;
  return {
    postsLastPeriodText: typeof record.postsLastPeriodText === 'string' ? record.postsLastPeriodText : null,
    postsOverallText: typeof record.postsOverallText === 'string' ? record.postsOverallText : null,
    relatedHashtags: Array.isArray(record.relatedHashtags)
      ? record.relatedHashtags.filter((item): item is string => typeof item === 'string')
      : [],
    creatorNames: Array.isArray(record.creatorNames)
      ? record.creatorNames.filter((item): item is string => typeof item === 'string')
      : [],
    creatorCount: toNumber(record.creatorCount, 0),
    requestUrls: Array.isArray(record.requestUrls)
      ? record.requestUrls.filter((item): item is string => typeof item === 'string')
      : [],
  } satisfies TikTokHashtagDetail;
}

function mapBatchRow(row: BatchMetaRow | null | undefined): TikTokHashtagLatestBatch | null {
  if (!row) return null;
  return {
    id: toNumber(row.id, 0),
    snapshotHour: row.snapshotHour,
    generatedAt: row.generatedAt,
    targetCountryCount: toNumber(row.targetCountryCount, 0),
    successCountryCount: toNumber(row.successCountryCount, 0),
    failedCountryCount: toNumber(row.failedCountryCount, 0),
  };
}

async function upsertBatch(snapshotHour: string) {
  const now = nowUtcIso();
  const rows = await db.all<BatchIdRow>(sql`
    INSERT INTO tiktok_hashtag_hourly_batches (
      snapshot_hour,
      batch_status,
      source_name,
      created_at,
      updated_at
    )
    VALUES (
      ${snapshotHour},
      'pending',
      'tiktok-creative-center-hashtag',
      ${now},
      ${now}
    )
    ON CONFLICT(snapshot_hour)
    DO UPDATE SET
      updated_at = excluded.updated_at
    RETURNING id
  `);

  if (!rows[0]?.id) {
    throw new Error(`Failed to upsert TikTok hashtag batch ${snapshotHour}`);
  }

  return rows[0].id;
}

async function upsertSnapshot(params: {
  batchId: number;
  countryCode: string;
  countryName: string;
  sourceUrl: string;
  listApiUrl: string | null;
  status: 'success' | 'failed';
  itemCount: number;
  errorText: string | null;
  warningsJson: string | null;
  timingsJson: string | null;
  rawPayload: string | null;
}) {
  const rows = await db.all<BatchIdRow>(sql`
    INSERT INTO tiktok_hashtag_hourly_snapshots (
      batch_id,
      country_code,
      country_name,
      fetched_at,
      status,
      source_url,
      list_api_url,
      item_count,
      error_text,
      warnings_json,
      timings_json,
      raw_payload
    )
    VALUES (
      ${params.batchId},
      ${params.countryCode},
      ${params.countryName},
      ${nowUtcIso()},
      ${params.status},
      ${params.sourceUrl},
      ${params.listApiUrl},
      ${params.itemCount},
      ${params.errorText},
      ${params.warningsJson},
      ${params.timingsJson},
      ${params.rawPayload}
    )
    ON CONFLICT(batch_id, country_code)
    DO UPDATE SET
      country_name = excluded.country_name,
      fetched_at = excluded.fetched_at,
      status = CASE
        WHEN tiktok_hashtag_hourly_snapshots.status = 'success' AND excluded.status = 'failed' THEN tiktok_hashtag_hourly_snapshots.status
        ELSE excluded.status
      END,
      source_url = excluded.source_url,
      list_api_url = excluded.list_api_url,
      item_count = CASE
        WHEN tiktok_hashtag_hourly_snapshots.status = 'success' AND excluded.status = 'failed' THEN tiktok_hashtag_hourly_snapshots.item_count
        ELSE excluded.item_count
      END,
      error_text = CASE
        WHEN tiktok_hashtag_hourly_snapshots.status = 'success' AND excluded.status = 'failed' THEN tiktok_hashtag_hourly_snapshots.error_text
        ELSE excluded.error_text
      END,
      warnings_json = CASE
        WHEN tiktok_hashtag_hourly_snapshots.status = 'success' AND excluded.status = 'failed' THEN tiktok_hashtag_hourly_snapshots.warnings_json
        ELSE excluded.warnings_json
      END,
      timings_json = excluded.timings_json,
      raw_payload = CASE
        WHEN tiktok_hashtag_hourly_snapshots.status = 'success' AND excluded.status = 'failed' THEN tiktok_hashtag_hourly_snapshots.raw_payload
        ELSE excluded.raw_payload
      END
    RETURNING id
  `);

  if (!rows[0]?.id) {
    throw new Error(`Failed to upsert TikTok hashtag snapshot ${params.batchId}/${params.countryCode}`);
  }

  return rows[0].id;
}

async function replaceSnapshotItems(
  snapshotId: number,
  result: Extract<TikTokHashtagTargetResult, { status: 'success' }>,
) {
  await db.run(sql`DELETE FROM tiktok_hashtag_hourly_items WHERE snapshot_id = ${snapshotId}`);
  if (!result.items.length) return;

  const createdAt = nowUtcIso();
  const valueRows = result.items.map((item) => sql`
    (
      ${snapshotId},
      ${item.rank},
      ${item.hashtagId},
      ${item.hashtagName},
      ${item.publishCount},
      ${item.videoViews},
      ${item.rankDiff},
      ${item.rankDiffType},
      ${item.industryName},
      ${item.detailPageUrl},
      ${toJson(item.trendPoints)},
      ${toJson(item.creatorPreview)},
      ${toJson(item.detail ?? null)},
      ${createdAt}
    )
  `);

  await db.run(sql`
    INSERT INTO tiktok_hashtag_hourly_items (
      snapshot_id,
      rank,
      hashtag_id,
      hashtag_name,
      publish_count,
      video_views,
      rank_diff,
      rank_diff_type,
      industry_name,
      detail_page_url,
      trend_points_json,
      creator_preview_json,
      detail_json,
      created_at
    )
    VALUES ${sql.join(valueRows, sql`, `)}
  `);
}

async function updateBatchSummary(batchId: number, targetCountryCount: number) {
  const rows = await db.all<BatchMetaRow>(sql`
    SELECT
      b.id as id,
      b.snapshot_hour as snapshotHour,
      COALESCE(MAX(s.fetched_at), b.updated_at) as generatedAt,
      ${targetCountryCount} as targetCountryCount,
      SUM(CASE WHEN s.status = 'success' THEN 1 ELSE 0 END) as successCountryCount,
      SUM(CASE WHEN s.status = 'failed' THEN 1 ELSE 0 END) as failedCountryCount
    FROM tiktok_hashtag_hourly_batches b
    LEFT JOIN tiktok_hashtag_hourly_snapshots s ON s.batch_id = b.id
    WHERE b.id = ${batchId}
    GROUP BY b.id, b.snapshot_hour, b.updated_at
  `);

  const summary = mapBatchRow(rows[0]);
  if (!summary) {
    throw new Error(`Failed to recalculate TikTok hashtag batch ${batchId}`);
  }

  const nextStatus =
    summary.successCountryCount > 0 &&
    summary.failedCountryCount === 0 &&
    summary.successCountryCount === targetCountryCount
      ? 'published'
      : 'failed';
  const generatedAt = summary.snapshotHour;

  await db.run(sql`
    UPDATE tiktok_hashtag_hourly_batches
    SET
      batch_status = ${nextStatus},
      generated_at = ${generatedAt},
      target_country_count = ${targetCountryCount},
      success_country_count = ${summary.successCountryCount},
      failed_country_count = ${summary.failedCountryCount},
      updated_at = ${nowUtcIso()}
    WHERE id = ${batchId}
  `);

  return {
    ...summary,
    generatedAt,
    targetCountryCount,
  } satisfies TikTokHashtagLatestBatch;
}

export async function saveTikTokHashtagHourlyResults(snapshotHour: string, results: TikTokHashtagTargetResult[]) {
  const batchId = await upsertBatch(snapshotHour);
  let success = 0;
  let failed = 0;

  for (const result of results) {
    if (result.status === 'success') {
      const snapshotId = await upsertSnapshot({
        batchId,
        countryCode: result.countryCode,
        countryName: result.countryName,
        sourceUrl: result.sourceUrl,
        listApiUrl: result.listApiUrl,
        status: 'success',
        itemCount: result.items.length,
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
      sourceUrl: result.sourceUrl,
      listApiUrl: result.listApiUrl,
      status: 'failed',
      itemCount: 0,
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

export async function getLatestPublishedTikTokHashtagBatch(): Promise<TikTokHashtagLatestBatch | null> {
  const rows = await db.all<BatchMetaRow>(sql`
    SELECT
      id,
      snapshot_hour as snapshotHour,
      generated_at as generatedAt,
      target_country_count as targetCountryCount,
      success_country_count as successCountryCount,
      failed_country_count as failedCountryCount
    FROM tiktok_hashtag_hourly_batches
    WHERE batch_status = 'published'
    ORDER BY snapshot_hour DESC
    LIMIT 1
  `);

  return mapBatchRow(rows[0]);
}

export async function listLatestTikTokHashtagCountries(): Promise<TikTokHashtagCountryFilter[]> {
  const batch = await getLatestPublishedTikTokHashtagBatch();
  if (!batch) return [];

  const rows = await db.all<CountryRow>(sql`
    SELECT
      s.country_code as countryCode,
      s.country_name as countryName,
      s.item_count as itemCount
    FROM tiktok_hashtag_hourly_snapshots s
    WHERE s.batch_id = ${batch.id} AND s.status = 'success'
    ORDER BY s.country_code ASC
  `);

  return rows.map((row) => ({
    countryCode: row.countryCode,
    countryName: row.countryName,
    itemCount: toNumber(row.itemCount, 0),
  }));
}

export async function queryLatestTikTokHashtags(countryCode: string): Promise<TikTokHashtagQueryResult> {
  const normalizedCountryCode = countryCode.trim().toUpperCase();
  const batch = await getLatestPublishedTikTokHashtagBatch();

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
    FROM tiktok_hashtag_hourly_snapshots s
    WHERE s.batch_id = ${batch.id} AND s.status = 'success' AND s.country_code = ${normalizedCountryCode}
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
      i.rank as rank,
      i.hashtag_id as hashtagId,
      i.hashtag_name as hashtagName,
      i.publish_count as publishCount,
      i.video_views as videoViews,
      i.rank_diff as rankDiff,
      i.rank_diff_type as rankDiffType,
      i.industry_name as industryName,
      i.detail_page_url as detailPageUrl,
      i.trend_points_json as trendPointsJson,
      i.creator_preview_json as creatorPreviewJson,
      i.detail_json as detailJson
    FROM tiktok_hashtag_hourly_items i
    JOIN tiktok_hashtag_hourly_snapshots s ON s.id = i.snapshot_id
    WHERE s.batch_id = ${batch.id} AND s.status = 'success' AND s.country_code = ${normalizedCountryCode}
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
      rank: toNumber(row.rank, 0),
      hashtagId: row.hashtagId,
      hashtagName: row.hashtagName,
      publishCount: toNullableNumber(row.publishCount),
      videoViews: toNullableNumber(row.videoViews),
      rankDiff: toNullableNumber(row.rankDiff),
      rankDiffType: toNullableNumber(row.rankDiffType),
      industryName: row.industryName,
      detailPageUrl: row.detailPageUrl,
      publicTagUrl: buildTikTokPublicTagUrl(row.hashtagName),
      trendPoints: parseTrendPoints(row.trendPointsJson),
      creatorPreview: parseCreatorPreview(row.creatorPreviewJson),
      detail: parseDetail(row.detailJson),
    })),
  };
}

export async function getLatestTikTokHashtagSnapshotHealth(countryCode: string) {
  const rows = await db.all<
    {
      snapshotHour: string;
      fetchedAt: string;
      status: string;
      itemCount: number;
      errorText: string | null;
    }
  >(sql`
    SELECT
      b.snapshot_hour as snapshotHour,
      s.fetched_at as fetchedAt,
      s.status as status,
      s.item_count as itemCount,
      s.error_text as errorText
    FROM tiktok_hashtag_hourly_snapshots s
    JOIN tiktok_hashtag_hourly_batches b ON b.id = s.batch_id
    WHERE s.country_code = ${countryCode.trim().toUpperCase()}
    ORDER BY b.snapshot_hour DESC
    LIMIT 1
  `);

  const row = rows[0];
  if (!row) return null;

  return {
    snapshotHour: row.snapshotHour,
    fetchedAt: row.fetchedAt,
    status: row.status,
    itemCount: toNumber(row.itemCount, 0),
    errorText: row.errorText,
  };
}

export async function countLatestTikTokHashtagCountries() {
  const batch = await getLatestPublishedTikTokHashtagBatch();
  if (!batch) return 0;

  const rows = await db.all<CountRow>(sql`
    SELECT COUNT(*) as total
    FROM tiktok_hashtag_hourly_snapshots s
    WHERE s.batch_id = ${batch.id} AND s.status = 'success'
  `);

  return toNumber(rows[0]?.total, 0);
}
