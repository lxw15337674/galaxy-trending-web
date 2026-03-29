'use client';

import { YouTubeMusicTrackCard } from '@/components/youtubehot/YouTubeMusicTrackCard';
import { YouTubeMusicChartScaffold } from '@/components/youtubehot/YouTubeMusicChartScaffold';
import type { Locale } from '@/i18n/config';
import { getMessages } from '@/i18n/messages';
import { YOUTUBE_MUSIC_GLOBAL_COUNTRY_CODE, type YouTubeMusicChartItem, type YouTubeMusicCountryOption } from '@/lib/youtube-music/types';

interface YouTubeMusicGridPageProps {
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

export function YouTubeMusicGridPage({
  country,
  countries,
  items,
  fetchedAt,
  chartEndDate,
  itemCount,
  errorMessage,
  locale,
  jsonLd,
}: YouTubeMusicGridPageProps) {
  const t = getMessages(locale).youtubeMusic;
  const grid =
    items.length > 0 ? (
      <div className={CARD_GRID_CLASS}>
        {items.map((item) => (
          <YouTubeMusicTrackCard
            key={`${chartEndDate}-${item.rank}-${item.trackName}`}
            item={item}
            locale={locale}
            chartEndDate={chartEndDate}
            fallbackHref={`https://charts.youtube.com/charts/TopSongs/${country === YOUTUBE_MUSIC_GLOBAL_COUNTRY_CODE ? 'global' : country.toLowerCase()}/weekly`}
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
