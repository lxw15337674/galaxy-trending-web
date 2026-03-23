export interface YouTubeRegion {
  regionCode: string;
  regionName: string;
}

export interface YouTubeCategory {
  categoryId: string;
  categoryTitle: string;
}

export interface YouTubeChannelStats {
  channelId: string;
  channelTitle: string;
  channelUrl: string;
  channelAvatarUrl: string | null;
  subscriberCount: number | null;
  hiddenSubscriberCount: boolean;
}

export interface YouTubeHotItem {
  rank: number;
  videoId: string;
  videoUrl: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  categoryId: string | null;
  categoryTitle: string | null;
  publishedAt: string | null;
  durationIso: string | null;
  viewCount: number | null;
  likeCount: number | null;
  commentCount: number | null;
  channelId: string;
  channelTitle: string;
  channelUrl: string;
  channelAvatarUrl: string | null;
  subscriberCount: number | null;
  hiddenSubscriberCount: boolean;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface YouTubeHotRegionSuccess {
  status: 'success';
  snapshotHour: string;
  regionCode: string;
  regionName: string;
  sourceUrl: string;
  items: YouTubeHotItem[];
  rawPayload: unknown;
}

export interface YouTubeHotRegionFailure {
  status: 'failed';
  snapshotHour: string;
  regionCode: string;
  regionName: string;
  sourceUrl: string;
  error: string;
  rawPayload?: unknown;
}

export type YouTubeHotRegionResult = YouTubeHotRegionSuccess | YouTubeHotRegionFailure;

export interface YouTubeHotLatestBatch {
  id: number;
  snapshotHour: string;
  generatedAt: string;
  regionCount: number;
  successRegionCount: number;
  failedRegionCount: number;
}

export interface YouTubeHotQueryItem {
  snapshotHour: string;
  fetchedAt: string;
  regionCode: string;
  regionName: string;
  rank: number;
  videoId: string;
  videoUrl: string;
  title: string;
  thumbnailUrl: string | null;
  categoryId: string | null;
  categoryTitle: string | null;
  publishedAt: string | null;
  durationIso: string | null;
  viewCount: number | null;
  likeCount: number | null;
  commentCount: number | null;
  channelId: string;
  channelTitle: string;
  channelUrl: string;
  channelAvatarUrl: string | null;
  subscriberCount: number | null;
  hiddenSubscriberCount: boolean;
  tags: string[];
  isGlobalAggregate?: boolean;
  aggregateRegionCount?: number;
  aggregateRegionCodes?: string[];
  aggregateRegionNames?: string[];
  aggregateBestRank?: number;
  aggregateAvgRank?: number;
  aggregateScore?: number;
}

export interface YouTubeHotQueryParams {
  region?: string | null;
  category?: string | null;
  page?: number;
  pageSize?: number;
}

export interface YouTubeHotQueryResult {
  batch: YouTubeHotLatestBatch | null;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  data: YouTubeHotQueryItem[];
}

export interface YouTubeHotFilters {
  regions: YouTubeRegion[];
  categories: YouTubeCategory[];
}

export interface YouTubeLiveItem {
  rank: number;
  videoId: string;
  videoUrl: string;
  title: string;
  thumbnailUrl: string | null;
  categoryId: string | null;
  categoryTitle: string | null;
  defaultLanguage: string | null;
  defaultAudioLanguage: string | null;
  channelId: string;
  channelTitle: string;
  channelUrl: string;
  channelAvatarUrl: string | null;
  subscriberCount: number | null;
  hiddenSubscriberCount: boolean;
  concurrentViewers: number | null;
  viewCount: number | null;
  likeCount: number | null;
  commentCount: number | null;
  startedAt: string | null;
  scheduledStartTime: string | null;
  fetchedAt: string;
}

export interface YouTubeLiveTopResult {
  sourceUrl: string;
  detailSourceUrl: string;
  items: YouTubeLiveItem[];
}
