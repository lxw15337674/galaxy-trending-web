'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { startTransition, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { type ComboboxOption } from '@/components/ui/combobox';
import { FilterCombobox } from '@/components/ui/filter-combobox';
import { TikTokVideoCard } from '@/components/tiktokvideos/TikTokVideoCard';
import { formatRelativeUpdate } from '@/i18n/format';
import { getMessages } from '@/i18n/messages';
import { prioritizePreferredItem } from '@/lib/filters/prioritize-preferred-item';
import { createRegionDisplayNames, getLocalizedYouTubeRegionLabel } from '@/lib/youtube-hot/labels';
import type { TikTokVideoPageData } from '@/lib/tiktok-videos/page-data';
import { TIKTOK_VIDEO_ORDER_OPTIONS, TIKTOK_VIDEO_PERIOD_OPTIONS, type TikTokVideoOrderBy } from '@/lib/tiktok-videos/types';

interface TikTokVideoGridPageProps {
  initialData: TikTokVideoPageData;
  userCountry?: string | null;
}

const PAGE_SECTION_CLASS = 'mx-auto w-full px-4 pt-2 md:px-6 md:pt-6 lg:w-[80%]';
const CARD_GRID_CLASS = 'mt-2 grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4';

function buildCountryOptions(
  countries: TikTokVideoPageData['countries'],
  userCountry: string | null | undefined,
  locale: TikTokVideoPageData['locale'],
) {
  const sortedCountries = prioritizePreferredItem(countries, (item) => item.countryCode, userCountry?.toUpperCase());
  const regionDisplayNames = createRegionDisplayNames(locale);
  return sortedCountries.map((country) => ({
    value: country.countryCode,
    label: getLocalizedYouTubeRegionLabel(country.countryCode, country.countryName, locale, regionDisplayNames),
    keywords: [country.countryCode, country.countryName],
  })) satisfies ComboboxOption[];
}

function getPeriodLabel(period: number, t: ReturnType<typeof getMessages>['tiktokVideos']) {
  return period === 30 ? t.periodLast30Days : t.periodLast7Days;
}

function getSortLabel(orderBy: TikTokVideoOrderBy, t: ReturnType<typeof getMessages>['tiktokVideos']) {
  switch (orderBy) {
    case 'like':
      return t.sortLike;
    case 'comment':
      return t.sortComments;
    case 'repost':
      return t.sortShares;
    default:
      return t.sortHot;
  }
}

function buildPeriodOptions(
  scopes: TikTokVideoPageData['scopes'],
  t: ReturnType<typeof getMessages>['tiktokVideos'],
) {
  const availablePeriods = new Set(scopes.map((scope) => scope.period));
  return TIKTOK_VIDEO_PERIOD_OPTIONS.filter((period) => availablePeriods.has(period)).map((period) => ({
    value: String(period),
    label: getPeriodLabel(period, t),
    keywords: [String(period), getPeriodLabel(period, t)],
  })) satisfies ComboboxOption[];
}

function buildSortOptions(
  scopes: TikTokVideoPageData['scopes'],
  period: number,
  t: ReturnType<typeof getMessages>['tiktokVideos'],
) {
  const availableSorts = new Set(scopes.filter((scope) => scope.period === period).map((scope) => scope.orderBy));
  return TIKTOK_VIDEO_ORDER_OPTIONS.filter((orderBy) => availableSorts.has(orderBy)).map((orderBy) => ({
    value: orderBy,
    label: getSortLabel(orderBy, t),
    keywords: [orderBy, getSortLabel(orderBy, t)],
  })) satisfies ComboboxOption[];
}

function CompactLabel({ children }: { children: string }) {
  return <div className="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">{children}</div>;
}

function FilterField({
  label,
  options,
  value,
  placeholder,
  emptyText,
  clearLabel,
  disabled = false,
  onValueChange,
}: {
  label: string;
  options: readonly ComboboxOption[];
  value: string;
  placeholder: string;
  emptyText: string;
  clearLabel?: string;
  disabled?: boolean;
  onValueChange: (value: string) => void;
}) {
  return (
    <div className="w-full">
      <CompactLabel>{label}</CompactLabel>
      <FilterCombobox
        options={options}
        value={value}
        placeholder={placeholder}
        emptyText={emptyText}
        clearLabel={clearLabel}
        disabled={disabled}
        onValueChange={onValueChange}
      />
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-zinc-400 dark:text-zinc-500">{label}</span>
      <span className="text-zinc-600 dark:text-zinc-300">{value}</span>
    </span>
  );
}

function SummaryDivider() {
  return <span className="text-zinc-300 dark:text-zinc-700">·</span>;
}

