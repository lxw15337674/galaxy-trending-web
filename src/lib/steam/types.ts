export const STEAM_SCOPE_CODE_GLOBAL = 'global';
export const STEAM_SCOPE_NAME_GLOBAL = 'Global';

export const STEAM_CHART_TYPE_MOST_PLAYED = 'most-played';
export const STEAM_CHART_TYPE_TOP_SELLERS = 'top-sellers';
export const STEAM_CHART_TYPE_TRENDING = 'trending';

export const STEAM_CHART_TYPES = [
  STEAM_CHART_TYPE_MOST_PLAYED,
  STEAM_CHART_TYPE_TOP_SELLERS,
  STEAM_CHART_TYPE_TRENDING,
] as const;

export type SteamChartType = (typeof STEAM_CHART_TYPES)[number];

export interface SteamChartOption {
  chartType: SteamChartType;
  chartLabel: string;
}

export interface SteamChartItem {
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
  rawItem: unknown;
}

export interface SteamChartSnapshot {
  chartType: SteamChartType;
  scopeCode: typeof STEAM_SCOPE_CODE_GLOBAL;
  scopeName: typeof STEAM_SCOPE_NAME_GLOBAL;
  snapshotHour: string;
  fetchedAt: string;
  sourceUrl: string;
  chartLabel: string;
  items: SteamChartItem[];
  rawPayload: unknown;
}

export interface SteamChartSnapshotWithItems {
  id: number;
  chartType: SteamChartType;
  scopeCode: string;
  scopeName: string;
  snapshotHour: string;
  fetchedAt: string;
  sourceUrl: string;
  chartLabel: string;
  itemCount: number;
  items: SteamChartItem[];
}

export const STEAM_CHART_SOURCES: Record<SteamChartType, { sourceUrl: string; chartLabel: string }> = {
  [STEAM_CHART_TYPE_MOST_PLAYED]: {
    sourceUrl: 'https://store.steampowered.com/stats/stats/?l=english',
    chartLabel: 'Most Played',
  },
  [STEAM_CHART_TYPE_TOP_SELLERS]: {
    sourceUrl: 'https://store.steampowered.com/search?filter=globaltopsellers&l=english',
    chartLabel: 'Top Sellers',
  },
  [STEAM_CHART_TYPE_TRENDING]: {
    sourceUrl: 'https://store.steampowered.com/explore/new/?l=english',
    chartLabel: 'Popular New Releases',
  },
};

export function normalizeSteamChartType(value: string | string[] | undefined | null): SteamChartType {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const normalized = String(rawValue ?? '')
    .trim()
    .toLowerCase();

  if (normalized === STEAM_CHART_TYPE_TOP_SELLERS) return STEAM_CHART_TYPE_TOP_SELLERS;
  if (normalized === STEAM_CHART_TYPE_TRENDING) return STEAM_CHART_TYPE_TRENDING;
  return STEAM_CHART_TYPE_MOST_PLAYED;
}
