import { sql } from 'drizzle-orm';
import { db } from '@/db/index';
import type {
  YouTubeMusicChartItem,
  YouTubeMusicChartSnapshotWithItems,
  YouTubeMusicCountryOption,
  YouTubeMusicShortsSongDailySnapshot,
} from './types';
import { dedupeYouTubeMusicItemsByRank } from './save-utils';

interface SnapshotIdRow {
  id: number;
}

interface SnapshotRow {
  id: number;
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

const CACHE_TTL_MS = 5 * 60 * 1000;
let latestSnapshotCache:
  | {
      expiresAt: number;
      countryCode: string;
      data: YouTubeMusicChartSnapshotWithItems | null;
    }
  | null = null;

function toJson(value: unknown): string | null {
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

function clearCache() {
  latestSnapshotCache = null;
}

function normalizeCountryCode(countryCodeInput: string) {
  return countryCodeInput.trim().toLowerCase() === 'global' ? 'global' : countryCodeInput.trim().toUpperCase();
}

export async function saveYouTubeMusicDailyShortsSongsSnapshot(snapshot: YouTubeMusicShortsSongDailySnapshot) {
  const { items, duplicateCount } = dedupeYouTubeMusicItemsByRank(snapshot.items);
  if (duplicateCount > 0) {
    console.warn(
      `[youtube-music] deduped ${duplicateCount} shorts-songs-daily items for ${snapshot.countryCode} ${snapshot.chartEndDate}`,
    );
  }

  const snapshotId = await db.transaction(async (tx) => {
    const rows = await tx.all<SnapshotIdRow>(sql`
      INSERT INTO youtube_music_shorts_song_daily_snapshots (
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
      ON CONFLICT(country_code, chart_end_date)
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
      throw new Error('Failed to upsert youtube music daily shorts songs snapshot');
    }

    await tx.run(sql`DELETE FROM youtube_music_shorts_song_daily_items WHERE snapshot_id = ${newSnapshotId}`);

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
        INSERT INTO youtube_music_shorts_song_daily_items (
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

  clearCache();
  return snapshotId;
}

export async function listLatestYouTubeMusicDailyShortsCountries(): Promise<YouTubeMusicCountryOption[]> {
  const rows = await db.all<Pick<SnapshotRow, 'countryCode' | 'countryName'>>(sql`
    SELECT
      country_code as countryCode,
      MAX(country_name) as countryName
    FROM youtube_music_shorts_song_daily_snapshots
    WHERE status = 'success'
    GROUP BY country_code
    ORDER BY CASE WHEN country_code = 'global' THEN 0 ELSE 1 END, country_code ASC
  `);

  return rows.map((row) => ({
    countryCode: row.countryCode,
    countryName: row.countryName,
  }));
}

export async function getLatestYouTubeMusicDailyShortsSongsGlobalSnapshot() {
  return getLatestYouTubeMusicDailyShortsSongsSnapshot('global');
}

export async function getLatestYouTubeMusicDailyShortsSongsSnapshot(
  countryCodeInput: string,
): Promise<YouTubeMusicChartSnapshotWithItems | null> {
  const countryCode = normalizeCountryCode(countryCodeInput);
  if (latestSnapshotCache && latestSnapshotCache.countryCode === countryCode && Date.now() <= latestSnapshotCache.expiresAt) {
    return latestSnapshotCache.data;
  }

  const snapshots = await db.all<SnapshotRow>(sql`
    SELECT
      id,
      country_code as countryCode,
      country_name as countryName,
      chart_end_date as chartEndDate,
      fetched_at as fetchedAt,
      source_url as sourceUrl,
      item_count as itemCount
    FROM youtube_music_shorts_song_daily_snapshots
    WHERE country_code = ${countryCode} AND status = 'success'
    ORDER BY chart_end_date DESC, fetched_at DESC, id DESC
    LIMIT 1
  `);

  const snapshot = snapshots[0];
  if (!snapshot) {
    latestSnapshotCache = { countryCode, data: null, expiresAt: Date.now() + CACHE_TTL_MS };
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
    FROM youtube_music_shorts_song_daily_items
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
    chartType: 'shorts_tracks_by_usage',
    periodType: 'daily',
    countryCode: snapshot.countryCode,
    countryName: snapshot.countryName,
    chartEndDate: snapshot.chartEndDate,
    fetchedAt: snapshot.fetchedAt,
    sourceUrl: snapshot.sourceUrl,
    itemCount: toNumber(snapshot.itemCount, 0),
    items,
  };

  latestSnapshotCache = { countryCode, data, expiresAt: Date.now() + CACHE_TTL_MS };
  return data;
}
