'use client';

import { SteamChartScaffold } from '@/components/steam/SteamChartScaffold';
import { SteamGameCard } from '@/components/steam/SteamGameCard';
import type { Locale } from '@/i18n/config';
import { getMessages } from '@/i18n/messages';
import type { SteamChartItem, SteamChartOption } from '@/lib/steam/types';

interface SteamGridPageProps {
  chartType: string;
  chartLabel: string;
  charts: SteamChartOption[];
  items: SteamChartItem[];
  fetchedAt: string | null;
  snapshotHour: string | null;
  sourceUrl: string;
  itemCount: number;
  errorMessage?: string | null;
  locale: Locale;
  jsonLd?: unknown;
}

const CARD_GRID_CLASS = 'mt-4 grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4';

export function SteamGridPage({
  chartType,
  charts,
  items,
  fetchedAt,
  sourceUrl,
  errorMessage,
  locale,
  jsonLd,
}: SteamGridPageProps) {
  const t = getMessages(locale).steam;
  const activeChartLabel = charts.find((item) => item.chartType === chartType)?.chartLabel ?? t.chartMostPlayed;
  const subtitle = t.subtitle.replace('{chart}', activeChartLabel);
  const grid =
    items.length > 0 ? (
      <div className={CARD_GRID_CLASS}>
        {items.map((item) => (
          <SteamGameCard key={`${chartType}-${item.rank}-${item.steamItemId}`} item={item} locale={locale} chartType={chartType} />
        ))}
      </div>
    ) : null;

  return (
    <SteamChartScaffold
      locale={locale}
      t={{
        title: t.title,
        subtitle,
        chartSelectorLabel: t.chartSelectorLabel,
        updatedAtLabel: t.updatedAtLabel,
        emptyState: t.emptyState,
        openOfficialChart: t.openOfficialChart,
      }}
      chartType={chartType}
      charts={charts}
      fetchedAt={fetchedAt}
      sourceUrl={sourceUrl}
      errorMessage={errorMessage}
      jsonLd={jsonLd}
    >
      {grid}
    </SteamChartScaffold>
  );
}
