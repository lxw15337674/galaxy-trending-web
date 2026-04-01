import { sql } from 'drizzle-orm';
import { db } from '@/db/index';
import { parseJsonObject, toJson, toNullableNumber } from '@/lib/db/codec';
import type { SteamChartItem, SteamChartSnapshot, SteamChartSnapshotWithItems, SteamChartType } from './types';
import {
  STEAM_CHART_TYPE_MOST_PLAYED,
  STEAM_CHART_TYPE_TOP_SELLERS,
  STEAM_CHART_TYPE_TRENDING,
  normalizeSteamChartType,
} from './types';

interface SnapshotIdRow {
  id: number;
}

interface SnapshotRow {
  id: number;
  chartType: string;
  scopeCode: string;
  scopeName: string;
  snapshotHour: string;
  fetchedAt: string;
  sourceUrl: string;
  chartLabel: string;
  itemCount: number;
}

interface ItemRow {
  rank: number;
  steamItemId: string;
  steamAppId: number | null;
  gameName: string;
  steamUrl: string;
  thumbnailUrl: string | null;
  currentPlayers: number | null;
  peakToday: number | null;
  priceText: string | null;
  originalPriceText: string | null;
  discountPercent: number | null;
  releaseDateText: string | null;
  tagSummary: string | null;
  rawItemJson: string | null;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
let latestSnapshotCache:
  | {
      expiresAt: number;
      key: string;
      data: SteamChartSnapshotWithItems | null;
    }
  | null = null;

function clearCache() {
  latestSnapshotCache = null;
}

function getCacheHit() {
  if (!latestSnapshotCache) return null;
  if (Date.now() > latestSnapshotCache.expiresAt) return null;
  return latestSnapshotCache;
}

export async function saveSteamChartSnapshot(snapshot: SteamChartSnapshot) {
  const snapshotId = await db.transaction(async (tx) => {
    const rows = await tx.all<SnapshotIdRow>(sql`
      INSERT INTO steam_chart_snapshots (
        chart_type,
        scope_code,
        scope_name,
        snapshot_hour,
        fetched_at,
        source_url,
        chart_label,
        status,
        item_count,
        error_text,
        raw_payload,
        updated_at
      )
      VALUES (
        ${snapshot.chartType},
        ${snapshot.scopeCode},
        ${snapshot.scopeName},
        ${snapshot.snapshotHour},
        ${snapshot.fetchedAt},
        ${snapshot.sourceUrl},
        ${snapshot.chartLabel},
        'success',
        ${snapshot.items.length},
        NULL,
        ${toJson(snapshot.rawPayload)},
        ${snapshot.fetchedAt}
      )
      ON CONFLICT(chart_type, scope_code, snapshot_hour)
      DO UPDATE SET
        scope_name = excluded.scope_name,
        fetched_at = excluded.fetched_at,
        source_url = excluded.source_url,
        chart_label = excluded.chart_label,
        status = excluded.status,
        item_count = excluded.item_count,
        error_text = excluded.error_text,
        raw_payload = excluded.raw_payload,
        updated_at = excluded.updated_at
      RETURNING id
    `);

    const newSnapshotId = rows[0]?.id;
    if (!newSnapshotId) {
      throw new Error('Failed to upsert Steam chart snapshot');
    }

    await tx.run(sql`DELETE FROM steam_chart_items WHERE snapshot_id = ${newSnapshotId}`);

    if (snapshot.items.length > 0) {
      const valueRows = snapshot.items.map((item) => sql`
        (
          ${newSnapshotId},
          ${item.rank},
          ${item.steamItemId},
          ${item.steamAppId},
          ${item.gameName},
          ${item.steamUrl},
          ${item.thumbnailUrl},
          ${item.currentPlayers},
          ${item.peakToday},
          ${item.priceText},
          ${item.originalPriceText},
          ${item.discountPercent},
          ${item.releaseDateText},
          ${item.tagSummary},
          ${toJson(item.rawItem)},
          ${snapshot.fetchedAt}
        )
      `);

      await tx.run(sql`
        INSERT INTO steam_chart_items (
          snapshot_id,
          rank,
          steam_item_id,
          steam_app_id,
          game_name,
          steam_url,
          thumbnail_url,
          current_players,
          peak_today,
          price_text,
          original_price_text,
          discount_percent,
          release_date_text,
          tag_summary,
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

function mapItemRow(row: ItemRow): SteamChartItem {
  return {
    rank: row.rank,
    steamItemId: row.steamItemId,
    steamAppId: toNullableNumber(row.steamAppId),
    gameName: row.gameName,
    steamUrl: row.steamUrl,
    thumbnailUrl: row.thumbnailUrl,
    currentPlayers: toNullableNumber(row.currentPlayers),
    peakToday: toNullableNumber(row.peakToday),
    priceText: row.priceText,
    originalPriceText: row.originalPriceText,
    discountPercent: toNullableNumber(row.discountPercent),
    releaseDateText: row.releaseDateText,
    tagSummary: row.tagSummary,
    rawItem: parseJsonObject(row.rawItemJson) ?? row.rawItemJson,
  };
}

export async function getLatestSteamChartSnapshot(chartTypeInput: string): Promise<SteamChartSnapshotWithItems | null> {
  const chartType = normalizeSteamChartType(chartTypeInput);
  const cacheKey = `${chartType}|global`;
  const cached = getCacheHit();
  if (cached && cached.key === cacheKey) return cached.data;

  const snapshotRows = await db.all<SnapshotRow>(sql`
    SELECT
      id,
      chart_type as chartType,
      scope_code as scopeCode,
      scope_name as scopeName,
      snapshot_hour as snapshotHour,
      fetched_at as fetchedAt,
      source_url as sourceUrl,
      chart_label as chartLabel,
      item_count as itemCount
    FROM steam_chart_snapshots
    WHERE chart_type = ${chartType}
      AND scope_code = 'global'
      AND status = 'success'
    ORDER BY snapshot_hour DESC, fetched_at DESC, id DESC
    LIMIT 1
  `);

  const snapshot = snapshotRows[0];
  if (!snapshot) {
    latestSnapshotCache = {
      expiresAt: Date.now() + CACHE_TTL_MS,
      key: cacheKey,
      data: null,
    };
    return null;
  }

  const items = await db.all<ItemRow>(sql`
    SELECT
      rank as rank,
      steam_item_id as steamItemId,
      steam_app_id as steamAppId,
      game_name as gameName,
      steam_url as steamUrl,
      thumbnail_url as thumbnailUrl,
      current_players as currentPlayers,
      peak_today as peakToday,
      price_text as priceText,
      original_price_text as originalPriceText,
      discount_percent as discountPercent,
      release_date_text as releaseDateText,
      tag_summary as tagSummary,
      raw_item_json as rawItemJson
    FROM steam_chart_items
    WHERE snapshot_id = ${snapshot.id}
    ORDER BY rank ASC
  `);

  const data: SteamChartSnapshotWithItems = {
    id: snapshot.id,
    chartType,
    scopeCode: snapshot.scopeCode,
    scopeName: snapshot.scopeName,
    snapshotHour: snapshot.snapshotHour,
    fetchedAt: snapshot.fetchedAt,
    sourceUrl: snapshot.sourceUrl,
    chartLabel: snapshot.chartLabel,
    itemCount: snapshot.itemCount,
    items: items.map(mapItemRow),
  };

  latestSnapshotCache = {
    expiresAt: Date.now() + CACHE_TTL_MS,
    key: cacheKey,
    data,
  };

  return data;
}

export async function getLatestSteamMostPlayedSnapshot() {
  return getLatestSteamChartSnapshot(STEAM_CHART_TYPE_MOST_PLAYED);
}

export function listSteamChartTypes(): SteamChartType[] {
  return [STEAM_CHART_TYPE_MOST_PLAYED, STEAM_CHART_TYPE_TOP_SELLERS, STEAM_CHART_TYPE_TRENDING].map((value) =>
    normalizeSteamChartType(value),
  );
}



