'use client';

import { startTransition, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { RankingFilterField } from '@/components/rankings/RankingFilterField';
import { type ComboboxOption } from '@/components/ui/combobox';
import { TwitchChartScaffold } from '@/components/twitch/TwitchChartScaffold';
import { TwitchStreamCard } from '@/components/twitch/TwitchStreamCard';
import type { Locale } from '@/i18n/config';
import { getIntlLocale } from '@/i18n/locale-meta';
import { getMessages } from '@/i18n/messages';
import {
  normalizeTwitchLiveCategory,
  normalizeTwitchLiveLanguage,
  normalizeTwitchLiveSort,
  type TwitchLivePageData,
} from '@/lib/twitch/page-data';

interface TwitchLiveGridPageProps {
  initialData: TwitchLivePageData;
  jsonLd?: unknown;
}

const CARD_GRID_CLASS = 'mt-2 grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4';

function createLanguageDisplayNames(locale: Locale) {
  try {
    return new Intl.DisplayNames([getIntlLocale(locale)], { type: 'language' });
  } catch {
    return null;
  }
}

function getLanguageLabel(code: string, locale: Locale, displayNames: Intl.DisplayNames | null) {
  const normalized = code.trim().toLowerCase();
  if (!normalized) return '--';
  const localized = displayNames?.of(normalized);
  if (localized && localized.toLowerCase() !== normalized) {
    return `${localized} (${normalized.toUpperCase()})`;
  }
  return normalized.toUpperCase();
}

export function TwitchLiveGridPage({ initialData, jsonLd }: TwitchLiveGridPageProps) {
  const t = getMessages(initialData.locale).twitchLive;
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const languageDisplayNames = useMemo(() => createLanguageDisplayNames(initialData.locale), [initialData.locale]);

  const activeLanguage = normalizeTwitchLiveLanguage(searchParams.get('language') ?? undefined);
  const activeCategory = normalizeTwitchLiveCategory(searchParams.get('category') ?? undefined);
  const activeSort = normalizeTwitchLiveSort(searchParams.get('sort') ?? undefined);

  const languageOptions: ComboboxOption[] = useMemo(
    () => [
      {
        value: 'all',
        label: t.allLanguages,
        keywords: ['all', t.allLanguages],
      },
      ...initialData.languages.map((item) => {
        const label = getLanguageLabel(item.label, initialData.locale, languageDisplayNames);
        return {
          value: item.value,
          label,
          keywords: [item.value, label],
        };
      }),
    ],
    [initialData.languages, initialData.locale, languageDisplayNames, t.allLanguages],
  );

  const categoryOptions: ComboboxOption[] = useMemo(
    () => [
      {
        value: 'all',
        label: t.allCategories,
        keywords: ['all', t.allCategories],
      },
      ...initialData.categories.map((item) => ({
        value: item.value,
        label: item.label,
        keywords: [item.value, item.label],
      })),
    ],
    [initialData.categories, t.allCategories],
  );

  const sortOptions: ComboboxOption[] = useMemo(
    () => [
      { value: 'viewers', label: t.sortViewers, keywords: ['viewers', t.sortViewers] },
      { value: 'started', label: t.sortStartedNewest, keywords: ['started', t.sortStartedNewest] },
    ],
    [t.sortStartedNewest, t.sortViewers],
  );

  const visibleItems = useMemo(() => {
    const filtered = initialData.items.filter((item) => {
      if (activeLanguage !== 'all' && item.language.trim().toLowerCase() !== activeLanguage) {
        return false;
      }
      if (activeCategory !== 'all' && item.gameId !== activeCategory) {
        return false;
      }
      return true;
    });

    return filtered.sort((left, right) => {
      if (activeSort === 'started') {
        return new Date(right.startedAt).valueOf() - new Date(left.startedAt).valueOf();
      }
      return right.viewerCount - left.viewerCount;
    });
  }, [activeCategory, activeLanguage, activeSort, initialData.items]);

  const updateQuery = (patch: Partial<Record<'language' | 'category' | 'sort', string>>) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (!value || value === 'all' || (key === 'sort' && value === 'viewers')) {
        nextParams.delete(key);
      } else {
        nextParams.set(key, value);
      }
    }
    const nextQuery = nextParams.toString();
    startTransition(() => {
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
    });
  };

  return (
    <TwitchChartScaffold
      locale={initialData.locale}
      chartType="live"
      fetchedAt={initialData.fetchedAt}
      errorMessage={initialData.errorMessage}
      jsonLd={jsonLd}
      t={t}
      filters={
        <div className="grid w-full grid-cols-1 gap-2 min-[360px]:grid-cols-2 lg:flex lg:w-auto lg:flex-wrap lg:items-end">
          <div className="w-full lg:w-[260px] xl:w-[300px]">
            <RankingFilterField
              label={t.filterLanguageLabel}
              options={languageOptions}
              value={activeLanguage}
              placeholder={t.filterLanguageSearchPlaceholder}
              emptyText={t.filterNoMatch}
              clearLabel={t.clearSearch}
              onValueChange={(value) => updateQuery({ language: value })}
            />
          </div>
          <div className="w-full lg:w-[260px] xl:w-[300px]">
            <RankingFilterField
              label={t.filterCategoryLabel}
              options={categoryOptions}
              value={activeCategory}
              placeholder={t.filterCategorySearchPlaceholder}
              emptyText={t.filterNoMatch}
              clearLabel={t.clearSearch}
              onValueChange={(value) => updateQuery({ category: value })}
            />
          </div>
          <div className="w-full lg:w-[220px] xl:w-[260px]">
            <RankingFilterField
              label={t.filterSortLabel}
              options={sortOptions}
              value={activeSort}
              placeholder={t.filterSortSearchPlaceholder}
              emptyText={t.filterNoMatch}
              clearLabel={t.clearSearch}
              onValueChange={(value) => updateQuery({ sort: value })}
            />
          </div>
        </div>
      }
    >
      {!initialData.errorMessage && visibleItems.length > 0 ? (
        <div className={CARD_GRID_CLASS}>
          {visibleItems.map((item, index) => (
            <TwitchStreamCard key={item.streamId} item={item} locale={initialData.locale} rank={index + 1} />
          ))}
        </div>
      ) : null}
    </TwitchChartScaffold>
  );
}
