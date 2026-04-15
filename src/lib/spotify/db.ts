import { sql } from 'drizzle-orm';
import { db } from '@/db/index';
import { toJson, toNullableNumber, toNumber } from '@/lib/db/codec';
import { dedupeItemsByRank } from '@/lib/db/snapshot-utils';
import { createSnapshotCache } from '@/lib/db/snapshot-cache';
import { areSnapshotContentsEqual } from '@/lib/db/snapshot-write-guard';
import { getSpotifyCountryCodeAliases, getSpotifyCountryName, normalizeSpotifyCountryCode } from './countries';
import type { SpotifyChartItem, SpotifyCountryOption, SpotifyTopSongsSnapshot, SpotifyTopSongsSnapshotWithItems } from './types';

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
  chartAlias: string;
  itemCount: number;
}

interface ItemRow {
  rank: number;
  previousRank: number | null;
  peakRank: number | null;
  appearancesOnChart: number | null;
  trackName: string;
  artistNames: string;
  spotifyTrackId: string | null;
  spotifyTrackUri: string | null;
  spotifyTrackUrl: string | null;
  albumName: string | null;
  thumbnailUrl: string | null;
  streamCount: number | null;
  rawItemJson: string | null;
}

const snapshotCache = createSnapshotCache<
  string,
  SpotifyTopSongsSnapshotWithItems
>();

