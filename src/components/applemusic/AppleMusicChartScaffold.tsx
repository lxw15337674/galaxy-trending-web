'use client';

import type { ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { RankingFilterField } from '@/components/rankings/RankingFilterField';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { type ComboboxOption } from '@/components/ui/combobox';
import type { Locale } from '@/i18n/config';
import { formatRelativeUpdate } from '@/i18n/format';
import { normalizeAppleMusicCountryCode } from '@/lib/apple-music/countries';
import { getLocalizedAppleMusicCountryLabel } from '@/lib/apple-music/labels';
import type { AppleMusicCountryOption } from '@/lib/apple-music/types';
import { createRegionDisplayNames } from '@/lib/youtube-hot/labels';

interface AppleMusicChartScaffoldMessages {
  title: string;
  subtitle: string;
  updatedAtLabel: string;
  filterCountryLabel: string;
  filterCountrySearchPlaceholder: string;
  filterNoMatch: string;
  clearSearch: string;
  emptyState: string;
  openOfficialChart: string;
}

interface AppleMusicChartScaffoldProps {
  locale: Locale;
  t: AppleMusicChartScaffoldMessages;
  country: string;
  countries: AppleMusicCountryOption[];
  fetchedAt: string | null;
  sourceUrl: string;
  errorMessage?: string | null;
  jsonLd?: unknown;
  children?: ReactNode;
}

const PAGE_SECTION_CLASS = 'mx-auto w-full px-4 pt-6 md:px-6 md:pt-8 lg:w-[80%]';

export function AppleMusicChartScaffold({
  locale,
  t,
  country,
  countries,
  fetchedAt,
  sourceUrl,
  errorMessage,
  jsonLd,
  children,
}: AppleMusicChartScaffoldProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const regionDisplayNames = createRegionDisplayNames(locale);
  const countryOptions: ComboboxOption[] = countries.map((item) => {
    const label = getLocalizedAppleMusicCountryLabel(item.countryCode, item.countryName, locale, regionDisplayNames);
    return {
      value: item.countryCode,
      label,
      keywords: [item.countryCode, item.countryName, label],
    };
  });

  const updateCountry = (nextCountry: string) => {
    const normalizedCountry = normalizeAppleMusicCountryCode(nextCountry);
    const next = new URLSearchParams(searchParams.toString());
    if (normalizedCountry === 'global') {
      next.delete('country');
    } else {
      next.set('country', normalizedCountry);
    }
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-100 via-zinc-50 to-white pb-10 text-zinc-900 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 dark:text-zinc-100">
      {jsonLd ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} /> : null}
      <section className={PAGE_SECTION_CLASS}>
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 md:text-3xl">{t.title}</h1>
            <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{t.subtitle}</p>
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
