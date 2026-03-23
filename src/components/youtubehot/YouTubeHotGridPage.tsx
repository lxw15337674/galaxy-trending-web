'use client';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { startTransition, useEffect, useMemo, useRef, useState } from 'react';
import { useInView } from 'react-intersection-observer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { SearchableCombobox, type SearchableComboboxOption } from '@/components/ui/searchable-combobox';
import { YouTubeHotVideoCard } from '@/components/youtubehot/YouTubeHotVideoCard';
import { YouTubeHotVideoCardSkeleton } from '@/components/youtubehot/YouTubeHotVideoCardSkeleton';
import { getMessages } from '@/i18n/messages';
import { createRegionDisplayNames, getLocalizedYouTubeRegionLabel, getYouTubeCategoryLabel } from '@/lib/youtube-hot/labels';
import type { YouTubeHotPageData } from '@/lib/youtube-hot/page-data';
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

function buildRegionOptions(
  regions: YouTubeRegion[],
  t: ReturnType<typeof getMessages>['youtubeHot'],
  formatRegionLabel: (region: YouTubeRegion) => string,
) {
  return [
    { value: 'all', label: t.allRegions },
    ...regions.map((item) => {
      const localizedLabel = formatRegionLabel(item);
      return {
        value: item.regionCode,
        label: localizedLabel,
        keywords: [item.regionCode, item.regionName, localizedLabel],
      };
    }),
  ] satisfies SearchableComboboxOption[];
}

function buildCategoryOptions(
  categories: YouTubeCategory[],
  t: ReturnType<typeof getMessages>['youtubeHot'],
  locale: YouTubeHotPageData['locale'],
) {
  return [
    { value: 'all', label: t.allCategories },
    ...categories.map((item) => {
      const categoryLabel = getYouTubeCategoryLabel(item.categoryId, item.categoryTitle, locale);
      return {
        value: item.categoryId,
        label: `${categoryLabel} (${item.categoryId})`,
        keywords: [item.categoryId, item.categoryTitle, categoryLabel],
      };
    }),
  ] satisfies SearchableComboboxOption[];
}

