'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { type ComboboxOption } from '@/components/ui/combobox';
import { FilterCombobox } from '@/components/ui/filter-combobox';
import { YouTubeLiveVideoCard } from '@/components/youtubehot/YouTubeLiveVideoCard';
import type { Locale } from '@/i18n/config';
import { getMessages } from '@/i18n/messages';
import { YouTubeLiveItem } from '@/lib/youtube-hot/types';
import { getYouTubeCategoryLabel } from '@/lib/youtube-hot/labels';

interface YouTubeLiveGridPageProps {
  items: YouTubeLiveItem[];
  fetchedAt: string;
  errorMessage?: string | null;
  locale: Locale;
  jsonLd?: unknown;
}

const PAGE_SECTION_CLASS = 'mx-auto w-full px-4 pt-2 md:px-6 md:pt-6 lg:w-[80%]';
const CARD_GRID_CLASS = 'mt-2 grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4';

function normalizeLanguageCode(value: string | null | undefined) {
  if (!value) return '';
  const normalized = value.trim().replace(/_/g, '-');
  if (!normalized) return '';
  try {
    return new Intl.Locale(normalized).toString();
  } catch {
    return normalized;
  }
}

function normalizeFilterValue(value: string | null | undefined) {
  const normalized = value?.trim() ?? '';
  return normalized ? normalized : 'all';
}

function formatLanguageDisplayText(normalized: string, localizedLabel: string | null | undefined) {
  const label = (localizedLabel ?? '').trim();
  if (!label || label === normalized) {
    return normalized;
  }
  return `${label} (${normalized})`;
}

