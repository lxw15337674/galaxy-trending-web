export type XTrendExtractionSource = 'network' | 'dom';
export type XTrendCookieSource = 'storage_state_file' | 'admin_api';

export interface XTrendTarget {
  regionKey: string;
  regionLabel: string;
  targetUrl: string;
  cookieSource: XTrendCookieSource;
  storageStatePath?: string | null;
  adminApiBaseUrl?: string | null;
  adminApiKey?: string | null;
  browserExecutablePath?: string | null;
  locale?: string | null;
}

export interface XTrendItem {
  rank: number;
  trendName: string;
  normalizedKey: string;
  queryText: string | null;
  trendUrl: string | null;
  metaText: string | null;
  tweetVolume: number | null;
  raw?: unknown;
}

export interface XTrendRegionSuccess {
  status: 'success';
  snapshotHour: string;
  regionKey: string;
  regionLabel: string;
  sourceUrl: string;
  extractionSource: XTrendExtractionSource;
  loggedIn: boolean;
  items: XTrendItem[];
  rawPayload: unknown;
}

export interface XTrendRegionFailure {
  status: 'failed';
  snapshotHour: string;
  regionKey: string;
  regionLabel: string;
  sourceUrl: string;
  extractionSource: XTrendExtractionSource | null;
  loggedIn: boolean;
  error: string;
  rawPayload?: unknown;
}

export type XTrendRegionResult = XTrendRegionSuccess | XTrendRegionFailure;

export interface XTrendLatestBatch {
  id: number;
  snapshotHour: string;
  generatedAt: string;
  targetRegionCount: number;
  successRegionCount: number;
  failedRegionCount: number;
}

export interface XTrendQueryItem {
  snapshotHour: string;
  fetchedAt: string;
  regionKey: string;
  regionLabel: string;
  rank: number;
  trendName: string;
  normalizedKey: string;
  queryText: string | null;
  trendUrl: string | null;
  metaText: string | null;
  tweetVolume: number | null;
}

export interface XTrendQueryResult {
  batch: XTrendLatestBatch | null;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  data: XTrendQueryItem[];
}

export interface XTrendHistoryPoint extends XTrendQueryItem {}

export interface XTrendHistorySeries {
  normalizedKey: string;
  trendName: string;
  appearances: number;
  bestRank: number;
  latestRank: number;
  maxTweetVolume: number | null;
  points: XTrendHistoryPoint[];
}
