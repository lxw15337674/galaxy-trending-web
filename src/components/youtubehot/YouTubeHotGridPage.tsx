'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { startTransition, useEffect, useMemo, useRef, useState } from 'react';
import { useInView } from 'react-intersection-observer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { type ComboboxOption } from '@/components/ui/combobox';
import { FilterCombobox } from '@/components/ui/filter-combobox';
import { YouTubeHotVideoCard } from '@/components/youtubehot/YouTubeHotVideoCard';
import type { Locale } from '@/i18n/config';
import { getMessages } from '@/i18n/messages';
import { createRegionDisplayNames, getLocalizedYouTubeRegionLabel, getYouTubeCategoryLabel } from '@/lib/youtube-hot/labels';
import type { YouTubeCategory, YouTubeHotQueryItem, YouTubeRegion } from '@/lib/youtube-hot/types';

interface YouTubeHotHistoryResponse {
  batch: {
    snapshotHour: string;
    generatedAt: string;
  } | null;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  data: YouTubeHotQueryItem[];
  error?: string;
}

interface YouTubeHotFiltersResponse {
  data: {
    regions: YouTubeRegion[];
    categories: YouTubeCategory[];
  };
  error?: string;
}

interface YouTubeHotGridPageProps {
  locale: Locale;
  userRegion?: string | null;
  jsonLd?: unknown;
}

const DEFAULT_PAGE_SIZE = 20;
const PAGE_SECTION_CLASS = 'mx-auto w-full px-4 pt-2 md:px-6 md:pt-6 lg:w-[80%]';
const CARD_GRID_CLASS = 'mt-2 grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4';
const cachedFiltersByRegion = new Map<string, YouTubeHotFiltersResponse['data']>();
const filtersRequestsByRegion = new Map<string, Promise<YouTubeHotFiltersResponse['data']>>();

async function fetchYouTubeHotFilters(region: string) {
  const cacheKey = region === 'all' ? 'all' : region;
  const cachedFilters = cachedFiltersByRegion.get(cacheKey);
  if (cachedFilters) {
    return cachedFilters;
  }

  const existingRequest = filtersRequestsByRegion.get(cacheKey);
  if (existingRequest) {
    return existingRequest;
  }

  const search = new URLSearchParams();
  if (region !== 'all') {
    search.set('region', region);
  }

  const request = fetch(`/api/youtube-hot-history/filters?${search.toString()}`, { cache: 'no-store' })
      .then(async (response) => {
        const payload = (await response.json()) as Partial<YouTubeHotFiltersResponse>;
        if (!response.ok) {
          throw new Error(payload.error ?? 'Failed to load filters');
        }

        const nextFilters = {
          regions: Array.isArray(payload.data?.regions) ? payload.data.regions : [],
          categories: Array.isArray(payload.data?.categories) ? payload.data.categories : [],
        };

        cachedFiltersByRegion.set(cacheKey, nextFilters);
        return nextFilters;
      })
      .finally(() => {
        filtersRequestsByRegion.delete(cacheKey);
      });

  filtersRequestsByRegion.set(cacheKey, request);
  return request;
}

function buildItemKey(item: YouTubeHotQueryItem) {
  return `${item.snapshotHour}-${item.regionCode}-${item.rank}-${item.videoId}`;
}

function mergeItems(current: YouTubeHotQueryItem[], next: YouTubeHotQueryItem[]) {
  const merged = [...current];
  const seen = new Set(current.map(buildItemKey));

  for (const item of next) {
    const key = buildItemKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }

  return merged;
}

function normalizeFilterValue(value: string | null | undefined) {
  const normalized = value?.trim() ?? '';
  return normalized ? normalized : 'all';
}

function buildRegionOptions(
  regions: YouTubeRegion[],
  t: ReturnType<typeof getMessages>['youtubeHot'],
  formatRegionLabel: (region: YouTubeRegion) => string,
  userRegion: string | null | undefined,
) {
  const sortedRegions = !userRegion
    ? regions
    : (() => {
        const targetIndex = regions.findIndex((item) => item.regionCode === userRegion);
        if (targetIndex <= 0) {
          return regions;
        }

        return [regions[targetIndex], ...regions.slice(0, targetIndex), ...regions.slice(targetIndex + 1)];
      })();

  return [
    { value: 'all', label: t.allRegions },
    ...sortedRegions.map((item) => {
      const localizedLabel = formatRegionLabel(item);
      return {
        value: item.regionCode,
        label: localizedLabel,
        keywords: [item.regionCode, item.regionName, localizedLabel],
      };
    }),
  ] satisfies ComboboxOption[];
}

