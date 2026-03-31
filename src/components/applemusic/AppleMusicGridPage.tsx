'use client';

import { AppleMusicChartScaffold } from '@/components/applemusic/AppleMusicChartScaffold';
import { AppleMusicTrackCard } from '@/components/applemusic/AppleMusicTrackCard';
import type { Locale } from '@/i18n/config';
import { getMessages } from '@/i18n/messages';
import type { AppleMusicChartItem, AppleMusicCountryOption } from '@/lib/apple-music/types';

interface AppleMusicGridPageProps {
  country: string;
  countries: AppleMusicCountryOption[];
  items: AppleMusicChartItem[];
  fetchedAt: string | null;
  chartEndDate: string;
  sourceUrl: string;
  itemCount: number;
  errorMessage?: string | null;
  locale: Locale;
  jsonLd?: unknown;
}

const CARD_GRID_CLASS = 'mt-4 grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4';

export function AppleMusicGridPage({
  country,
  countries,
  items,
  fetchedAt,
  chartEndDate,
  sourceUrl,
  errorMessage,
  locale,
  jsonLd,
}: AppleMusicGridPageProps) {
  const t = getMessages(locale).appleMusic;
  const grid =
    items.length > 0 ? (
      <div className={CARD_GRID_CLASS}>
        {items.map((item) => (
          <AppleMusicTrackCard
            key={`${chartEndDate}-${item.rank}-${item.appleSongId}`}
            item={item}
            locale={locale}
            chartEndDate={chartEndDate}
            fallbackHref={sourceUrl}
          />
        ))}
      </div>
    ) : null;

  return (
    <AppleMusicChartScaffold
      locale={locale}
      t={t}
      country={country}
      countries={countries}
      fetchedAt={fetchedAt}
      sourceUrl={sourceUrl}
      errorMessage={errorMessage}
      jsonLd={jsonLd}
    >
      {grid}
    </AppleMusicChartScaffold>
  );
}