export function TikTokVideoGridPage({ initialData, userCountry }: TikTokVideoGridPageProps) {
  const t = getMessages(initialData.locale).tiktokVideos;
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedCountry, setSelectedCountry] = useState(initialData.focusCountry);
  const regionDisplayNames = createRegionDisplayNames(initialData.locale);
  const countryOptions = buildCountryOptions(initialData.countries, userCountry, initialData.locale);
  const periodOptions = useMemo(() => buildPeriodOptions(initialData.scopes, t), [initialData.scopes, t]);
  const sortOptions = useMemo(() => buildSortOptions(initialData.scopes, initialData.period, t), [initialData.period, initialData.scopes, t]);
  const localizedCountryName = getLocalizedYouTubeRegionLabel(
    initialData.focusCountry,
    initialData.countryName ?? initialData.focusCountry,
    initialData.locale,
    regionDisplayNames,
  );

  useEffect(() => {
    setSelectedCountry(initialData.focusCountry);
  }, [initialData.focusCountry]);

  const updateQuery = (patch: Partial<Record<'country' | 'period' | 'sort', string>>) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (!value) continue;
      nextParams.set(key, value);
    }
    const nextQuery = nextParams.toString();
    startTransition(() => {
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
    });
  };

  const onCountryChange = (value: string) => {
    const nextCountry = value.trim().toUpperCase();
    if (!nextCountry || nextCountry === selectedCountry) return;
    setSelectedCountry(nextCountry);
    updateQuery({ country: nextCountry });
  };

  const onPeriodChange = (period: number) => {
    if (period === initialData.period) return;
    updateQuery({ period: String(period) });
  };

  const onSortChange = (orderBy: TikTokVideoOrderBy) => {
    if (orderBy === initialData.orderBy) return;
    updateQuery({ sort: orderBy });
  };

  return (
    <main
      suppressHydrationWarning
      className="min-h-screen bg-gradient-to-b from-zinc-100 via-zinc-50 to-white pb-10 text-zinc-950 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 dark:text-zinc-100"
    >
      <h1 className="sr-only">{t.title}</h1>

      <section className={PAGE_SECTION_CLASS}>
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-rose-600 dark:text-rose-300">
              TikTok Creative Center
            </div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 md:text-3xl">
              {t.title}
            </h2>
            <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{t.subtitle}</p>
          </div>
          <a
            href={initialData.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:border-zinc-300 hover:text-zinc-950 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-700"
          >
            {t.openOfficialSource}
          </a>
        </div>

        <Card className="mt-3 border-zinc-200 bg-white/90 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/85">
          <CardHeader className="p-2 md:p-3">
            <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2 xl:grid-cols-3">
              <FilterField
                label={t.filterCountryLabel}
                options={countryOptions}
                value={selectedCountry}
                placeholder={t.filterCountrySearchPlaceholder}
                emptyText={t.filterNoMatch}
                clearLabel={t.clearSearch}
                disabled={countryOptions.length === 0}
                onValueChange={onCountryChange}
              />
              <FilterField
                label={t.periodFilterLabel}
                options={periodOptions}
                value={String(initialData.period)}
                placeholder={t.periodFilterLabel}
                emptyText={t.filterNoMatch}
                clearLabel={t.clearSearch}
                disabled={periodOptions.length === 0}
                onValueChange={(value) => onPeriodChange(Number(value))}
              />
              <FilterField
                label={t.sortFilterLabel}
                options={sortOptions}
                value={initialData.orderBy}
                placeholder={t.sortFilterLabel}
                emptyText={t.filterNoMatch}
                clearLabel={t.clearSearch}
                disabled={sortOptions.length === 0}
                onValueChange={onSortChange}
              />
            </div>
          </CardHeader>
        </Card>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
          <SummaryItem label={t.currentCountryLabel} value={localizedCountryName} />
          <SummaryDivider />
          <SummaryItem label={t.currentPeriodLabel} value={getPeriodLabel(initialData.period, t)} />
          <SummaryDivider />
          <SummaryItem label={t.currentSortLabel} value={getSortLabel(initialData.orderBy, t)} />
          <SummaryDivider />
          <SummaryItem label={t.itemsLabel} value={String(initialData.items.length)} />
          <SummaryDivider />
          <SummaryItem label={t.updatedAtLabel} value={formatRelativeUpdate(initialData.generatedAt, initialData.locale)} />
        </div>

        {initialData.errorMessage ? (
          <Card className="mt-2 border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/30">
            <CardContent className="p-4 text-base text-red-700 dark:text-red-200">{initialData.errorMessage}</CardContent>
          </Card>
        ) : null}

        {!initialData.errorMessage && initialData.items.length === 0 ? (
          <Card className="mt-2 border-zinc-200 bg-white/90 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/70">
            <CardContent className="p-10 text-center text-zinc-500 dark:text-zinc-400">{t.emptyState}</CardContent>
          </Card>
        ) : null}

        {initialData.items.length > 0 ? (
          <div className={CARD_GRID_CLASS}>
            {initialData.items.map((item) => (
              <TikTokVideoCard
                key={`${item.snapshotHour}-${item.countryCode}-${item.period}-${item.orderBy}-${item.rank}-${item.videoId}`}
                item={item}
                locale={initialData.locale}
              />
            ))}
          </div>
        ) : null}
      </section>
    </main>
  );
}