export async function saveSpotifyTopSongsSnapshot(snapshot: SpotifyTopSongsSnapshot) {
  const { items, duplicateCount } = dedupeItemsByRank(snapshot.items);
  if (duplicateCount > 0) {
    console.warn(`[spotify] deduped ${duplicateCount} items for ${snapshot.countryCode} ${snapshot.chartEndDate}`);
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
        chart_alias as chartAlias,
        item_count as itemCount
      FROM spotify_chart_snapshots
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
          peak_rank as peakRank,
          appearances_on_chart as appearancesOnChart,
          track_name as trackName,
          artist_names as artistNames,
          spotify_track_id as spotifyTrackId,
          spotify_track_uri as spotifyTrackUri,
          spotify_track_url as spotifyTrackUrl,
          album_name as albumName,
          thumbnail_url as thumbnailUrl,
          stream_count as streamCount,
          raw_item_json as rawItemJson
        FROM spotify_chart_items
        WHERE snapshot_id = ${existingSnapshot.id}
        ORDER BY rank ASC
      `);

      const isUnchanged = areSnapshotContentsEqual({
        existingMeta: {
          countryName: existingSnapshot.countryName,
          sourceUrl: existingSnapshot.sourceUrl,
          chartAlias: existingSnapshot.chartAlias,
        },
        nextMeta: {
          countryName: snapshot.countryName,
          sourceUrl: snapshot.sourceUrl,
          chartAlias: snapshot.chartAlias,
        },
        existingItems,
        nextItems: items,
        mapExistingItem: (item) => ({
          rank: item.rank,
          previousRank: toNullableNumber(item.previousRank),
          peakRank: toNullableNumber(item.peakRank),
          appearancesOnChart: toNullableNumber(item.appearancesOnChart),
          trackName: item.trackName,
          artistNames: item.artistNames,
          spotifyTrackId: item.spotifyTrackId,
          spotifyTrackUri: item.spotifyTrackUri,
          spotifyTrackUrl: item.spotifyTrackUrl,
          albumName: item.albumName,
          thumbnailUrl: item.thumbnailUrl,
          streamCount: toNullableNumber(item.streamCount),
        }),
        mapNextItem: (item) => ({
          rank: item.rank,
          previousRank: item.previousRank,
          peakRank: item.peakRank,
          appearancesOnChart: item.appearancesOnChart,
          trackName: item.trackName,
          artistNames: item.artistNames,
          spotifyTrackId: item.spotifyTrackId,
          spotifyTrackUri: item.spotifyTrackUri,
          spotifyTrackUrl: item.spotifyTrackUrl,
          albumName: item.albumName,
          thumbnailUrl: item.thumbnailUrl,
          streamCount: item.streamCount,
        }),
      });

      if (isUnchanged) {
        await tx.run(sql`
          UPDATE spotify_chart_snapshots
          SET
            country_name = ${snapshot.countryName},
            fetched_at = ${snapshot.fetchedAt},
            source_url = ${snapshot.sourceUrl},
            chart_alias = ${snapshot.chartAlias},
            item_count = ${items.length},
            updated_at = ${snapshot.fetchedAt}
          WHERE id = ${existingSnapshot.id}
        `);

        console.log(
          `[spotify] skipped item rewrite for ${snapshot.countryCode} ${snapshot.chartEndDate}; content unchanged`,
        );
        return existingSnapshot.id;
      }
    }

    const rows = await tx.all<SnapshotIdRow>(sql`
      INSERT INTO spotify_chart_snapshots (
        chart_type,
        period_type,
        country_code,
        country_name,
        chart_end_date,
        fetched_at,
        source_url,
        chart_alias,
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
        ${snapshot.chartAlias},
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
        chart_alias = excluded.chart_alias,
        status = excluded.status,
        item_count = excluded.item_count,
        error_text = excluded.error_text,
        raw_payload = excluded.raw_payload,
        updated_at = excluded.updated_at
      RETURNING id
    `);

    const newSnapshotId = rows[0]?.id;
    if (!newSnapshotId) {
      throw new Error('Failed to upsert Spotify chart snapshot');
    }

    await tx.run(sql`DELETE FROM spotify_chart_items WHERE snapshot_id = ${newSnapshotId}`);

    if (items.length > 0) {
      const valueRows = items.map((item) => sql`
        (
          ${newSnapshotId},
          ${item.rank},
          ${item.previousRank},
          ${item.peakRank},
          ${item.appearancesOnChart},
          ${item.trackName},
          ${item.artistNames},
          ${item.spotifyTrackId},
          ${item.spotifyTrackUri},
          ${item.spotifyTrackUrl},
          ${item.albumName},
          ${item.thumbnailUrl},
          ${item.streamCount},
          ${toJson(item.rawItem)},
          ${snapshot.fetchedAt}
        )
      `);

      await tx.run(sql`
        INSERT INTO spotify_chart_items (
          snapshot_id,
          rank,
          previous_rank,
          peak_rank,
          appearances_on_chart,
          track_name,
          artist_names,
          spotify_track_id,
          spotify_track_uri,
          spotify_track_url,
          album_name,
          thumbnail_url,
          stream_count,
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

export async function getLatestSpotifyTopSongsGlobalSnapshot() {
  return getLatestSpotifyTopSongsSnapshot('global');
}

export async function listLatestSpotifyTopSongsCountries(): Promise<SpotifyCountryOption[]> {
  const rows = await db.all<Pick<SnapshotRow, 'countryCode' | 'countryName'>>(sql`
    SELECT
      country_code as countryCode,
      MAX(country_name) as countryName
    FROM spotify_chart_snapshots
    WHERE chart_type = 'tracks' AND period_type = 'daily' AND status = 'success'
    GROUP BY country_code
    ORDER BY CASE WHEN country_code = 'global' THEN 0 ELSE 1 END, country_code ASC
  `);

  return rows.map((row) => ({
    countryCode: normalizeSpotifyCountryCode(row.countryCode),
    countryName: row.countryName || getSpotifyCountryName(row.countryCode) || row.countryCode,
  }));
}

export async function getLatestSpotifyTopSongsSnapshot(
  countryCodeInput: string,
): Promise<SpotifyTopSongsSnapshotWithItems | null> {
  const normalizedCountryCode = normalizeSpotifyCountryCode(countryCodeInput);
  const cacheKey = `tracks|daily|${normalizedCountryCode}`;
  const cached = snapshotCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const aliases = getSpotifyCountryCodeAliases(normalizedCountryCode);
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
      chart_alias as chartAlias,
      item_count as itemCount
    FROM spotify_chart_snapshots
    WHERE chart_type = 'tracks'
      AND period_type = 'daily'
      AND country_code IN (${aliasSql})
      AND status = 'success'
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
      peak_rank as peakRank,
      appearances_on_chart as appearancesOnChart,
      track_name as trackName,
      artist_names as artistNames,
      spotify_track_id as spotifyTrackId,
      spotify_track_uri as spotifyTrackUri,
      spotify_track_url as spotifyTrackUrl,
      album_name as albumName,
      thumbnail_url as thumbnailUrl,
      stream_count as streamCount,
      raw_item_json as rawItemJson
    FROM spotify_chart_items
    WHERE snapshot_id = ${snapshot.id}
    ORDER BY rank ASC
  `);

  const items: SpotifyChartItem[] = itemRows.map((item) => ({
    rank: toNumber(item.rank, 0),
    previousRank: toNullableNumber(item.previousRank),
    peakRank: toNullableNumber(item.peakRank),
    appearancesOnChart: toNullableNumber(item.appearancesOnChart),
    trackName: item.trackName,
    artistNames: item.artistNames,
    artists: item.artistNames
      .split(/\s*,\s*/)
      .map((name) => name.trim())
      .filter(Boolean)
      .map((name) => ({ name })),
    spotifyTrackId: item.spotifyTrackId,
    spotifyTrackUri: item.spotifyTrackUri,
    spotifyTrackUrl: item.spotifyTrackUrl,
    albumName: item.albumName,
    thumbnailUrl: item.thumbnailUrl,
    streamCount: toNullableNumber(item.streamCount),
    rawItem: item.rawItemJson ? JSON.parse(item.rawItemJson) : null,
  }));

  const data: SpotifyTopSongsSnapshotWithItems = {
    id: toNumber(snapshot.id, 0),
    chartType: snapshot.chartType,
    periodType: snapshot.periodType,
    countryCode: normalizeSpotifyCountryCode(snapshot.countryCode),
    countryName: snapshot.countryName,
    chartEndDate: snapshot.chartEndDate,
    fetchedAt: snapshot.fetchedAt,
    sourceUrl: snapshot.sourceUrl,
    chartAlias: snapshot.chartAlias,
    itemCount: toNumber(snapshot.itemCount, 0),
    items,
  };

  snapshotCache.set(cacheKey, data);
  return data;
}
