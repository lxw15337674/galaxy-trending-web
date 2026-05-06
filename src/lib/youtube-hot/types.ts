export interface YouTubeRegion {
  regionCode: string;
  regionName: string;
}

export interface YouTubeCategory {
  categoryId: string;
  categoryTitle: string;
  count?: number;
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
  snapshotDate: string;
  generatedAt: string;
  regionCount: number;
  itemCount: number;
}

export interface YouTubeHotQueryItem {
  snapshotDate: string;
  fetchedAt: string;
  regionCode: string;
  regionName: string;
  rank: number;
  bestRank?: number;
  appearances?: number;
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

export const YOUTUBE_HOT_SORT_VALUES = [
  'rank_asc',
  'region_coverage_desc',
  'views_desc',
  'published_newest',
] as const;

export type YouTubeHotSort = (typeof YOUTUBE_HOT_SORT_VALUES)[number];

export function getAvailableYouTubeHotSorts(region?: string | null): readonly YouTubeHotSort[] {
  if (region?.trim()) {
    return ['rank_asc', 'views_desc', 'published_newest'];
  }

  return YOUTUBE_HOT_SORT_VALUES;
}

export function getDefaultYouTubeHotSort(region?: string | null): YouTubeHotSort {
  return region?.trim() ? 'rank_asc' : 'region_coverage_desc';
}

export function normalizeYouTubeHotSort(value: string | null | undefined, region?: string | null): YouTubeHotSort {
  const normalized = value?.trim() ?? '';
  const availableSorts = getAvailableYouTubeHotSorts(region);
  if (availableSorts.includes(normalized as YouTubeHotSort)) {
    return normalized as YouTubeHotSort;
  }

  return getDefaultYouTubeHotSort(region);
}

export interface YouTubeHotQueryParams {
  region?: string | null;
  category?: string | null;
  sort?: YouTubeHotSort;
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