export function YouTubeHotGridPage({
  region,
  category,
  page,
  pageSize,
  total,
  totalPages,
  items,
  regions,
  categories,
  generatedAt,
  errorMessage,
  locale,
}: YouTubeHotPageData) {
  const t = getMessages(locale).youtubeHot;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isHydrated, setIsHydrated] = useState(false);
  const queryKey = `${region}|${category}|${pageSize}`;

  useEffect(() => {
    setIsHydrated(true);
  }, []);

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

  const regionOptions = useMemo(() => buildRegionOptions(regions, t, formatRegionLabel), [regions, t, formatRegionLabel]);
  const categoryOptions = useMemo(() => buildCategoryOptions(categories, t, locale), [categories, t, locale]);

  const [loadedItems, setLoadedItems] = useState(items);
  const [loadedPage, setLoadedPage] = useState(page);
  const [loadedTotal, setLoadedTotal] = useState(total);
  const [loadedTotalPages, setLoadedTotalPages] = useState(totalPages);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadedPageRef = useRef(page);
  const loadedTotalPagesRef = useRef(totalPages);
  const isRefreshingRef = useRef(false);
  const isLoadingMoreRef = useRef(false);
  const queryKeyRef = useRef(queryKey);
  const loadNextPageRef = useRef<() => Promise<void>>(async () => {});
  const { ref: sentinelRef, inView } = useInView({
    rootMargin: '320px 0px',
    threshold: 0,
  });

  const refreshSkeletonCount = Math.max(1, Math.min(loadedItems.length || pageSize, pageSize * 2));
  const remainingItemCount = Math.max(loadedTotal - loadedItems.length, 0);
  const loadMoreSkeletonCount = Math.min(pageSize, remainingItemCount);

  useEffect(() => {
    queryKeyRef.current = queryKey;
    loadedPageRef.current = page;
    loadedTotalPagesRef.current = totalPages;
    isRefreshingRef.current = false;
    isLoadingMoreRef.current = false;

    setLoadedItems(items);
    setLoadedPage(page);
    setLoadedTotal(total);
    setLoadedTotalPages(totalPages);
    setIsRefreshing(false);
    setIsLoadingMore(false);
    setLoadError(null);
  }, [queryKey, items, page, total, totalPages]);

  loadNextPageRef.current = async () => {
    if (isRefreshingRef.current || isLoadingMoreRef.current) return;

    const nextPage = loadedPageRef.current + 1;
    if (loadedTotalPagesRef.current === 0 || nextPage > loadedTotalPagesRef.current) return;

    const activeQueryKey = queryKey;
    const params = new URLSearchParams();
    if (region !== 'all') {
      params.set('region', region);
    }
    if (category !== 'all') {
      params.set('category', category);
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

      if (queryKeyRef.current !== activeQueryKey) return;
      if (!payload.pagination || !Array.isArray(payload.data)) {
        throw new Error(t.loadMoreFailed);
      }

      setLoadedItems((current) => mergeItems(current, payload.data ?? []));
      setLoadedPage(payload.pagination.page);
      setLoadedTotal(payload.pagination.total);
      setLoadedTotalPages(payload.pagination.totalPages);

      loadedPageRef.current = payload.pagination.page;
      loadedTotalPagesRef.current = payload.pagination.totalPages;
    } catch (error) {
      if (queryKeyRef.current === activeQueryKey) {
        setLoadError(error instanceof Error ? error.message : t.loadMoreFailed);
      }
    } finally {
      isLoadingMoreRef.current = false;
      if (queryKeyRef.current === activeQueryKey) {
        setIsLoadingMore(false);
      }
    }
  };

  useEffect(() => {
    if (!inView) return;
    if (isRefreshing || isLoadingMore) return;
    if (loadedTotalPages <= 1 || loadedPage >= loadedTotalPages) return;

    void loadNextPageRef.current();
  }, [inView, loadedPage, loadedTotalPages, isRefreshing, isLoadingMore]);

  const updateQuery = (patch: Partial<Record<'region' | 'category' | 'page', string>>) => {
    const next = new URLSearchParams(searchParams.toString());

    for (const [key, value] of Object.entries(patch)) {
      if (!value || (key !== 'page' && value === 'all') || (key === 'page' && value === '1')) {
        next.delete(key);
      } else {
        next.set(key, value);
      }
    }

    const nextQuery = next.toString();
    const currentQuery = searchParams.toString();
    if (nextQuery === currentQuery) return;

    setIsRefreshing(true);
    isRefreshingRef.current = true;
    setLoadError(null);

    startTransition(() => {
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname);
    });
  };

  const onRegionChange = (value: string) => {
    updateQuery({ region: value, page: '1' });
  };

  const onCategoryChange = (value: string) => {
    updateQuery({ category: value, page: '1' });
  };

  return (
    <main
      suppressHydrationWarning
      className="min-h-screen bg-gradient-to-b from-zinc-100 via-zinc-50 to-white pb-10 text-zinc-900 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 dark:text-zinc-100"
    >
      <section className="mx-auto w-full max-w-[1920px] px-4 pt-6 md:px-6 md:pt-8">
        <Card className="border-zinc-200 bg-white/90 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/85">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-3">
              <div className="grid w-full grid-cols-1 gap-3 min-[360px]:grid-cols-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:justify-end">
                <div className="w-full sm:w-[260px] xl:w-[300px]">
                  <SearchableCombobox
                    value={region}
                    placeholder={t.filterRegionPlaceholder}
                    searchPlaceholder={t.filterRegionSearchPlaceholder}
                    emptyText={t.filterNoMatch}
                    options={regionOptions}
                    onValueChange={onRegionChange}
                  />
                </div>

                <div className="w-full sm:w-[260px] xl:w-[300px]">
                  <SearchableCombobox
                    value={category}
                    placeholder={t.filterCategoryPlaceholder}
                    searchPlaceholder={t.filterCategorySearchPlaceholder}
                    emptyText={t.filterNoMatch}
                    options={categoryOptions}
                    onValueChange={onCategoryChange}
                  />
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        {errorMessage && !isRefreshing ? (
          <Card className="mt-4 border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/30">
            <CardContent className="p-4 text-base text-red-700 dark:text-red-200">{errorMessage}</CardContent>
          </Card>
        ) : null}

        {isRefreshing ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {Array.from({ length: refreshSkeletonCount }).map((_, index) => (
              <YouTubeHotVideoCardSkeleton key={`refresh-skeleton-${index}`} />
            ))}
          </div>
        ) : loadedItems.length === 0 ? (
          <Card className="mt-4 border-zinc-200 bg-white/90 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80">
            <CardContent className="p-10 text-center text-zinc-500 dark:text-zinc-400">{t.emptyState}</CardContent>
          </Card>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {loadedItems.map((item) => (
              <YouTubeHotVideoCard key={buildItemKey(item)} item={item} locale={locale} />
            ))}
            {isLoadingMore
              ? Array.from({ length: loadMoreSkeletonCount }).map((_, index) => (
                  <YouTubeHotVideoCardSkeleton key={`load-more-skeleton-${index}`} />
                ))
              : null}
          </div>
        )}

        {loadError ? (
          <Card className="mt-4 border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/30">
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
