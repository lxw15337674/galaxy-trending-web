import type { Locale } from '@/i18n/config';
import { getMessages } from '@/i18n/messages';
import { classifyRuntimeError, logServerError } from '@/lib/server/runtime-error';
import {
  listLatestYouTubeHotFilters,
  queryLatestYouTubeHot,
} from '@/lib/youtube-hot/db';
import type { YouTubeCategory, YouTubeHotQueryItem, YouTubeRegion } from '@/lib/youtube-hot/types';

interface RawSearchParams {
  region?: string | string[];
  category?: string | string[];
  page?: string | string[];
}

const DEFAULT_PAGE_SIZE = 20;

function takeFirst(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeFilterValue(rawValue: string | string[] | undefined) {
  const value = takeFirst(rawValue)?.trim() ?? '';
  if (!value || value.toLowerCase() === 'all') return null;
  return value;
}

function normalizePage(rawValue: string | string[] | undefined) {
  const value = takeFirst(rawValue);
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return Math.min(Math.floor(parsed), 100000);
}

function hasRegion(regions: YouTubeRegion[], regionCode: string | null) {
  if (!regionCode) return false;
  return regions.some((item) => item.regionCode === regionCode);
}

function hasCategory(categories: YouTubeCategory[], categoryId: string | null) {
  if (!categoryId) return false;
  return categories.some((item) => item.categoryId === categoryId);
}

export interface YouTubeHotPageData {
  region: string;
  category: string;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  items: YouTubeHotQueryItem[];
  regions: YouTubeRegion[];
  categories: YouTubeCategory[];
  generatedAt: string;
  errorMessage?: string | null;
  locale: Locale;
}

export async function buildYouTubeHotPageData(
  rawSearchParams: RawSearchParams | undefined,
  locale: Locale,
): Promise<YouTubeHotPageData> {
  const t = getMessages(locale).youtubeHot;
  const fallbackNow = new Date().toISOString();
  const searchParams = rawSearchParams ?? {};

  try {
    const filters = await listLatestYouTubeHotFilters();
    if (!filters.regions.length) {
      return {
        region: 'all',
        category: 'all',
        page: 1,
        pageSize: DEFAULT_PAGE_SIZE,
        total: 0,
        totalPages: 0,
        items: [],
        regions: [],
        categories: [],
        generatedAt: fallbackNow,
        errorMessage: t.errorNoSnapshot,
        locale,
      };
    }

    const requestedRegion = normalizeFilterValue(searchParams.region)?.toUpperCase() ?? null;
    const requestedCategory = normalizeFilterValue(searchParams.category) ?? null;
    const page = normalizePage(searchParams.page);

    const region = hasRegion(filters.regions, requestedRegion) ? requestedRegion : null;
    const category = hasCategory(filters.categories, requestedCategory) ? requestedCategory : null;

    const result = await queryLatestYouTubeHot({
      region,
      category,
      page,
      pageSize: DEFAULT_PAGE_SIZE,
    });

    return {
      region: region ?? 'all',
      category: category ?? 'all',
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages: result.totalPages,
      items: result.data,
      regions: filters.regions,
      categories: filters.categories,
      generatedAt: result.batch?.generatedAt ?? fallbackNow,
      locale,
    };
  } catch (error) {
    logServerError('youtube-hot/page-data', error);
    let errorMessage: string = t.errorLoad;
    const category = classifyRuntimeError(error);
    if (category === 'missing_db_env') {
      errorMessage = t.errorNoDbEnv;
    } else if (category === 'missing_table') {
      errorMessage = t.errorNoTable;
    } else if (category === 'query_failed' || category === 'network' || category === 'auth') {
      errorMessage = t.errorQueryFailed;
    }

    return {
      region: 'all',
      category: 'all',
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
      total: 0,
      totalPages: 0,
      items: [],
      regions: [],
      categories: [],
      generatedAt: fallbackNow,
      errorMessage,
      locale,
    };
  }
}
