'use client';

import { YouTubeMusicChartScaffold } from '@/components/youtubehot/YouTubeMusicChartScaffold';
import { YouTubeMusicShortsSongCard } from '@/components/youtubehot/YouTubeMusicShortsSongCard';
import type { Locale } from '@/i18n/config';
import { getMessages } from '@/i18n/messages';
import {
  YOUTUBE_MUSIC_GLOBAL_COUNTRY_CODE,
  type YouTubeMusicChartItem,
  type YouTubeMusicCountryOption,
} from '@/lib/youtube-music/types';

interface YouTubeMusicDailyShortsPageProps {
  country: string;
  countries: YouTubeMusicCountryOption[];
  items: YouTubeMusicChartItem[];
  fetchedAt: string;
  chartEndDate: string;
  itemCount: number;
  errorMessage?: string | null;
  locale: Locale;
  jsonLd?: unknown;
}

const CARD_GRID_CLASS = 'mt-4 grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4';

export function YouTubeMusicDailyShortsPage({
  country,
  countries,
  items,
  fetchedAt,
  chartEndDate,
  itemCount,
  errorMessage,
  locale,
  jsonLd,
}: YouTubeMusicDailyShortsPageProps) {
  const t = getMessages(locale).youtubeMusicShortsDaily;
  const grid =
    items.length > 0 ? (
      <div className={CARD_GRID_CLASS}>
        {items.map((item) => (
          <YouTubeMusicShortsSongCard
            key={`${chartEndDate}-${item.rank}-${item.trackName}`}
            item={item}
            locale={locale}
            chartEndDate={chartEndDate}
            fallbackHref={`https://charts.youtube.com/charts/TopSongsOnShorts/${country === YOUTUBE_MUSIC_GLOBAL_COUNTRY_CODE ? 'global' : country.toLowerCase()}/daily`}
          />
        ))}
      </div>
    ) : null;

  return (
    <YouTubeMusicChartScaffold
      locale={locale}
      copy={t}
      country={country}
      countries={countries}
      fetchedAt={fetchedAt}
      errorMessage={errorMessage}
      jsonLd={jsonLd}
    >
      {grid}
    </YouTubeMusicChartScaffold>
  );
}
