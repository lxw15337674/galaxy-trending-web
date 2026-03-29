'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { startTransition, useCallback, useEffect, useRef, useState } from 'react';
import { useInView } from 'react-intersection-observer';
import { getMessages } from '@/i18n/messages';
import { normalizeYouTubeHotSort, type YouTubeCategory, type YouTubeHotQueryItem, type YouTubeRegion } from '@/lib/youtube-hot/types';
import { DEFAULT_PAGE_SIZE, mergeItems, normalizeFilterValue, toRegionContext } from './youtube-hot-grid.shared';
import type { YouTubeHotFiltersResponse, YouTubeHotHistoryResponse, YouTubeHotInitialData } from './youtube-hot-grid.types';

type YouTubeHotMessages = ReturnType<typeof getMessages>['youtubeHot'];

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

interface UseYouTubeHotGridControllerParams {
  initialData: YouTubeHotInitialData;
  t: YouTubeHotMessages;
}

export function useYouTubeHotGridController({ initialData, t }: UseYouTubeHotGridControllerParams) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [regions, setRegions] = useState<YouTubeRegion[]>(initialData.regions);
  const [categories, setCategories] = useState<YouTubeCategory[]>(initialData.categories);
  const [filtersRegion, setFiltersRegion] = useState(initialData.region);
  const [items, setItems] = useState<YouTubeHotQueryItem[]>(initialData.items);
  const [page, setPage] = useState(initialData.page);
  const [pageSize, setPageSize] = useState(initialData.pageSize || DEFAULT_PAGE_SIZE);
  const [total, setTotal] = useState(initialData.total);
  const [totalPages, setTotalPages] = useState(initialData.totalPages);
  const [, setGeneratedAt] = useState<string | null>(initialData.generatedAt ?? null);
  const [filtersLoading, setFiltersLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(initialData.errorMessage ?? null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const requestIdRef = useRef(0);
  const filtersReadyRef = useRef(true);
  const loadedPageRef = useRef(initialData.page);
  const loadedTotalPagesRef = useRef(initialData.totalPages);
  const isLoadingMoreRef = useRef(false);
  const latestQueryKeyRef = useRef(
    `${initialData.region}|${initialData.category}|${initialData.sort}|${initialData.pageSize || DEFAULT_PAGE_SIZE}`,
  );
  const skipFetchQueryRef = useRef<string | null>(
    `${initialData.region}|${initialData.category}|${initialData.sort}|${initialData.pageSize || DEFAULT_PAGE_SIZE}`,
  );
  const loadNextPageRef = useRef<() => Promise<void>>(async () => {});
  const { ref: sentinelRef, inView } = useInView({
    rootMargin: '320px 0px',
    threshold: 0,
  });

  const requestedRegion = normalizeFilterValue(searchParams.get('region') ?? initialData.region);
  const requestedCategory = normalizeFilterValue(searchParams.get('category') ?? initialData.category);
  const requestedSort = normalizeYouTubeHotSort(
    searchParams.get('sort') ?? initialData.sort,
    toRegionContext(requestedRegion),
  );

  useEffect(() => {
    const cacheKey = initialData.region === 'all' ? 'all' : initialData.region;
    cachedFiltersByRegion.set(cacheKey, {
      regions: initialData.regions,
      categories: initialData.categories,
    });

    requestIdRef.current += 1;
    filtersReadyRef.current = true;
    loadedPageRef.current = initialData.page;
    loadedTotalPagesRef.current = initialData.totalPages;
    isLoadingMoreRef.current = false;
    latestQueryKeyRef.current =
      `${initialData.region}|${initialData.category}|${initialData.sort}|${initialData.pageSize || DEFAULT_PAGE_SIZE}`;
    skipFetchQueryRef.current =
      `${initialData.region}|${initialData.category}|${initialData.sort}|${initialData.pageSize || DEFAULT_PAGE_SIZE}`;

    setRegions(initialData.regions);
    setCategories(initialData.categories);
    setFiltersRegion(initialData.region);
    setItems(initialData.items);
    setPage(initialData.page);
    setPageSize(initialData.pageSize || DEFAULT_PAGE_SIZE);
    setTotal(initialData.total);
    setTotalPages(initialData.totalPages);
    setGeneratedAt(initialData.generatedAt ?? null);
    setFiltersLoading(false);
    setDataLoading(false);
    setIsLoadingMore(false);
    setErrorMessage(initialData.errorMessage ?? null);
    setLoadError(null);
  }, [initialData]);

  const activeRegion = regions.some((item) => item.regionCode === requestedRegion) ? requestedRegion : 'all';
  const activeCategory = categories.some((item) => item.categoryId === requestedCategory) ? requestedCategory : 'all';
  const activeSort = normalizeYouTubeHotSort(requestedSort, toRegionContext(activeRegion));
  const queryKey = `${activeRegion}|${activeCategory}|${activeSort}|${pageSize}`;

  const updateQuery = useCallback(
    (patch: Partial<Record<'region' | 'category' | 'sort' | 'page', string>>) => {
      const currentSearch = searchParams.toString();
      const next = new URLSearchParams(currentSearch);

      for (const [key, value] of Object.entries(patch)) {
        if (!value || (key !== 'page' && value === 'all') || (key === 'page' && value === '1')) {
          next.delete(key);
        } else {
          next.set(key, value);
        }
      }

      const nextQuery = next.toString();
      if (nextQuery === currentSearch) return;

      setLoadError(null);
      setDataLoading(true);
      startTransition(() => {
        const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname;
        router.replace(nextUrl, { scroll: false });
      });
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    latestQueryKeyRef.current = queryKey;
  }, [queryKey]);

  useEffect(() => {
    let cancelled = false;

    async function loadFilters() {
      const regionKey = requestedRegion === 'all' ? 'all' : requestedRegion;
      filtersReadyRef.current = false;
      setFiltersLoading(!cachedFiltersByRegion.get(regionKey));
      setErrorMessage(null);

      try {
        const nextFilters = await fetchYouTubeHotFilters(requestedRegion);
        if (cancelled) return;
        setRegions(nextFilters.regions);
        setCategories(nextFilters.categories);
        setFiltersRegion(requestedRegion);
        filtersReadyRef.current = true;
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof Error ? error.message : t.errorLoad);
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
    if (filtersRegion !== requestedRegion) return;
    if (requestedCategory === 'all') return;
    if (categories.some((item) => item.categoryId === requestedCategory)) return;

    updateQuery({ category: 'all', page: '1' });
  }, [categories, filtersLoading, filtersRegion, requestedCategory, requestedRegion, updateQuery]);

  useEffect(() => {
    if (filtersLoading) return;
    if (filtersRegion !== requestedRegion) {
      setDataLoading(false);
      return;
    }
    if (!filtersReadyRef.current) {
      setDataLoading(false);
      return;
    }

    if (skipFetchQueryRef.current === queryKey) {
      skipFetchQueryRef.current = null;
      setDataLoading(false);
      setLoadError(null);
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
    params.set('sort', activeSort);
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
  }, [activeCategory, activeRegion, activeSort, filtersLoading, filtersRegion, pageSize, queryKey, requestedRegion, t.errorLoad]);

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
    params.set('sort', activeSort);
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

      if (activeQueryKey !== latestQueryKeyRef.current) return;

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

  return {
    activeCategory,
    activeRegion,
    activeSort,
    categories,
    dataLoading,
    errorMessage,
    filtersLoading,
    items,
    loadError,
    loadMoreSkeletonCount: Math.min(pageSize, Math.max(total - items.length, 0)),
    onCategoryChange: (value: string) => updateQuery({ category: value, page: '1' }),
    onRegionChange: (value: string) => {
      const nextSort = normalizeYouTubeHotSort(requestedSort, toRegionContext(value));
      updateQuery({ region: value, sort: nextSort, page: '1' });
    },
    onSortChange: (value: string) => updateQuery({ sort: value, page: '1' }),
    page,
    pageSize,
    regions,
    retryLoadMore: () => loadNextPageRef.current(),
    sentinelRef,
    totalPages,
    isLoadingMore,
  };
}
