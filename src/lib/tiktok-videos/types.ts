export type TikTokVideoOrderBy = 'vv' | 'like' | 'comment' | 'repost';

export type TikTokVideoFailureCode =
  | 'browser_launch_failed'
  | 'session_bootstrap_failed'
  | 'api_header_capture_failed'
  | 'list_fetch_failed'
  | 'list_data_empty'
  | 'unknown';

export interface TikTokVideoApiHeaders {
  timestamp: string;
  lang: string;
  referer: string;
  userSign: string;
  anonymousUserId: string;
  userAgent: string;
  accept: string;
  webId?: string;
}

export interface TikTokVideoTimingMetrics {
  bootstrapMs: number;
  fetchListMs: number;
  totalMs: number;
}

export interface TikTokVideoTarget {
  countryCode: string;
  countryName: string;
  locale: string;
  periods: number[];
  orderByList: TikTokVideoOrderBy[];
  browserExecutablePath?: string | null;
}

export interface TikTokVideoItem {
  rank: number;
  videoId: string;
  itemId: string;
  itemUrl: string;
  title: string;
  coverUrl: string | null;
  durationSeconds: number | null;
  countryCode: string;
  countryName: string;
  regionName: string | null;
  rawItem: Record<string, unknown>;
}

export interface TikTokVideoTargetSuccess {
  status: 'success';
  snapshotHour: string;
  countryCode: string;
  countryName: string;
  period: number;
  orderBy: TikTokVideoOrderBy;
  sourceUrl: string;
  listApiUrl: string;
  pageCount: number;
  totalCount: number;
  timingsMs: TikTokVideoTimingMetrics;
  items: TikTokVideoItem[];
  warnings: string[];
}

export interface TikTokVideoTargetFailure {
  status: 'failed';
  snapshotHour: string;
  countryCode: string;
  countryName: string;
  period: number;
  orderBy: TikTokVideoOrderBy;
  sourceUrl: string;
  listApiUrl: string | null;
  pageCount: number;
  totalCount: number;
  timingsMs: TikTokVideoTimingMetrics;
  errorCode: TikTokVideoFailureCode;
  error: string;
}

export type TikTokVideoTargetResult = TikTokVideoTargetSuccess | TikTokVideoTargetFailure;

export interface TikTokVideoLatestBatch {
  id: number;
  snapshotHour: string;
  generatedAt: string;
  targetScopeCount: number;
  successScopeCount: number;
  failedScopeCount: number;
}

export interface TikTokVideoCountryFilter {
  countryCode: string;
  countryName: string;
  itemCount: number;
}

export interface TikTokVideoScopeFilter {
  period: number;
  orderBy: TikTokVideoOrderBy;
  countryCount: number;
}

export interface TikTokVideoQueryItem {
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
  rawItem: Record<string, unknown> | null;
}

export interface TikTokVideoQueryResult {
  batch: TikTokVideoLatestBatch | null;
  country: TikTokVideoCountryFilter | null;
  data: TikTokVideoQueryItem[];
}

export const TIKTOK_VIDEO_PERIOD_OPTIONS = [7, 30] as const;
export const TIKTOK_VIDEO_ORDER_OPTIONS: TikTokVideoOrderBy[] = ['vv', 'like', 'comment', 'repost'];

