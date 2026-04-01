export const APP_STORE_GAME_CHART_TYPE_FREE = 'topfree';
export const APP_STORE_GAME_CHART_TYPE_PAID = 'toppaid';
export const APP_STORE_GAME_CHART_TYPE_GROSSING = 'topgrossing';
export const APP_STORE_GAME_CHART_TYPES = [
  APP_STORE_GAME_CHART_TYPE_FREE,
  APP_STORE_GAME_CHART_TYPE_PAID,
  APP_STORE_GAME_CHART_TYPE_GROSSING,
] as const;

export type AppStoreGameChartType = (typeof APP_STORE_GAME_CHART_TYPES)[number];

export const APP_STORE_GAME_CATEGORY_ID = '6014';
export const APP_STORE_GAME_CATEGORY_NAME = 'Games';
export const DEFAULT_APP_STORE_GAME_COUNTRY_CODES = ['CN', 'US', 'JP', 'KR', 'DE', 'GB', 'FR', 'CA', 'BR', 'MX'] as const;
export const APP_STORE_GAME_FEED_LIMIT = 100;

export interface AppStoreGameCountryOption {
  countryCode: string;
  countryName: string;
}

export interface AppStoreGameChartOption {
  chartType: AppStoreGameChartType;
  chartLabel: string;
}

export interface AppStoreGameChartItem {
  rank: number;
  appId: string;
  bundleId: string | null;
  appName: string;
  developerName: string;
  developerUrl: string | null;
  storeUrl: string;
  artworkUrl: string | null;
  summary: string | null;
  priceLabel: string | null;
  priceAmount: string | null;
  currencyCode: string | null;
  categoryId: string | null;
  categoryName: string | null;
  releaseDate: string | null;
  rawItem: unknown;
}

export interface AppStoreGameChartSnapshot {
  chartType: AppStoreGameChartType;
  countryCode: string;
  countryName: string;
  snapshotHour: string;
  fetchedAt: string;
  sourceUrl: string;
  feedTitle: string;
  items: AppStoreGameChartItem[];
  rawPayload: unknown;
}

export interface AppStoreGameChartSnapshotWithItems {
  id: number;
  chartType: AppStoreGameChartType;
  countryCode: string;
  countryName: string;
  snapshotHour: string;
  fetchedAt: string;
  sourceUrl: string;
  feedTitle: string;
  itemCount: number;
  items: AppStoreGameChartItem[];
}

export function normalizeAppStoreGameCountryCode(value: string | null | undefined) {
  return String(value ?? '').trim().toUpperCase() || 'US';
}

export function normalizeAppStoreGameChartType(value: string | string[] | null | undefined): AppStoreGameChartType {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const normalized = String(rawValue ?? '').trim().toLowerCase();
  if (normalized === APP_STORE_GAME_CHART_TYPE_PAID) return APP_STORE_GAME_CHART_TYPE_PAID;
  if (normalized === APP_STORE_GAME_CHART_TYPE_GROSSING) return APP_STORE_GAME_CHART_TYPE_GROSSING;
  return APP_STORE_GAME_CHART_TYPE_FREE;
}

export function buildAppStoreGameFeedUrl(countryCode: string, chartType: AppStoreGameChartType, limit = APP_STORE_GAME_FEED_LIMIT) {
  const normalizedCountryCode = normalizeAppStoreGameCountryCode(countryCode).toLowerCase();
  return `https://itunes.apple.com/${normalizedCountryCode}/rss/${chartType}applications/limit=${limit}/genre=${APP_STORE_GAME_CATEGORY_ID}/json`;
}
