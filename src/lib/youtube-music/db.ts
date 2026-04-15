import { sql } from 'drizzle-orm';
import { db } from '@/db/index';
import { toJson, toNullableNumber, toNumber } from '@/lib/db/codec';
import { dedupeItemsByRank } from '@/lib/db/snapshot-utils';
import { createSnapshotCache } from '@/lib/db/snapshot-cache';
import { areSnapshotContentsEqual } from '@/lib/db/snapshot-write-guard';
import type {
  YouTubeMusicChartItem,
  YouTubeMusicChartSnapshotWithItems,
  YouTubeMusicCountryOption,
  YouTubeMusicWeeklyChartSnapshot,
} from './types';

interface SnapshotIdRow {
  id: number;
}

interface SnapshotRow {
  id: number;
  chartType: string;
  periodType: string;
  countryCode: string;
  countryName: string;
  chartEndDate: string;
  fetchedAt: string;
  sourceUrl: string;
  itemCount: number;
}

interface ItemRow {
  rank: number;
  previousRank: number | null;
  trackName: string;
  artistNames: string;
  views: number | null;
  periodsOnChart: number | null;
  youtubeVideoId: string | null;
  youtubeUrl: string | null;
  thumbnailUrl: string | null;
  rawItemJson: string | null;
}

const snapshotCache = createSnapshotCache<
  string,
  YouTubeMusicChartSnapshotWithItems
>();

export async function saveYouTubeMusicWeeklyTopSongsSnapshot(snapshot: YouTubeMusicWeeklyChartSnapshot) {
  const { items, duplicateCount } = dedupeItemsByRank(snapshot.items);
  if (duplicateCount > 0) {
    console.warn(
      `[youtube-music] deduped ${duplicateCount} weekly items for ${snapshot.countryCode} ${snapshot.chartEndDate}`,
    );
  }

  const snapshotId = await db.transaction(async (tx) => {
    const existingRows = await tx.all<SnapshotRow>(sql`
      SELECT
        id,
        chart_type as chartType,
        period_type as periodType,
        country_code as countryCode,
        country_name as countryName,
        chart_end_date as chartEndDate,
        fetched_at as fetchedAt,
        source_url as sourceUrl,
        item_count as itemCount
      FROM youtube_music_chart_snapshots
      WHERE
        chart_type = ${snapshot.chartType}
        AND period_type = ${snapshot.periodType}
        AND country_code = ${snapshot.countryCode}
        AND chart_end_date = ${snapshot.chartEndDate}
      LIMIT 1
    `);

    const existingSnapshot = existingRows[0];
    if (existingSnapshot) {
      const existingItems = await tx.all<ItemRow>(sql`
        SELECT
          rank,
          previous_rank as previousRank,
          track_name as trackName,
          artist_names as artistNames,
          views,
          periods_on_chart as periodsOnChart,
          youtube_video_id as youtubeVideoId,
          youtube_url as youtubeUrl,
          thumbnail_url as thumbnailUrl,
          raw_item_json as rawItemJson
        FROM youtube_music_chart_items
        WHERE snapshot_id = ${existingSnapshot.id}
        ORDER BY rank ASC
      `);

      const isUnchanged = areSnapshotContentsEqual({
        existingMeta: {
          countryName: existingSnapshot.countryName,
          sourceUrl: existingSnapshot.sourceUrl,
        },
        nextMeta: {
          countryName: snapshot.countryName,
          sourceUrl: snapshot.sourceUrl,
        },
        existingItems,
        nextItems: items,
        mapExistingItem: (item) => ({
          rank: item.rank,
          previousRank: toNullableNumber(item.previousRank),
          trackName: item.trackName,
          artistNames: item.artistNames,
          views: toNullableNumber(item.views),
          periodsOnChart: toNullableNumber(item.periodsOnChart),
          youtubeVideoId: item.youtubeVideoId,
          youtubeUrl: item.youtubeUrl,
          thumbnailUrl: item.thumbnailUrl,
        }),
        mapNextItem: (item) => ({
          rank: item.rank,
          previousRank: item.previousRank,
          trackName: item.trackName,
          artistNames: item.artistNames,
          views: item.views,
          periodsOnChart: item.periodsOnChart,
          youtubeVideoId: item.youtubeVideoId,
          youtubeUrl: item.youtubeUrl,
          thumbnailUrl: item.thumbnailUrl,
        }),
      });

      if (isUnchanged) {
        await tx.run(sql`
          UPDATE youtube_music_chart_snapshots
          SET
            country_name = ${snapshot.countryName},
            fetched_at = ${snapshot.fetchedAt},
            source_url = ${snapshot.sourceUrl},
            item_count = ${items.length},
            updated_at = ${snapshot.fetchedAt}
          WHERE id = ${existingSnapshot.id}
        `);

        console.log(
          `[youtube-music] skipped weekly item rewrite for ${snapshot.countryCode} ${snapshot.chartEndDate}; content unchanged`,
        );
        return existingSnapshot.id;
      }
    }

    const rows = await tx.all<SnapshotIdRow>(sql`
      INSERT INTO youtube_music_chart_snapshots (
        chart_type,
        period_type,
        country_code,
        country_name,
        chart_end_date,
        fetched_at,
        source_url,
        status,
        item_count,
        error_text,
        raw_payload,
        updated_at
      )
      VALUES (
        ${snapshot.chartType},
        ${snapshot.periodType},
        ${snapshot.countryCode},
        ${snapshot.countryName},
        ${snapshot.chartEndDate},
        ${snapshot.fetchedAt},
        ${snapshot.sourceUrl},
        'success',
        ${items.length},
        NULL,
        ${toJson(snapshot.rawPayload)},
        ${snapshot.fetchedAt}
      )
      ON CONFLICT(chart_type, period_type, country_code, chart_end_date)
      DO UPDATE SET
        country_name = excluded.country_name,
        fetched_at = excluded.fetched_at,
        source_url = excluded.source_url,
        status = excluded.status,
        item_count = excluded.item_count,
        error_text = excluded.error_text,
        raw_payload = excluded.raw_payload,
        updated_at = excluded.updated_at
      RETURNING id
    `);

    const newSnapshotId = rows[0]?.id;
    if (!newSnapshotId) {
      throw new Error('Failed to upsert youtube music chart snapshot');
    }

    await tx.run(sql`DELETE FROM youtube_music_chart_items WHERE snapshot_id = ${newSnapshotId}`);

    if (items.length) {
      const valueRows = items.map((item) => sql`
        (
          ${newSnapshotId},
          ${item.rank},
          ${item.previousRank},
          ${item.trackName},
          ${item.artistNames},
          ${item.views},
          ${item.periodsOnChart},
          ${item.youtubeVideoId},
          ${item.youtubeUrl},
          ${item.thumbnailUrl},
          ${toJson(item.rawItem)},
          ${snapshot.fetchedAt}
        )
      `);

      await tx.run(sql`
        INSERT INTO youtube_music_chart_items (
          snapshot_id,
          rank,
          previous_rank,
          track_name,
          artist_names,
          views,
          periods_on_chart,
          youtube_video_id,
          youtube_url,
          thumbnail_url,
          raw_item_json,
          created_at
        )
        VALUES ${sql.join(valueRows, sql`, `)}
      `);
    }

    return newSnapshotId;
  });

  snapshotCache.clear();
  return snapshotId;
}