function buildCategoryOptions(
  categories: YouTubeCategory[],
  t: ReturnType<typeof getMessages>['youtubeHot'],
  locale: Locale,
) {
  return [
    { value: 'all', label: t.allCategories },
    ...categories.map((item) => {
      const categoryLabel = getYouTubeCategoryLabel(item.categoryId, item.categoryTitle, locale);
      const countSuffix = typeof item.count === 'number' ? ` (${item.count})` : '';
      return {
        value: item.categoryId,
        label: `${categoryLabel}${countSuffix}`,
        keywords: [item.categoryId, item.categoryTitle ?? '', categoryLabel],
      };
    }),
  ] satisfies ComboboxOption[];
}

export function YouTubeHotGridPage({ locale, userRegion, jsonLd }: YouTubeHotGridPageProps) {
  const t = getMessages(locale).youtubeHot;
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [requestedRegion, setRequestedRegion] = useState(() => normalizeFilterValue(searchParams.get('region')));
  const [requestedCategory, setRequestedCategory] = useState(() => normalizeFilterValue(searchParams.get('category')));
  const [isHydrated, setIsHydrated] = useState(false);
  const initialCachedFilters = cachedFiltersByRegion.get(requestedRegion === 'all' ? 'all' : requestedRegion);
  const [regions, setRegions] = useState<YouTubeRegion[]>(initialCachedFilters?.regions ?? []);
  const [categories, setCategories] = useState<YouTubeCategory[]>(initialCachedFilters?.categories ?? []);
  const [items, setItems] = useState<YouTubeHotQueryItem[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [filtersLoading, setFiltersLoading] = useState(!initialCachedFilters);
  const [dataLoading, setDataLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const requestIdRef = useRef(0);
  const filtersReadyRef = useRef(false);
  const loadedPageRef = useRef(1);
  const loadedTotalPagesRef = useRef(0);
  const isLoadingMoreRef = useRef(false);
  const loadNextPageRef = useRef<() => Promise<void>>(async () => {});
  const { ref: sentinelRef, inView } = useInView({
    rootMargin: '320px 0px',
    threshold: 0,
  });

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    const nextRegion = normalizeFilterValue(searchParams.get('region'));
    const nextCategory = normalizeFilterValue(searchParams.get('category'));
    setRequestedRegion((current) => (current === nextRegion ? current : nextRegion));
    setRequestedCategory((current) => (current === nextCategory ? current : nextCategory));
  }, [searchParams]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const syncFromLocation = () => {
      const params = new URLSearchParams(window.location.search);
      setDataLoading(true);
      setRequestedRegion(normalizeFilterValue(params.get('region')));
      setRequestedCategory(normalizeFilterValue(params.get('category')));
    };

    window.addEventListener('popstate', syncFromLocation);
    return () => {
      window.removeEventListener('popstate', syncFromLocation);
    };
  }, []);

  const activeRegion = regions.some((item) => item.regionCode === requestedRegion) ? requestedRegion : 'all';
  const activeCategory = categories.some((item) => item.categoryId === requestedCategory) ? requestedCategory : 'all';
  const queryKey = `${activeRegion}|${activeCategory}|${pageSize}`;

  const formatRegionLabel = useMemo(() => {
    const regionDisplayNames = isHydrated ? createRegionDisplayNames(locale) : null;
    const cache = new Map<string, string>();
    return (regionItem: YouTubeRegion) => {
      const key = `${regionItem.regionCode}|${regionItem.regionName}`;
      const hit = cache.get(key);
      if (hit) return hit;
      const label = getLocalizedYouTubeRegionLabel(regionItem.regionCode, regionItem.regionName, locale, regionDisplayNames);
      cache.set(key, label);
      return label;
    };
  }, [isHydrated, locale]);

  const regionOptions = useMemo(
    () => buildRegionOptions(regions, t, formatRegionLabel, userRegion),
    [regions, t, formatRegionLabel, userRegion],
  );
  const categoryOptions = useMemo(() => buildCategoryOptions(categories, t, locale), [categories, t, locale]);
  const loadMoreSkeletonCount = Math.min(pageSize, Math.max(total - items.length, 0));

  useEffect(() => {
    let cancelled = false;

    async function loadFilters() {
      const regionKey = requestedRegion === 'all' ? 'all' : requestedRegion;
      setFiltersLoading(!cachedFiltersByRegion.get(regionKey));
      setErrorMessage(null);

      try {
        const nextFilters = await fetchYouTubeHotFilters(requestedRegion);
        if (cancelled) return;
        setRegions(nextFilters.regions);
        setCategories(nextFilters.categories);
        filtersReadyRef.current = true;
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof Error ? error.message : t.errorLoad);
        setRegions([]);
        setCategories([]);
        filtersReadyRef.current = false;
      } finally {
        if (!cancelled) {
          setFiltersLoading(false);
        }
      }
    }

    void loadFilters();

    return () => {
      cancelled = true;
    };
  }, [requestedRegion, t.errorLoad]);

  useEffect(() => {
    if (filtersLoading) return;
    if (requestedCategory === 'all') return;
    if (categories.some((item) => item.categoryId === requestedCategory)) return;

    updateQuery({ category: 'all', page: '1' });
  }, [categories, filtersLoading, requestedCategory]);

  useEffect(() => {
    if (filtersLoading) return;
    if (!filtersReadyRef.current) {
      setDataLoading(false);
      setItems([]);
      setPage(1);
      setTotal(0);
      setTotalPages(0);
      setGeneratedAt(null);
      loadedPageRef.current = 1;
      loadedTotalPagesRef.current = 0;
      return;
    }

    const requestId = ++requestIdRef.current;
    const controller = new AbortController();
    const params = new URLSearchParams();

    if (activeRegion !== 'all') {
      params.set('region', activeRegion);
    }
    if (activeCategory !== 'all') {
      params.set('category', activeCategory);
    }
    params.set('page', '1');
    params.set('pageSize', String(pageSize));

    setDataLoading(true);
    setLoadError(null);

    void (async () => {
      try {
        const response = await fetch(`/api/youtube-hot-history?${params.toString()}`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        const payload = (await response.json()) as Partial<YouTubeHotHistoryResponse>;

        if (!response.ok) {
          throw new Error(payload.error ?? t.errorLoad);
        }

        if (controller.signal.aborted || requestIdRef.current !== requestId) return;
        if (!payload.pagination || !Array.isArray(payload.data)) {
          throw new Error(t.errorLoad);
        }

        setItems(payload.data);
        setPage(payload.pagination.page);
        setPageSize(payload.pagination.pageSize);
        setTotal(payload.pagination.total);
        setTotalPages(payload.pagination.totalPages);
        setGeneratedAt(payload.batch?.generatedAt ?? null);
        loadedPageRef.current = payload.pagination.page;
        loadedTotalPagesRef.current = payload.pagination.totalPages;
      } catch (error) {
        if (controller.signal.aborted || requestIdRef.current !== requestId) return;
        setItems([]);
        setPage(1);
        setTotal(0);
        setTotalPages(0);
        setGeneratedAt(null);
        setLoadError(error instanceof Error ? error.message : t.errorLoad);
      } finally {
        if (!controller.signal.aborted && requestIdRef.current === requestId) {
          setDataLoading(false);
          setIsLoadingMore(false);
          isLoadingMoreRef.current = false;
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [activeCategory, activeRegion, filtersLoading, pageSize, queryKey, t.errorLoad]);

  loadNextPageRef.current = async () => {
    if (dataLoading || isLoadingMoreRef.current) return;

    const nextPage = loadedPageRef.current + 1;
    if (loadedTotalPagesRef.current === 0 || nextPage > loadedTotalPagesRef.current) return;

    const activeQueryKey = queryKey;
    const params = new URLSearchParams();
    if (activeRegion !== 'all') {
      params.set('region', activeRegion);
    }
    if (activeCategory !== 'all') {
      params.set('category', activeCategory);
    }
    params.set('page', String(nextPage));
    params.set('pageSize', String(pageSize));

    isLoadingMoreRef.current = true;
    setIsLoadingMore(true);
    setLoadError(null);

    try {
      const response = await fetch(`/api/youtube-hot-history?${params.toString()}`, {
        cache: 'no-store',
      });
      const payload = (await response.json()) as Partial<YouTubeHotHistoryResponse>;

      if (!response.ok) {
        throw new Error(payload.error ?? t.loadMoreFailed);
      }

      if (!payload.pagination || !Array.isArray(payload.data)) {
        throw new Error(t.loadMoreFailed);
      }

      if (activeQueryKey !== `${activeRegion}|${activeCategory}|${pageSize}`) return;

      setItems((current) => mergeItems(current, payload.data ?? []));
      setPage(payload.pagination.page);
      setTotal(payload.pagination.total);
      setTotalPages(payload.pagination.totalPages);
      setGeneratedAt(payload.batch?.generatedAt ?? null);

      loadedPageRef.current = payload.pagination.page;
      loadedTotalPagesRef.current = payload.pagination.totalPages;
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : t.loadMoreFailed);
    } finally {
      isLoadingMoreRef.current = false;
      setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    if (!inView) return;
    if (filtersLoading || dataLoading || isLoadingMore) return;
    if (loadError) return;
    if (totalPages <= 1 || page >= totalPages) return;

    void loadNextPageRef.current();
  }, [dataLoading, filtersLoading, inView, isLoadingMore, loadError, page, totalPages]);

  const updateQuery = (patch: Partial<Record<'region' | 'category' | 'page', string>>) => {
    const currentSearch = typeof window !== 'undefined' ? window.location.search : searchParams.toString();
    const next = new URLSearchParams(currentSearch);

    for (const [key, value] of Object.entries(patch)) {
      if (!value || (key !== 'page' && value === 'all') || (key === 'page' && value === '1')) {
        next.delete(key);
      } else {
        next.set(key, value);
      }
    }

    const nextQuery = next.toString();
    const currentQuery = currentSearch.startsWith('?') ? currentSearch.slice(1) : currentSearch;
    if (nextQuery === currentQuery) return;

    setLoadError(null);
    setDataLoading(true);
    startTransition(() => {
      const nextRegion = normalizeFilterValue(next.get('region'));
      const nextCategory = normalizeFilterValue(next.get('category'));

      setRequestedRegion(nextRegion);
      setRequestedCategory(nextCategory);

      if (typeof window !== 'undefined') {
        const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname;
        window.history.replaceState(window.history.state, '', nextUrl);
      }
    });
  };

  const onRegionChange = (value: string) => {
    updateQuery({ region: value, page: '1' });
  };

  const onCategoryChange = (value: string) => {
    updateQuery({ category: value, page: '1' });
  };

  const showCardSkeleton = dataLoading;
  const showEmptyState = !dataLoading && !errorMessage && items.length === 0;

  return (
    <main
      suppressHydrationWarning
      className="min-h-screen bg-gradient-to-b from-zinc-100 via-zinc-50 to-white pb-10 text-zinc-900 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 dark:text-zinc-100"
    >
      {jsonLd ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} /> : null}
      <h1 className="sr-only">{t.title}</h1>
      <section className={PAGE_SECTION_CLASS}>
        <Card className="border-zinc-200 bg-white/90 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/85">
          <CardHeader className="p-2 md:p-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="grid w-full grid-cols-1 gap-2 min-[360px]:grid-cols-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:justify-end">
                <div className="w-full sm:w-[260px] xl:w-[300px]">
                  <FilterCombobox
                    options={regionOptions}
                    value={activeRegion}
                    placeholder={t.filterRegionSearchPlaceholder}
                    emptyText={t.filterNoMatch}
                    clearLabel={t.clearSearch}
                    onValueChange={onRegionChange}
                  />
                </div>

                <div className="w-full sm:w-[260px] xl:w-[300px]">
                  <FilterCombobox
                    options={categoryOptions}
                    value={activeCategory}
                    placeholder={t.filterCategorySearchPlaceholder}
                    emptyText={t.filterNoMatch}
                    clearLabel={t.clearSearch}
                    onValueChange={onCategoryChange}
                  />
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        {errorMessage ? (
          <Card className="mt-2 border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/30">
            <CardContent className="p-4 text-base text-red-700 dark:text-red-200">{errorMessage}</CardContent>
          </Card>
        ) : null}

        {showCardSkeleton ? (
          <div className={CARD_GRID_CLASS}>
            {Array.from({ length: pageSize }).map((_, index) => (
              <YouTubeHotVideoCard key={`refresh-skeleton-${index}`} loading />
            ))}
          </div>
        ) : null}

        {showEmptyState ? (
          <Card className="mt-2 border-zinc-200 bg-white/90 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80">
            <CardContent className="p-10 text-center text-zinc-500 dark:text-zinc-400">{t.emptyState}</CardContent>
          </Card>
        ) : null}

        {!showCardSkeleton && items.length > 0 ? (
          <div className={CARD_GRID_CLASS}>
            {items.map((item) => (
              <YouTubeHotVideoCard key={buildItemKey(item)} item={item} locale={locale} />
            ))}
            {isLoadingMore
              ? Array.from({ length: loadMoreSkeletonCount }).map((_, index) => (
                  <YouTubeHotVideoCard key={`load-more-skeleton-${index}`} loading />
                ))
              : null}
          </div>
        ) : null}

        {loadError ? (
          <Card className="mt-2 border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/30">
            <CardContent className="flex flex-wrap items-center gap-2 p-4">
              <span className="text-sm text-red-700 dark:text-red-200">{loadError}</span>
              <Button variant="outline" className="border-zinc-300 dark:border-zinc-700" onClick={() => void loadNextPageRef.current()}>
                {t.retryLoad}
              </Button>
            </CardContent>
          </Card>
        ) : null}

        <div ref={sentinelRef} className="mt-4 h-16 w-full" aria-hidden="true" />
      </section>
    </main>
  );
}
