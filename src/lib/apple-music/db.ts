import { sql } from 'drizzle-orm';
import { db } from '@/db/index';
import { toJson, toNullableNumber, toNumber } from '@/lib/db/codec';
import { dedupeItemsByRank } from '@/lib/db/snapshot-utils';
import { createSnapshotCache } from '@/lib/db/snapshot-cache';
import { areSnapshotContentsEqual } from '@/lib/db/snapshot-write-guard';
import {
  getAppleMusicCountryCodeAliases,
  normalizeAppleMusicCountryCode,
} from './countries';
import {
  APPLE_MUSIC_GLOBAL_COUNTRY_CODE,
  APPLE_MUSIC_GLOBAL_PLAYLIST_SOURCE_TYPE,
  APPLE_MUSIC_TOP_SONGS_SOURCE_TYPE,
  type AppleMusicChartItem,
  type AppleMusicCountryOption,
  type AppleMusicTopSongsSnapshot,
  type AppleMusicTopSongsSnapshotWithItems,
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
  playlistId: string;
  playlistSlug: string;
  playlistTitle: string;
  itemCount: number;
}

interface CountryRow {
  id: number;
  countryCode: string;
  countryName: string;
  playlistId: string;
  playlistSlug: string;
  sourceUrl: string;
  chartEndDate: string;
  fetchedAt: string;
}

interface ItemRow {
  rank: number;
  trackName: string;
  artistNames: string;
  appleSongId: string;
  appleSongUrl: string;
  durationMs: number | null;
  thumbnailUrl: string | null;
  rawItemJson: string | null;
}

const snapshotCache = createSnapshotCache<
  string,
  AppleMusicTopSongsSnapshotWithItems
>();

function normalizeCountryCode(value: string) {
  return normalizeAppleMusicCountryCode(value);
}

