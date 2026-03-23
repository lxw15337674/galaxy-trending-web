import { YouTubeCategory, YouTubeChannelStats, YouTubeLiveItem, YouTubeLiveTopResult, YouTubeRegion } from './types';

const YOUTUBE_API_BASE_URL = 'https://www.googleapis.com/youtube/v3';
const REQUEST_TIMEOUT_MS = 15000;

interface YouTubeMostPopularVideo {
  videoId: string;
  videoUrl: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  categoryId: string | null;
  publishedAt: string | null;
  durationIso: string | null;
  viewCount: number | null;
  likeCount: number | null;
  commentCount: number | null;
  channelId: string;
  channelTitle: string;
  tags: string[];
}

interface YouTubeLiveSearchHit {
  videoId: string;
  title: string;
  thumbnailUrl: string | null;
  channelId: string;
  channelTitle: string;
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.round(value);
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.round(parsed) : null;
  }
  return null;
}

function toBoolean(value: unknown): boolean {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function pickThumbnail(entry: any): string | null {
  const candidates = [
    entry?.maxres?.url,
    entry?.standard?.url,
    entry?.high?.url,
    entry?.medium?.url,
    entry?.default?.url,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate;
    }
  }

  return null;
}

function normalizeRegionCode(value: string): string {
  return value.trim().toUpperCase();
}

function normalizeCategoryId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0)
    .slice(0, 20);
}

async function fetchJson(url: string): Promise<Record<string, any>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
    });
    const text = await response.text();

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    try {
      return JSON.parse(text) as Record<string, any>;
    } catch (error) {
      throw new Error(`Invalid JSON: ${(error as Error).message}`);
    }
  } finally {
    clearTimeout(timer);
  }
}

