'use client';

import { YouTubeMusicChartScaffold } from '@/components/youtubehot/YouTubeMusicChartScaffold';
import { YouTubeMusicDailyVideoCard } from '@/components/youtubehot/YouTubeMusicDailyVideoCard';
import type { Locale } from '@/i18n/config';
import { getMessages } from '@/i18n/messages';
import {
  YOUTUBE_MUSIC_GLOBAL_COUNTRY_CODE,
  type YouTubeMusicCountryOption,
  type YouTubeMusicDailyVideoItem,
} from '@/lib/youtube-music/types';

interface YouTubeMusicDailyVideosPageProps {
  country: string;
  countries: YouTubeMusicCountryOption[];
  items: YouTubeMusicDailyVideoItem[];
  fetchedAt: string;
  chartEndDate: string;
  itemCount: number;
  errorMessage?: string | null;
  locale: Locale;
  jsonLd?: unknown;
}

const CARD_GRID_CLASS = 'mt-4 grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4';

export function YouTubeMusicDailyVideosPage({
  country,
  countries,
  items,
  fetchedAt,
  chartEndDate,
  errorMessage,
  locale,
  jsonLd,
}: YouTubeMusicDailyVideosPageProps) {
  const t = getMessages(locale).youtubeMusicVideosDaily;
  const grid =
    items.length > 0 ? (
      <div className={CARD_GRID_CLASS}>
        {items.map((item) => (
          <YouTubeMusicDailyVideoCard
            key={`${chartEndDate}-${item.rank}-${item.youtubeVideoId ?? item.videoTitle}`}
            item={item}
            locale={locale}
            chartEndDate={chartEndDate}
            fallbackHref={`https://charts.youtube.com/charts/TopVideos/${country === YOUTUBE_MUSIC_GLOBAL_COUNTRY_CODE ? 'global' : country.toLowerCase()}/daily`}
          />
        ))}
      </div>
    ) : null;

  return (
    <YouTubeMusicChartScaffold
      locale={locale}
      t={t}
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
