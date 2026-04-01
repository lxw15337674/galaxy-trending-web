export const GOOGLE_PLAY_GAME_CHART_TYPE_FREE = 'topfree';
export const GOOGLE_PLAY_GAME_CHART_TYPE_PAID = 'toppaid';
export const GOOGLE_PLAY_GAME_CHART_TYPE_GROSSING = 'topgrossing';
export const GOOGLE_PLAY_GAME_CHART_TYPES = [
  GOOGLE_PLAY_GAME_CHART_TYPE_FREE,
  GOOGLE_PLAY_GAME_CHART_TYPE_PAID,
  GOOGLE_PLAY_GAME_CHART_TYPE_GROSSING,
] as const;

export type GooglePlayGameChartType = (typeof GOOGLE_PLAY_GAME_CHART_TYPES)[number];

export const DEFAULT_GOOGLE_PLAY_GAME_COUNTRY_CODES = ['CN', 'US', 'JP', 'KR', 'DE', 'GB', 'FR', 'CA', 'BR', 'MX'] as const;
export const GOOGLE_PLAY_GAME_PAGE_LIMIT = 50;

export interface GooglePlayGameCountryOption {
  countryCode: string;
  countryName: string;
}

export interface GooglePlayGameChartOption {
  chartType: GooglePlayGameChartType;
  chartLabel: string;
}

export interface GooglePlayGameChartItem {
  rank: number;
  appId: string;
  appName: string;
  developerName: string | null;
  storeUrl: string;
  artworkUrl: string | null;
  ratingText: string | null;
  ratingValue: string | null;
  priceText: string | null;
  primaryGenre: string | null;
  genreSummary: string | null;
  rawItem: unknown;
}

export interface GooglePlayGameChartSnapshot {
  chartType: GooglePlayGameChartType;
  countryCode: string;
  countryName: string;
  snapshotHour: string;
  fetchedAt: string;
  sourceUrl: string;
  pageTitle: string;
  items: GooglePlayGameChartItem[];
  rawPayload: unknown;
}

export interface GooglePlayGameChartSnapshotWithItems {
  id: number;
  chartType: GooglePlayGameChartType;
  countryCode: string;
  countryName: string;
  snapshotHour: string;
  fetchedAt: string;
  sourceUrl: string;
  pageTitle: string;
  itemCount: number;
  items: GooglePlayGameChartItem[];
}

export function normalizeGooglePlayGameCountryCode(value: string | null | undefined) {
  return String(value ?? '').trim().toUpperCase() || 'US';
}

export function normalizeGooglePlayGameChartType(
  value: string | string[] | null | undefined,
): GooglePlayGameChartType {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const normalized = String(rawValue ?? '').trim().toLowerCase();
  if (normalized === GOOGLE_PLAY_GAME_CHART_TYPE_PAID) return GOOGLE_PLAY_GAME_CHART_TYPE_PAID;
  if (normalized === GOOGLE_PLAY_GAME_CHART_TYPE_GROSSING) return GOOGLE_PLAY_GAME_CHART_TYPE_GROSSING;
  return GOOGLE_PLAY_GAME_CHART_TYPE_FREE;
}

export function buildGooglePlayGameSourceUrl(countryCode: string) {
  const normalizedCountryCode = normalizeGooglePlayGameCountryCode(countryCode);
  return `https://play.google.com/store/games?device=phone&hl=en_US&gl=${normalizedCountryCode}`;
}

export function getGooglePlayGameChartButtonLabel(chartType: GooglePlayGameChartType) {
  if (chartType === GOOGLE_PLAY_GAME_CHART_TYPE_PAID) return 'Top paid';
  if (chartType === GOOGLE_PLAY_GAME_CHART_TYPE_GROSSING) return 'Top grossing';
  return 'Top free';
}