export async function saveAppleMusicTopSongsSnapshot(snapshot: AppleMusicTopSongsSnapshot) {
  const { items, duplicateCount } = dedupeItemsByRank(snapshot.items);
  if (duplicateCount > 0) {
    console.warn(`[apple-music] deduped ${duplicateCount} items for ${snapshot.countryCode} ${snapshot.chartEndDate}`);
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
        playlist_id as playlistId,
        playlist_slug as playlistSlug,
        playlist_title as playlistTitle,
        item_count as itemCount
      FROM apple_music_chart_snapshots
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
          track_name as trackName,
          artist_names as artistNames,
          apple_song_id as appleSongId,
          apple_song_url as appleSongUrl,
          duration_ms as durationMs,
          thumbnail_url as thumbnailUrl,
          raw_item_json as rawItemJson
        FROM apple_music_chart_items
        WHERE snapshot_id = ${existingSnapshot.id}
        ORDER BY rank ASC
      `);

      const isUnchanged = areSnapshotContentsEqual({
        existingMeta: {
          countryName: existingSnapshot.countryName,
          sourceUrl: existingSnapshot.sourceUrl,
          playlistId: existingSnapshot.playlistId,
          playlistSlug: existingSnapshot.playlistSlug,
          playlistTitle: existingSnapshot.playlistTitle,
        },
        nextMeta: {
          countryName: snapshot.countryName,
          sourceUrl: snapshot.sourceUrl,
          playlistId: snapshot.playlistId,
          playlistSlug: snapshot.playlistSlug,
          playlistTitle: snapshot.playlistTitle,
        },
        existingItems,
        nextItems: items,
        mapExistingItem: (item) => ({
          rank: item.rank,
          trackName: item.trackName,
          artistNames: item.artistNames,
          appleSongId: item.appleSongId,
          appleSongUrl: item.appleSongUrl,
          durationMs: toNullableNumber(item.durationMs),
          thumbnailUrl: item.thumbnailUrl,
        }),
        mapNextItem: (item) => ({
          rank: item.rank,
          trackName: item.trackName,
          artistNames: item.artistNames,
          appleSongId: item.appleSongId,
          appleSongUrl: item.appleSongUrl,
          durationMs: item.durationMs,
          thumbnailUrl: item.thumbnailUrl,
        }),
      });

      if (isUnchanged) {
        await tx.run(sql`
          UPDATE apple_music_chart_snapshots
          SET
            country_name = ${snapshot.countryName},
            fetched_at = ${snapshot.fetchedAt},
            source_url = ${snapshot.sourceUrl},
            playlist_id = ${snapshot.playlistId},
            playlist_slug = ${snapshot.playlistSlug},
            playlist_title = ${snapshot.playlistTitle},
            item_count = ${items.length},
            updated_at = ${snapshot.fetchedAt}
          WHERE id = ${existingSnapshot.id}
        `);

        console.log(
          `[apple-music] skipped item rewrite for ${snapshot.countryCode} ${snapshot.chartEndDate}; content unchanged`,
        );
        return existingSnapshot.id;
      }
    }

    const rows = await tx.all<SnapshotIdRow>(sql`
      INSERT INTO apple_music_chart_snapshots (
        chart_type,
        period_type,
        country_code,
        country_name,
        chart_end_date,
        fetched_at,
        source_url,
        playlist_id,
        playlist_slug,
        playlist_title,
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
        ${snapshot.playlistId},
        ${snapshot.playlistSlug},
        ${snapshot.playlistTitle},
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
        playlist_id = excluded.playlist_id,
        playlist_slug = excluded.playlist_slug,
        playlist_title = excluded.playlist_title,
        status = excluded.status,
        item_count = excluded.item_count,
        error_text = excluded.error_text,
        raw_payload = excluded.raw_payload,
        updated_at = excluded.updated_at
      RETURNING id
    `);

    const newSnapshotId = rows[0]?.id;
    if (!newSnapshotId) {
      throw new Error('Failed to upsert Apple Music chart snapshot');
    }

    await tx.run(sql`DELETE FROM apple_music_chart_items WHERE snapshot_id = ${newSnapshotId}`);

    if (items.length) {
      const valueRows = items.map((item) => sql`
        (
          ${newSnapshotId},
          ${item.rank},
          ${item.trackName},
          ${item.artistNames},
          ${item.appleSongId},
          ${item.appleSongUrl},
          ${item.durationMs},
          ${item.thumbnailUrl},
          ${toJson(item.rawItem)},
          ${snapshot.fetchedAt}
        )
      `);

      await tx.run(sql`
        INSERT INTO apple_music_chart_items (
          snapshot_id,
          rank,
          track_name,
          artist_names,
          apple_song_id,
          apple_song_url,
          duration_ms,
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

export async function listLatestAppleMusicTopSongsCountries(): Promise<AppleMusicCountryOption[]> {
  const rows = await db.all<CountryRow>(sql`
    SELECT
      id,
      country_code as countryCode,
      country_name as countryName,
      playlist_id as playlistId,
      playlist_slug as playlistSlug,
      source_url as sourceUrl,
      chart_end_date as chartEndDate,
      fetched_at as fetchedAt
    FROM apple_music_chart_snapshots
    WHERE chart_type = 'tracks'
      AND period_type = 'daily'
      AND status = 'success'
      AND (
        json_extract(raw_payload, '$.sourceType') = ${APPLE_MUSIC_TOP_SONGS_SOURCE_TYPE}
        OR (
          country_code = ${APPLE_MUSIC_GLOBAL_COUNTRY_CODE}
          AND json_extract(raw_payload, '$.sourceType') = ${APPLE_MUSIC_GLOBAL_PLAYLIST_SOURCE_TYPE}
        )
      )
    ORDER BY chart_end_date DESC, fetched_at DESC, id DESC
  `);

  const countries = new Map<string, AppleMusicCountryOption>();
  for (const row of rows) {
    const canonicalCountryCode = normalizeCountryCode(row.countryCode);
    if (countries.has(canonicalCountryCode)) {
      continue;
    }

    countries.set(canonicalCountryCode, {
      countryCode: canonicalCountryCode,
      countryName: row.countryName,
      playlistId: row.playlistId,
      playlistSlug: row.playlistSlug,
      sourceUrl: row.sourceUrl,
    });
  }

  return Array.from(countries.values()).sort((left, right) => {
    if (left.countryCode === 'global') return -1;
    if (right.countryCode === 'global') return 1;
    return left.countryCode.localeCompare(right.countryCode);
  });
}

export async function getLatestAppleMusicTopSongsSnapshot(
  countryCodeInput: string,
): Promise<AppleMusicTopSongsSnapshotWithItems | null> {
  const normalizedCountryCode = normalizeCountryCode(countryCodeInput);
  const cacheKey = `tracks|daily|${normalizedCountryCode}`;
  const cached = snapshotCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const aliases = getAppleMusicCountryCodeAliases(normalizedCountryCode);
  const aliasSql = sql.join(aliases.map((value) => sql`${value}`), sql`, `);

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
      playlist_id as playlistId,
      playlist_slug as playlistSlug,
      playlist_title as playlistTitle,
      item_count as itemCount
    FROM apple_music_chart_snapshots
    WHERE chart_type = 'tracks'
      AND period_type = 'daily'
      AND country_code IN (${aliasSql})
      AND status = 'success'
      AND json_extract(raw_payload, '$.sourceType') = ${
        normalizedCountryCode === APPLE_MUSIC_GLOBAL_COUNTRY_CODE
          ? APPLE_MUSIC_GLOBAL_PLAYLIST_SOURCE_TYPE
          : APPLE_MUSIC_TOP_SONGS_SOURCE_TYPE
      }
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
      track_name as trackName,
      artist_names as artistNames,
      apple_song_id as appleSongId,
      apple_song_url as appleSongUrl,
      duration_ms as durationMs,
      thumbnail_url as thumbnailUrl,
      raw_item_json as rawItemJson
    FROM apple_music_chart_items
    WHERE snapshot_id = ${snapshot.id}
    ORDER BY rank ASC
  `);

  const items: AppleMusicChartItem[] = itemRows.map((item) => ({
    rank: toNumber(item.rank, 0),
    trackName: item.trackName,
    artistNames: item.artistNames,
    appleSongId: item.appleSongId,
    appleSongUrl: item.appleSongUrl,
    durationMs: toNullableNumber(item.durationMs),
    thumbnailUrl: item.thumbnailUrl,
    rawItem: item.rawItemJson ? JSON.parse(item.rawItemJson) : null,
  }));

  const data: AppleMusicTopSongsSnapshotWithItems = {
    id: toNumber(snapshot.id, 0),
    chartType: snapshot.chartType,
    periodType: snapshot.periodType,
    countryCode: normalizeCountryCode(snapshot.countryCode),
    countryName: snapshot.countryName,
    chartEndDate: snapshot.chartEndDate,
    fetchedAt: snapshot.fetchedAt,
    sourceUrl: snapshot.sourceUrl,
    playlistId: snapshot.playlistId,
    playlistSlug: snapshot.playlistSlug,
    playlistTitle: snapshot.playlistTitle,
    itemCount: toNumber(snapshot.itemCount, 0),
    items,
  };

  snapshotCache.set(cacheKey, data);
  return data;
}