export class YouTubeDataApiClient {
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey.trim();
    if (!this.apiKey) {
      throw new Error('YouTube API key is missing');
    }
  }

  private withApiKey(path: string, searchParams: Record<string, string>): { url: string; sourceUrl: string } {
    const url = new URL(`${YOUTUBE_API_BASE_URL}${path}`);
    for (const [key, value] of Object.entries(searchParams)) {
      url.searchParams.set(key, value);
    }
    url.searchParams.set('key', this.apiKey);

    const sourceUrl = new URL(`${YOUTUBE_API_BASE_URL}${path}`);
    for (const [key, value] of Object.entries(searchParams)) {
      sourceUrl.searchParams.set(key, value);
    }

    return { url: url.toString(), sourceUrl: sourceUrl.toString() };
  }

  async listRegions(): Promise<YouTubeRegion[]> {
    const { url } = this.withApiKey('/i18nRegions', {
      part: 'snippet',
      hl: 'en',
    });

    const payload = await fetchJson(url);
    const list = Array.isArray(payload.items) ? payload.items : [];

    return list
      .map((entry: any) => ({
        regionCode: normalizeRegionCode(String(entry?.id ?? '')),
        regionName: String(entry?.snippet?.name ?? '').trim(),
      }))
      .filter((entry: YouTubeRegion) => entry.regionCode && entry.regionName)
      .sort((a: YouTubeRegion, b: YouTubeRegion) => a.regionCode.localeCompare(b.regionCode));
  }

  async listCategories(regionCode: string): Promise<YouTubeCategory[]> {
    const normalizedRegionCode = normalizeRegionCode(regionCode);
    const { url } = this.withApiKey('/videoCategories', {
      part: 'snippet',
      regionCode: normalizedRegionCode,
      hl: 'en',
    });

    const payload = await fetchJson(url);
    const list = Array.isArray(payload.items) ? payload.items : [];

    return list
      .filter((entry: any) => toBoolean(entry?.snippet?.assignable) !== false)
      .map((entry: any) => ({
        categoryId: String(entry?.id ?? '').trim(),
        categoryTitle: String(entry?.snippet?.title ?? '').trim(),
      }))
      .filter((entry: YouTubeCategory) => entry.categoryId && entry.categoryTitle)
      .sort((a: YouTubeCategory, b: YouTubeCategory) => Number(a.categoryId) - Number(b.categoryId));
  }

  async listMostPopularVideos(
    regionCode: string,
    maxResults: number,
  ): Promise<{ sourceUrl: string; rawPayload: unknown; items: YouTubeMostPopularVideo[] }> {
    const normalizedRegionCode = normalizeRegionCode(regionCode);
    const safeMaxResults = Math.max(1, Math.min(50, Math.round(maxResults)));

    const params = {
      part: 'snippet,statistics,contentDetails',
      chart: 'mostPopular',
      regionCode: normalizedRegionCode,
      maxResults: String(safeMaxResults),
    };

    const { url, sourceUrl } = this.withApiKey('/videos', params);
    const payload = await fetchJson(url);
    const list = Array.isArray(payload.items) ? payload.items : [];

    const items = list
      .map((entry: any) => {
        const videoId = String(entry?.id ?? '').trim();
        const channelId = String(entry?.snippet?.channelId ?? '').trim();
        const title = String(entry?.snippet?.title ?? '').trim();

        if (!videoId || !channelId || !title) {
          return null;
        }

        return {
          videoId,
          videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
          title,
          description: typeof entry?.snippet?.description === 'string' ? entry.snippet.description : null,
          thumbnailUrl: pickThumbnail(entry?.snippet?.thumbnails),
          categoryId: normalizeCategoryId(entry?.snippet?.categoryId),
          publishedAt: typeof entry?.snippet?.publishedAt === 'string' ? entry.snippet.publishedAt : null,
          durationIso: typeof entry?.contentDetails?.duration === 'string' ? entry.contentDetails.duration : null,
          viewCount: toNumber(entry?.statistics?.viewCount),
          likeCount: toNumber(entry?.statistics?.likeCount),
          commentCount: toNumber(entry?.statistics?.commentCount),
          channelId,
          channelTitle: String(entry?.snippet?.channelTitle ?? '').trim() || channelId,
          tags: normalizeTags(entry?.snippet?.tags),
        };
      })
      .filter((item): item is YouTubeMostPopularVideo => Boolean(item));

    return {
      sourceUrl,
      rawPayload: payload,
      items,
    };
  }

  async listGlobalLiveTopVideos(
    maxResults: number,
    query = 'live',
    searchPages = 4,
  ): Promise<YouTubeLiveTopResult> {
    const safeMaxResults = Math.max(1, Math.min(200, Math.round(maxResults)));
    const safeSearchPages = Math.max(1, Math.min(10, Math.round(searchPages)));
    const targetResultCount = Math.min(safeMaxResults, safeSearchPages * 50);
    const normalizedQuery = query.trim() || 'live';

    const baseSearchParams = {
      part: 'snippet',
      type: 'video',
      eventType: 'live',
      order: 'viewCount',
      q: normalizedQuery,
      maxResults: String(Math.min(50, targetResultCount)),
    };
    const { sourceUrl } = this.withApiKey('/search', baseSearchParams);

    const searchItems: YouTubeLiveSearchHit[] = [];
    const seenVideoIds = new Set<string>();
    let pageToken = '';

    for (let page = 0; page < safeSearchPages; page += 1) {
      const remaining = targetResultCount - searchItems.length;
      if (remaining <= 0) break;

      const pageParams: Record<string, string> = {
        ...baseSearchParams,
        maxResults: String(Math.min(50, remaining)),
      };
      if (pageToken) {
        pageParams.pageToken = pageToken;
      }

      const { url: searchUrl } = this.withApiKey('/search', pageParams);
      const searchPayload = await fetchJson(searchUrl);
      const pageItems = Array.isArray(searchPayload.items) ? searchPayload.items : [];

      for (const entry of pageItems) {
        const videoId = String(entry?.id?.videoId ?? '').trim();
        const channelId = String(entry?.snippet?.channelId ?? '').trim();
        const title = String(entry?.snippet?.title ?? '').trim();
        if (!videoId || !channelId || !title) continue;
        if (seenVideoIds.has(videoId)) continue;
        seenVideoIds.add(videoId);

        searchItems.push({
          videoId,
          title,
          thumbnailUrl: pickThumbnail(entry?.snippet?.thumbnails),
          channelId,
          channelTitle: String(entry?.snippet?.channelTitle ?? '').trim() || channelId,
        });
      }

      if (searchItems.length >= targetResultCount) break;

      pageToken = typeof searchPayload.nextPageToken === 'string' ? searchPayload.nextPageToken : '';
      if (!pageToken) break;
    }

    if (!searchItems.length) {
      return {
        sourceUrl,
        detailSourceUrl: '',
        items: [],
      };
    }

    const detailMap = new Map<string, any>();
    let detailSourceUrl = '';
    const videoIds = Array.from(new Set(searchItems.map((item) => item.videoId)));
    for (let offset = 0; offset < videoIds.length; offset += 50) {
      const batchIds = videoIds.slice(offset, offset + 50);
      const detailParams = {
        part: 'snippet,statistics,contentDetails,liveStreamingDetails',
        id: batchIds.join(','),
      };

      const { url: detailUrl, sourceUrl: batchSourceUrl } = this.withApiKey('/videos', detailParams);
      if (!detailSourceUrl) {
        detailSourceUrl = batchSourceUrl;
      }

      const detailPayload = await fetchJson(detailUrl);
      const detailList = Array.isArray(detailPayload.items) ? detailPayload.items : [];
      for (const entry of detailList) {
        const videoId = String(entry?.id ?? '').trim();
        if (!videoId) continue;
        detailMap.set(videoId, entry);
      }
    }

    const channelStatsMap = await this.getChannelStatsByIds(searchItems.map((item) => item.channelId));
    const fetchedAt = new Date().toISOString();

    const merged = searchItems.map((searchItem, index) => {
      const detail = detailMap.get(searchItem.videoId);
      const channel = channelStatsMap.get(searchItem.channelId);
      const detailTitle = String(detail?.snippet?.title ?? '').trim();
      const detailChannelTitle = String(detail?.snippet?.channelTitle ?? '').trim();

      return {
        rank: index + 1,
        videoId: searchItem.videoId,
        videoUrl: `https://www.youtube.com/watch?v=${searchItem.videoId}`,
        title: detailTitle || searchItem.title,
        thumbnailUrl: pickThumbnail(detail?.snippet?.thumbnails) ?? searchItem.thumbnailUrl,
        categoryId: normalizeCategoryId(detail?.snippet?.categoryId),
        categoryTitle: null,
        defaultLanguage: typeof detail?.snippet?.defaultLanguage === 'string' ? detail.snippet.defaultLanguage : null,
        defaultAudioLanguage:
          typeof detail?.snippet?.defaultAudioLanguage === 'string' ? detail.snippet.defaultAudioLanguage : null,
        channelId: searchItem.channelId,
        channelTitle: channel?.channelTitle ?? (detailChannelTitle || searchItem.channelTitle),
        channelUrl: channel?.channelUrl ?? `https://www.youtube.com/channel/${searchItem.channelId}`,
        channelAvatarUrl: channel?.channelAvatarUrl ?? null,
        subscriberCount: channel?.subscriberCount ?? null,
        hiddenSubscriberCount: channel?.hiddenSubscriberCount ?? false,
        concurrentViewers: toNumber(detail?.liveStreamingDetails?.concurrentViewers),
        viewCount: toNumber(detail?.statistics?.viewCount),
        likeCount: toNumber(detail?.statistics?.likeCount),
        commentCount: toNumber(detail?.statistics?.commentCount),
        startedAt:
          typeof detail?.liveStreamingDetails?.actualStartTime === 'string'
            ? detail.liveStreamingDetails.actualStartTime
            : null,
        scheduledStartTime:
          typeof detail?.liveStreamingDetails?.scheduledStartTime === 'string'
            ? detail.liveStreamingDetails.scheduledStartTime
            : null,
        fetchedAt,
      } satisfies YouTubeLiveItem;
    });

    const categories = await this.listCategories('US');
    const categoryNameMap = new Map(categories.map((item) => [item.categoryId, item.categoryTitle]));

    const sorted = merged.sort((a, b) => {
      const aConcurrent = a.concurrentViewers ?? -1;
      const bConcurrent = b.concurrentViewers ?? -1;
      if (aConcurrent !== bConcurrent) {
        return bConcurrent - aConcurrent;
      }
      return a.rank - b.rank;
    });

    const items = sorted.map((item, index) => ({
      ...item,
      rank: index + 1,
      categoryTitle: item.categoryId ? categoryNameMap.get(item.categoryId) ?? null : null,
    }));

    return {
      sourceUrl,
      detailSourceUrl,
      items,
    };
  }

  async getChannelStatsByIds(channelIds: string[]): Promise<Map<string, YouTubeChannelStats>> {
    const normalizedIds = Array.from(
      new Set(
        channelIds
          .map((id) => String(id ?? '').trim())
          .filter((id) => id.length > 0),
      ),
    );

    const result = new Map<string, YouTubeChannelStats>();
    if (!normalizedIds.length) {
      return result;
    }

    const batchSize = 50;
    for (let offset = 0; offset < normalizedIds.length; offset += batchSize) {
      const batch = normalizedIds.slice(offset, offset + batchSize);
      const { url } = this.withApiKey('/channels', {
        part: 'snippet,statistics',
        id: batch.join(','),
      });

      const payload = await fetchJson(url);
      const list = Array.isArray(payload.items) ? payload.items : [];

      for (const entry of list) {
        const channelId = String(entry?.id ?? '').trim();
        if (!channelId) continue;

        const channelTitle = String(entry?.snippet?.title ?? '').trim() || channelId;
        result.set(channelId, {
          channelId,
          channelTitle,
          channelUrl: `https://www.youtube.com/channel/${channelId}`,
          channelAvatarUrl: pickThumbnail(entry?.snippet?.thumbnails),
          subscriberCount: toNumber(entry?.statistics?.subscriberCount),
          hiddenSubscriberCount: toBoolean(entry?.statistics?.hiddenSubscriberCount),
        });
      }
    }

    return result;
  }
}

