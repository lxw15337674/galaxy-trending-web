'use client';

import type { ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { type ComboboxOption } from '@/components/ui/combobox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { FilterCombobox } from '@/components/ui/filter-combobox';
import type { Locale } from '@/i18n/config';
import { formatRelativeUpdate } from '@/i18n/format';
import { getMessages } from '@/i18n/messages';
import { createRegionDisplayNames, getLocalizedYouTubeRegionLabel } from '@/lib/youtube-hot/labels';
import {
  YOUTUBE_MUSIC_GLOBAL_COUNTRY_CODE,
  type YouTubeMusicCountryOption,
} from '@/lib/youtube-music/types';

interface YouTubeMusicChartScaffoldCopy {
  title: string;
  updatedAtLabel: string;
  filterCountrySearchPlaceholder: string;
  filterNoMatch: string;
  clearSearch: string;
  emptyState: string;
  cardGlobal: string;
}

interface YouTubeMusicChartScaffoldProps {
  locale: Locale;
  copy: YouTubeMusicChartScaffoldCopy;
  country: string;
  countries: YouTubeMusicCountryOption[];
  fetchedAt: string;
  errorMessage?: string | null;
  jsonLd?: unknown;
  children?: ReactNode;
}

const PAGE_SECTION_CLASS = 'mx-auto w-full px-4 pt-6 md:px-6 md:pt-8 lg:w-[80%]';

export function YouTubeMusicChartScaffold({
  locale,
  copy,
  country,
  countries,
  fetchedAt,
  errorMessage,
  jsonLd,
  children,
}: YouTubeMusicChartScaffoldProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const baseMusicCopy = getMessages(locale).youtubeMusic;
  const regionDisplayNames = createRegionDisplayNames(locale);
  const countryOptions: ComboboxOption[] = [
    {
      value: YOUTUBE_MUSIC_GLOBAL_COUNTRY_CODE,
      label: copy.cardGlobal,
      keywords: [YOUTUBE_MUSIC_GLOBAL_COUNTRY_CODE, copy.cardGlobal],
    },
    ...countries
      .filter((item) => item.countryCode !== YOUTUBE_MUSIC_GLOBAL_COUNTRY_CODE)
      .map((item) => ({
        value: item.countryCode,
        label: getLocalizedYouTubeRegionLabel(item.countryCode, item.countryName, locale, regionDisplayNames),
        keywords: [item.countryCode, item.countryName],
      })),
  ];

  const updateCountry = (nextCountry: string) => {
    const next = new URLSearchParams(searchParams.toString());
    if (!nextCountry || nextCountry === YOUTUBE_MUSIC_GLOBAL_COUNTRY_CODE) {
      next.delete('country');
    } else {
      next.set('country', nextCountry);
    }
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const chartOptions = [
    { value: `/${locale}/youtube-music`, label: baseMusicCopy.tabTopSongs },
    { value: `/${locale}/youtube-music/videos-daily`, label: baseMusicCopy.tabVideosDaily },
    { value: `/${locale}/youtube-music/shorts-songs-daily`, label: baseMusicCopy.tabShortsDaily },
  ];

  const currentChartPath =
    chartOptions.find((option) => pathname === option.value || pathname?.startsWith(`${option.value}/`))?.value ??
    `/${locale}/youtube-music`;

  const updateChart = (nextPath: string) => {
    const query = searchParams.toString();
    router.replace(query ? `${nextPath}?${query}` : nextPath, { scroll: false });
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-100 via-zinc-50 to-white pb-10 text-zinc-900 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 dark:text-zinc-100">
      {jsonLd ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} /> : null}
      <h1 className="sr-only">{copy.title}</h1>
      <section className={PAGE_SECTION_CLASS}>
        <Card className="border-zinc-200 bg-white/90 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/85">
          <CardHeader className="p-2 md:p-3">
            <div className="flex flex-nowrap items-center gap-2 overflow-x-auto">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-10 min-w-[170px] justify-between">
                    <span className="truncate">
                      {chartOptions.find((option) => option.value === currentChartPath)?.label ?? baseMusicCopy.tabTopSongs}
                    </span>
                    <ChevronDown className="size-4 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-[170px]">
                  {chartOptions.map((option) => {
                    const isActive = option.value === currentChartPath;
                    return (
                      <DropdownMenuItem key={option.value} onClick={() => updateChart(option.value)}>
                        <span>{option.label}</span>
                        {isActive ? <Check className="ml-auto size-4" /> : null}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>

              <div className="w-[260px] min-w-[260px] xl:w-[300px] xl:min-w-[300px]">
                <FilterCombobox
                  options={countryOptions}
                  value={country}
                  placeholder={copy.filterCountrySearchPlaceholder}
                  emptyText={copy.filterNoMatch}
                  clearLabel={copy.clearSearch}
                  onValueChange={updateCountry}
                />
              </div>

              <span className="ml-auto shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
                {copy.updatedAtLabel} {formatRelativeUpdate(fetchedAt, locale)}
              </span>
            </div>
          </CardHeader>
          <CardContent className="hidden" />
        </Card>

        {errorMessage ? (
          <Card className="mt-2 border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/30">
            <CardContent className="p-4 text-base text-red-700 dark:text-red-200">{errorMessage}</CardContent>
          </Card>
        ) : null}

        {!errorMessage && !children ? (
          <Card className="mt-2 border-zinc-200 bg-white/90 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80">
            <CardContent className="p-10 text-center text-zinc-500 dark:text-zinc-400">{copy.emptyState}</CardContent>
          </Card>
        ) : null}

        {children}
      </section>
    </main>
  );
}