export async function getLatestYouTubeMusicWeeklyTopSongsGlobalSnapshot() {
  return getLatestYouTubeMusicWeeklyTopSongsSnapshot('global');
}

export async function listLatestYouTubeMusicWeeklyCountries(): Promise<YouTubeMusicCountryOption[]> {
  const rows = await db.all<Pick<SnapshotRow, 'countryCode' | 'countryName'>>(sql`
    SELECT
      country_code as countryCode,
      MAX(country_name) as countryName
    FROM youtube_music_chart_snapshots
    WHERE chart_type = 'tracks' AND period_type = 'weekly' AND status = 'success'
    GROUP BY country_code
    ORDER BY CASE WHEN country_code = 'global' THEN 0 ELSE 1 END, country_code ASC
  `);

  return rows.map((row) => ({
    countryCode: row.countryCode,
    countryName: row.countryName,
  }));
}

export async function getLatestYouTubeMusicWeeklyTopSongsSnapshot(
  countryCodeInput: string,
): Promise<YouTubeMusicChartSnapshotWithItems | null> {
  const normalizedCountryCode =
    countryCodeInput.trim().toLowerCase() === 'global' ? 'global' : countryCodeInput.trim().toUpperCase();
  const cacheKey = `tracks|weekly|${normalizedCountryCode}`;
  const cached = snapshotCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const snapshots = await db.all<SnapshotRow>(sql`
    SELECT
      id,
      chart_type as chartType,
      period_type as periodType,
      country_code as countryCode,
      country_name as countryName,
      chart_end_date as chartEndDate,
      fetched_at as fetchedAt,
      source_url as sourceUrl,
      item_count as itemCount
    FROM youtube_music_chart_snapshots
    WHERE chart_type = 'tracks' AND period_type = 'weekly' AND country_code = ${normalizedCountryCode} AND status = 'success'
    ORDER BY chart_end_date DESC, fetched_at DESC, id DESC
    LIMIT 1
  `);

  const snapshot = snapshots[0];
  if (!snapshot) {
    snapshotCache.set(cacheKey, null);
    return null;
  }

  const itemRows = await db.all<ItemRow>(sql`
    SELECT
      rank,
      previous_rank as previousRank,
      track_name as trackName,
      artist_names as artistNames,
      views,
      periods_on_chart as periodsOnChart,
      youtube_video_id as youtubeVideoId,
      youtube_url as youtubeUrl,
      thumbnail_url as thumbnailUrl,
      raw_item_json as rawItemJson
    FROM youtube_music_chart_items
    WHERE snapshot_id = ${snapshot.id}
    ORDER BY rank ASC
  `);

  const items: YouTubeMusicChartItem[] = itemRows.map((item) => ({
    rank: toNumber(item.rank, 0),
    previousRank: toNullableNumber(item.previousRank),
    trackName: item.trackName,
    artistNames: item.artistNames,
    artists: [],
    views: toNullableNumber(item.views),
    periodsOnChart: toNullableNumber(item.periodsOnChart),
    youtubeVideoId: item.youtubeVideoId,
    youtubeUrl: item.youtubeUrl,
    thumbnailUrl: item.thumbnailUrl,
    rawItem: item.rawItemJson ? JSON.parse(item.rawItemJson) : null,
  }));

  const data: YouTubeMusicChartSnapshotWithItems = {
    id: toNumber(snapshot.id, 0),
    chartType: snapshot.chartType,
    periodType: snapshot.periodType,
    countryCode: snapshot.countryCode,
    countryName: snapshot.countryName,
    chartEndDate: snapshot.chartEndDate,
    fetchedAt: snapshot.fetchedAt,
    sourceUrl: snapshot.sourceUrl,
    itemCount: toNumber(snapshot.itemCount, 0),
    items,
  };

  snapshotCache.set(cacheKey, data);
  return data;
}