export function YouTubeLiveGridPage({
  items,
  fetchedAt,
  errorMessage,
  locale,
  jsonLd,
}: YouTubeLiveGridPageProps) {
  const t = getMessages(locale).youtubeLive;
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isHydrated, setIsHydrated] = useState(false);
  const [requestedLanguage, setRequestedLanguage] = useState(() => normalizeFilterValue(searchParams.get('language')));
  const [requestedCategory, setRequestedCategory] = useState(() => normalizeFilterValue(searchParams.get('category')));

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    const nextLanguage = normalizeFilterValue(searchParams.get('language'));
    const nextCategory = normalizeFilterValue(searchParams.get('category'));
    setRequestedLanguage((current) => (current === nextLanguage ? current : nextLanguage));
    setRequestedCategory((current) => (current === nextCategory ? current : nextCategory));
  }, [searchParams]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const syncFromLocation = () => {
      const params = new URLSearchParams(window.location.search);
      setRequestedLanguage(normalizeFilterValue(params.get('language')));
      setRequestedCategory(normalizeFilterValue(params.get('category')));
    };

    window.addEventListener('popstate', syncFromLocation);
    return () => {
      window.removeEventListener('popstate', syncFromLocation);
    };
  }, []);

  const formatLanguageLabel = useMemo(() => {
    if (!isHydrated) {
      return (value: string | null | undefined) => {
        const normalized = normalizeLanguageCode(value);
        if (!normalized) return '--';
        return normalized;
      };
    }

    let localizedDisplay: Intl.DisplayNames | null = null;
    let englishDisplay: Intl.DisplayNames | null = null;
    const displayLocale = locale === 'en' ? 'en' : 'zh-CN';

    try {
      localizedDisplay = new Intl.DisplayNames([displayLocale], { type: 'language' });
    } catch {
      localizedDisplay = null;
    }

    try {
      englishDisplay = new Intl.DisplayNames(['en'], { type: 'language' });
    } catch {
      englishDisplay = null;
    }

    const cache = new Map<string, string>();
    return (value: string | null | undefined) => {
      const normalized = normalizeLanguageCode(value);
      if (!normalized) return '--';

      const hit = cache.get(normalized);
      if (hit) return hit;

      let label = localizedDisplay?.of(normalized) ?? '';
      if (!label || label === normalized) {
        label = englishDisplay?.of(normalized) ?? '';
      }
      if (!label || label === normalized) {
        label = normalized;
      }

      const output = formatLanguageDisplayText(normalized, label);
      cache.set(normalized, output);
      return output;
    };
  }, [isHydrated, locale]);

  const formatCategoryLabel = useMemo(() => {
    return (item: Pick<YouTubeLiveItem, 'categoryId' | 'categoryTitle'>) =>
      getYouTubeCategoryLabel(item.categoryId, item.categoryTitle, locale);
  }, [locale]);

  const languageOptions = useMemo(() => {
    const counter = new Map<string, number>();

    for (const item of items) {
      const normalized = normalizeLanguageCode(item.defaultAudioLanguage);
      if (!normalized) continue;
      counter.set(normalized, (counter.get(normalized) ?? 0) + 1);
    }

    return Array.from(counter.entries())
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));
  }, [items]);

  const languageFilterOptions = useMemo<ComboboxOption[]>(
    () => [
      { value: 'all', label: t.allLanguages },
      ...languageOptions.map((option) => ({
        value: option.code,
        label: `${formatLanguageLabel(option.code)} (${option.count})`,
        keywords: [option.code],
      })),
    ],
    [languageOptions, formatLanguageLabel, t.allLanguages],
  );

  const categoryOptions = useMemo(() => {
    const counter = new Map<string, { count: number; categoryId: string | null; categoryTitle: string | null }>();

    for (const item of items) {
      const key = item.categoryId?.trim() || 'uncategorized';
      const current = counter.get(key);
      if (current) {
        current.count += 1;
        continue;
      }

      counter.set(key, {
        count: 1,
        categoryId: item.categoryId,
        categoryTitle: item.categoryTitle,
      });
    }

    return Array.from(counter.values()).sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return (a.categoryId ?? '').localeCompare(b.categoryId ?? '');
    });
  }, [items]);

  const categoryFilterOptions = useMemo<ComboboxOption[]>(
    () => [
      { value: 'all', label: t.allCategories },
      ...categoryOptions.map((option) => {
        const categoryLabel = formatCategoryLabel(option);
        return {
          value: option.categoryId?.trim() || 'uncategorized',
          label: `${categoryLabel} (${option.count})`,
          keywords: [option.categoryId ?? '', option.categoryTitle ?? '', categoryLabel],
        };
      }),
    ],
    [categoryOptions, formatCategoryLabel, t.allCategories],
  );

  const activeLanguageFilter = languageFilterOptions.some((option) => option.value === requestedLanguage)
    ? requestedLanguage
    : 'all';
  const activeCategoryFilter = categoryFilterOptions.some((option) => option.value === requestedCategory)
    ? requestedCategory
    : 'all';

  const updateFilter = (key: 'language' | 'category', value: string) => {
    const currentSearch = typeof window !== 'undefined' ? window.location.search : searchParams.toString();
    const next = new URLSearchParams(currentSearch);
    if (value === 'all') {
      next.delete(key);
    } else {
      next.set(key, value);
    }

    const nextQuery = next.toString();
    const currentQuery = currentSearch.startsWith('?') ? currentSearch.slice(1) : currentSearch;
    if (nextQuery === currentQuery) return;

    const nextLanguage = normalizeFilterValue(next.get('language'));
    const nextCategory = normalizeFilterValue(next.get('category'));
    setRequestedLanguage(nextLanguage);
    setRequestedCategory(nextCategory);

    if (typeof window !== 'undefined') {
      const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname;
      window.history.replaceState(window.history.state, '', nextUrl);
    }
  };

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const audioLanguage = normalizeLanguageCode(item.defaultAudioLanguage);
      const itemCategory = item.categoryId?.trim() || 'uncategorized';
      const matchesLanguage = activeLanguageFilter === 'all' || audioLanguage === activeLanguageFilter;
      const matchesCategory = activeCategoryFilter === 'all' || itemCategory === activeCategoryFilter;
      return matchesLanguage && matchesCategory;
    });
  }, [items, activeLanguageFilter, activeCategoryFilter]);

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
                    options={languageFilterOptions}
                    value={activeLanguageFilter}
                    placeholder={t.filterLanguageSearchPlaceholder}
                    emptyText={t.filterNoMatch}
                    clearLabel={t.clearSearch}
                    onValueChange={(nextValue) => updateFilter('language', nextValue)}
                  />
                </div>
                <div className="w-full sm:w-[260px] xl:w-[300px]">
                  <FilterCombobox
                    options={categoryFilterOptions}
                    value={activeCategoryFilter}
                    placeholder={t.filterCategorySearchPlaceholder}
                    emptyText={t.filterNoMatch}
                    clearLabel={t.clearSearch}
                    onValueChange={(nextValue) => updateFilter('category', nextValue)}
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

        {!errorMessage && filteredItems.length === 0 ? (
          <Card className="mt-2 border-zinc-200 bg-white/90 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80">
            <CardContent className="p-10 text-center text-zinc-500 dark:text-zinc-400">
              {t.emptyState}
            </CardContent>
          </Card>
        ) : null}

        {filteredItems.length > 0 ? (
          <div className={CARD_GRID_CLASS}>
            {filteredItems.map((item) => (
              <YouTubeLiveVideoCard
                key={item.videoId}
                item={item}
                locale={locale}
                categoryLabel={formatCategoryLabel(item)}
                languageLabel={formatLanguageLabel(item.defaultAudioLanguage)}
              />
            ))}
          </div>
        ) : null}
      </section>
    </main>
  );
}
