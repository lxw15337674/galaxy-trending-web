'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { FilterCombobox } from '@/components/ui/filter-combobox';
import { YouTubeHotVideoCard } from '@/components/youtubehot/YouTubeHotVideoCard';
import type { Locale } from '@/i18n/config';
import { getMessages } from '@/i18n/messages';
import { createRegionDisplayNames } from '@/lib/youtube-hot/labels';
import {
  buildCategoryOptions,
  buildItemKey,
  buildRegionOptions,
  buildSortOptions,
  createRegionLabelFormatter,
  toRegionContext,
} from './youtube-hot-grid.shared';
import type { YouTubeHotInitialData } from './youtube-hot-grid.types';
import { useYouTubeHotGridController } from './useYouTubeHotGridController';

interface YouTubeHotGridPageProps {
  locale: Locale;
  userRegion?: string | null;
  jsonLd?: unknown;
  initialData: YouTubeHotInitialData;
}

const PAGE_SECTION_CLASS = 'mx-auto w-full px-4 pt-2 md:px-6 md:pt-6 lg:w-[80%]';
const CARD_GRID_CLASS = 'mt-2 grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4';

export function YouTubeHotGridPage({ locale, userRegion, jsonLd, initialData }: YouTubeHotGridPageProps) {
  const t = getMessages(locale).youtubeHot;
  const [isHydrated, setIsHydrated] = useState(false);
  const {
    activeCategory,
    activeRegion,
    activeSort,
    categories,
    dataLoading,
    errorMessage,
    isLoadingMore,
    items,
    loadError,
    loadMoreSkeletonCount,
    onCategoryChange,
    onRegionChange,
    onSortChange,
    pageSize,
    regions,
    retryLoadMore,
    sentinelRef,
  } = useYouTubeHotGridController({
    initialData,
    t,
  });

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const formatRegionLabel = useMemo(() => {
    const regionDisplayNames = isHydrated ? createRegionDisplayNames(locale) : null;
    return createRegionLabelFormatter(locale, regionDisplayNames);
  }, [isHydrated, locale]);

  const regionOptions = useMemo(
    () => buildRegionOptions(regions, t, formatRegionLabel, userRegion),
    [regions, t, formatRegionLabel, userRegion],
  );
  const categoryOptions = useMemo(() => buildCategoryOptions(categories, t, locale), [categories, t, locale]);
  const sortOptions = useMemo(() => buildSortOptions(t, toRegionContext(activeRegion)), [activeRegion, t]);

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

                <div className="w-full sm:w-[260px] xl:w-[300px]">
                  <FilterCombobox
                    options={sortOptions}
                    value={activeSort}
                    placeholder={t.filterSortSearchPlaceholder}
                    emptyText={t.filterNoMatch}
                    clearLabel={t.clearSearch}
                    onValueChange={onSortChange}
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
              <Button variant="outline" className="border-zinc-300 dark:border-zinc-700" onClick={() => void retryLoadMore()}>
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
