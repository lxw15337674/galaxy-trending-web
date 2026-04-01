'use client';

import { AppStoreGameChartScaffold } from '@/components/appstoregames/AppStoreGameChartScaffold';
import { AppStoreGameListRow } from '@/components/appstoregames/AppStoreGameListRow';
import type { Locale } from '@/i18n/config';
import { getMessages } from '@/i18n/messages';
import { getLocalizedAppStoreGameCountryLabel } from '@/lib/app-store-games/labels';
import type { AppStoreGamesPageSection } from '@/lib/app-store-games/page-data';
import type { AppStoreGameCountryOption } from '@/lib/app-store-games/types';
import { createRegionDisplayNames } from '@/lib/youtube-hot/labels';

interface AppStoreGameGridPageProps {
  country: string;
  countryName: string;
  countries: AppStoreGameCountryOption[];
  sections: AppStoreGamesPageSection[];
  fetchedAt: string | null;
  sourceUrl: string;
  errorMessage?: string | null;
  locale: Locale;
  jsonLd?: unknown;
}

function AppStoreGameChartSection({
  section,
  locale,
}: {
  section: AppStoreGamesPageSection;
  locale: Locale;
}) {
  const t = getMessages(locale).appStoreGames;

  return (
    <section className="overflow-hidden rounded-[20px] border border-white/8 bg-[#131418] shadow-[0_16px_56px_rgba(0,0,0,0.28)]">
      <header className="flex items-center justify-between gap-3 border-b border-white/6 px-3 py-2">
        <div className="min-w-0">
          <h2 className="truncate text-[15px] font-semibold tracking-tight text-zinc-50">{section.chartLabel}</h2>
          <p className="mt-0.5 text-[11px] text-zinc-500">{section.itemCount} items</p>
        </div>
        {section.sourceUrl ? (
          <a
            href={section.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 text-[11px] font-medium text-cyan-300 transition-colors hover:text-cyan-200"
          >
            RSS
          </a>
        ) : null}
      </header>

      {section.items.length > 0 ? (
        <div className="divide-y divide-white/6">
          {section.items.map((item) => (
            <AppStoreGameListRow key={`${section.chartType}-${item.rank}-${item.appId}`} item={item} locale={locale} />
          ))}
        </div>
      ) : (
        <div className="px-3 py-6 text-sm text-zinc-500">{t.emptyState}</div>
      )}
    </section>
  );
}

export function AppStoreGameGridPage({
  country,
  countryName,
  countries,
  sections,
  fetchedAt,
  sourceUrl,
  errorMessage,
  locale,
  jsonLd,
}: AppStoreGameGridPageProps) {
  const t = getMessages(locale).appStoreGames;
  const regionDisplayNames = createRegionDisplayNames(locale);
  const countryLabel = getLocalizedAppStoreGameCountryLabel(country, countryName, locale, regionDisplayNames);
  const subtitle = t.subtitle.replace('{country}', countryLabel);
  const visibleSections = sections.filter((section) => section.items.length > 0 || !errorMessage);
  const grid =
    visibleSections.length > 0 ? (
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visibleSections.map((section) => (
          <AppStoreGameChartSection key={section.chartType} section={section} locale={locale} />
        ))}
      </div>
    ) : null;

  return (
    <AppStoreGameChartScaffold
      locale={locale}
      t={{
        title: t.title,
        subtitle,
        filterCountryLabel: t.filterCountryLabel,
        filterCountrySearchPlaceholder: t.filterCountrySearchPlaceholder,
        filterNoMatch: t.filterNoMatch,
        clearSearch: t.clearSearch,
        updatedAtLabel: t.updatedAtLabel,
        emptyState: t.emptyState,
        openOfficialChart: t.openOfficialChart,
      }}
      country={country}
      countries={countries}
      fetchedAt={fetchedAt}
      sourceUrl={sourceUrl}
      errorMessage={errorMessage}
      jsonLd={jsonLd}
    >
      {grid}
    </AppStoreGameChartScaffold>
  );
}
