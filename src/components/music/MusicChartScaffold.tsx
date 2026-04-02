'use client';

import type { ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { RankingFilterField } from '@/components/rankings/RankingFilterField';
import { formatRelativeUpdate } from '@/i18n/format';
import { getMessages } from '@/i18n/messages';
import { createRegionDisplayNames } from '@/lib/youtube-hot/labels';
import { normalizeAppleMusicCountryCode } from '@/lib/apple-music/countries';
import { normalizeSpotifyCountryCode } from '@/lib/spotify/countries';
import { getLocalizedAppleMusicCountryLabel } from '@/lib/apple-music/labels';
import { getLocalizedSpotifyCountryLabel } from '@/lib/spotify/labels';
import type { MusicChartType, MusicPageData } from '@/lib/music/types';
import { MUSIC_CHART_TYPES } from '@/lib/music/types';

interface MusicChartScaffoldProps extends MusicPageData {
  children?: ReactNode;
  jsonLd?: unknown;
}

const PAGE_SECTION_CLASS = 'mx-auto w-full px-4 pt-6 md:px-6 md:pt-8 lg:w-[80%]';

export function MusicChartScaffold({
  locale,
  chartType,
  country,
  countries,
  fetchedAt,
  sourceUrl,
  errorMessage,
  jsonLd,
  children,
}: MusicChartScaffoldProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = getMessages(locale).music;
  const regionDisplayNames = createRegionDisplayNames(locale);

  const currentTypeLabel =
    MUSIC_CHART_TYPES.find((opt) => opt.value === chartType)?.labelKey
      ? t[MUSIC_CHART_TYPES.find((opt) => opt.value === chartType)!.labelKey]
      : t.chartSpotify;

  const updateChartType = (nextType: MusicChartType) => {
    if (nextType === chartType) {
      return;
    }

    const next = new URLSearchParams(searchParams.toString());
    if (nextType === 'spotify') {
      next.delete('type');
    } else {
      next.set('type', nextType);
    }
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const updateCountry = (nextCountry: string) => {
    let normalizedCountry: string;
    if (
      chartType === 'youtube-music-weekly' ||
      chartType === 'youtube-music-videos-daily' ||
      chartType === 'youtube-music-shorts-songs-daily'
    ) {
      normalizedCountry = !nextCountry || nextCountry.toLowerCase() === 'global' ? 'global' : nextCountry.toUpperCase();
    } else if (chartType === 'apple-music') {
      normalizedCountry = normalizeAppleMusicCountryCode(nextCountry);
    } else if (chartType === 'spotify') {
      normalizedCountry = normalizeSpotifyCountryCode(nextCountry);
    } else {
      normalizedCountry = nextCountry;
    }

    const next = new URLSearchParams(searchParams.toString());
    if (normalizedCountry === 'global') {
      next.delete('country');
    } else {
      next.set('country', normalizedCountry);
    }
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const countryOptions = (() => {
    if (
      chartType === 'youtube-music-weekly' ||
      chartType === 'youtube-music-videos-daily' ||
      chartType === 'youtube-music-shorts-songs-daily'
    ) {
      return countries.map((item) => ({
        value: item.countryCode,
        label:
          item.countryCode === 'global'
            ? t.cardGlobal
            : regionDisplayNames[item.countryCode.toLowerCase()] ?? item.countryName,
        keywords: [item.countryCode, item.countryName],
      }));
    } else if (chartType === 'apple-music') {
      return countries.map((item) => {
        const label = getLocalizedAppleMusicCountryLabel(item.countryCode, item.countryName, locale, regionDisplayNames);
        return {
          value: item.countryCode,
          label,
          keywords: [item.countryCode, item.countryName, label],
        };
      });
    } else if (chartType === 'spotify') {
      return countries.map((item) => {
        const label = getLocalizedSpotifyCountryLabel(item.countryCode, item.countryName, locale, regionDisplayNames);
        return {
          value: item.countryCode,
          label,
          keywords: [item.countryCode, item.countryName, label],
        };
      });
    }
    return [];
  })();

  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-100 via-zinc-50 to-white pb-10 text-zinc-900 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 dark:text-zinc-100">
      {jsonLd ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} /> : null}
      <h1 className="sr-only">{t.title}</h1>
      <section className={PAGE_SECTION_CLASS}>
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 md:text-3xl">{t.title}</h1>
            <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{t.description}</p>
          </div>
          {sourceUrl ? (
            <Button variant="outline" asChild className="w-full md:w-auto">
              <a href={sourceUrl} target="_blank" rel="noreferrer">
                {t.openOfficialChart}
              </a>
            </Button>
          ) : null}
        </div>

        <Card className="border-zinc-200 bg-white/90 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/85">
          <CardHeader className="p-2 md:p-3">
            <div className="flex flex-wrap items-end gap-2">
              <div className="w-full min-[360px]:w-[220px] sm:w-[240px]">
                <div className="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">{t.chartSelectorLabel}</div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="h-10 w-full justify-between">
                      <span className="truncate">{currentTypeLabel}</span>
                      <ChevronDown className="size-4 opacity-60" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="min-w-[220px]">
                    {MUSIC_CHART_TYPES.map((option) => {
                      const isActive = option.value === chartType;
                      return (
                        <DropdownMenuItem key={option.value} onClick={() => updateChartType(option.value)}>
                          <span>{t[option.labelKey]}</span>
                          {isActive ? <Check className="ml-auto size-4" /> : null}
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="w-full min-[360px]:w-[260px] xl:w-[300px]">
                <RankingFilterField
                  label={t.filterCountryLabel}
                  options={countryOptions}
                  value={country}
                  placeholder={t.filterCountrySearchPlaceholder}
                  emptyText={t.filterNoMatch}
                  clearLabel={t.clearSearch}
                  disabled={countryOptions.length === 0}
                  onValueChange={updateCountry}
                />
              </div>

              {fetchedAt ? (
                <span className="text-xs text-zinc-500 dark:text-zinc-400 sm:ml-auto sm:self-end">
                  {t.updatedAtLabel} {formatRelativeUpdate(fetchedAt, locale)}
                </span>
              ) : null}
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
            <CardContent className="p-10 text-center text-zinc-500 dark:text-zinc-400">{t.emptyState}</CardContent>
          </Card>
        ) : null}

        {children}
      </section>
    </main>
  );
}
