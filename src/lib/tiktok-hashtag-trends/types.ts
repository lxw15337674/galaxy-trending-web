export type TikTokHashtagFailureCode =
  | 'browser_launch_failed'
  | 'session_bootstrap_failed'
  | 'api_header_capture_failed'
  | 'filters_fetch_failed'
  | 'list_fetch_failed'
  | 'list_data_empty'
  | 'unknown';

export interface TikTokHashtagApiHeaders {
  timestamp: string;
  lang: string;
  referer: string;
  userSign: string;
  anonymousUserId: string;
  userAgent: string;
  accept: string;
  webId?: string;
}

export interface TikTokHashtagTimingMetrics {
  bootstrapMs: number;
  fetchListMs: number;
  enrichDetailsMs: number;
  totalMs: number;
}

export interface TikTokHashtagCountryOption {
  countryCode: string;
  countryName: string;
}

export interface TikTokHashtagTarget {
  countryCode: string;
  countryName: string;
  locale: string;
  period: number;
  industryIds: string;
  keyword: string;
  filterBy: string;
  browserExecutablePath?: string | null;
}

export interface TikTokHashtagTrendPoint {
  time: number;
  value: number;
}

export interface TikTokHashtagCreatorPreview {
  nickName: string;
  avatarUrl: string | null;
}

export interface TikTokHashtagDetail {
  postsLastPeriodText: string | null;
  postsOverallText: string | null;
  relatedHashtags: string[];
  creatorNames: string[];
  creatorCount: number;
  requestUrls: string[];
}

export interface TikTokHashtagItem {
  rank: number;
  hashtagId: string;
  hashtagName: string;
  publishCount: number | null;
  videoViews: number | null;
  rankDiff: number | null;
  rankDiffType: number | null;
  countryCode: string;
  countryName: string;
  industryName: string | null;
  trendPoints: TikTokHashtagTrendPoint[];
  creatorPreview: TikTokHashtagCreatorPreview[];
  detailPageUrl: string;
  detail?: TikTokHashtagDetail;
}

export interface TikTokHashtagTargetSuccess {
  status: 'success';
  snapshotHour: string;
  countryCode: string;
  countryName: string;
  sourceUrl: string;
  listApiUrl: string;
  timingsMs: TikTokHashtagTimingMetrics;
  items: TikTokHashtagItem[];
  detailEnrichedCount: number;
  warnings: string[];
}

export interface TikTokHashtagTargetFailure {
  status: 'failed';
  snapshotHour: string;
  countryCode: string;
  countryName: string;
  sourceUrl: string;
  listApiUrl: string | null;
  timingsMs: TikTokHashtagTimingMetrics;
  errorCode: TikTokHashtagFailureCode;
  error: string;
}

export type TikTokHashtagTargetResult = TikTokHashtagTargetSuccess | TikTokHashtagTargetFailure;

export interface TikTokHashtagLatestBatch {
  id: number;
  snapshotHour: string;
  generatedAt: string;
  targetCountryCount: number;
  successCountryCount: number;
  failedCountryCount: number;
}

export interface TikTokHashtagCountryFilter {
  countryCode: string;
  countryName: string;
  itemCount: number;
}

export interface TikTokHashtagQueryItem {
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
  trendPoints: TikTokHashtagTrendPoint[];
  creatorPreview: TikTokHashtagCreatorPreview[];
  detail: TikTokHashtagDetail | null;
}

export interface TikTokHashtagQueryResult {
  batch: TikTokHashtagLatestBatch | null;
  country: TikTokHashtagCountryFilter | null;
  data: TikTokHashtagQueryItem[];
}
