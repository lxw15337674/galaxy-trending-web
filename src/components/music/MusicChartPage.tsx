'use client';

import { YouTubeMusicTrackCard } from '@/components/youtubehot/YouTubeMusicTrackCard';
import { YouTubeMusicDailyVideoCard } from '@/components/youtubehot/YouTubeMusicDailyVideoCard';
import { YouTubeMusicShortsSongCard } from '@/components/youtubehot/YouTubeMusicShortsSongCard';
import { AppleMusicTrackCard } from '@/components/applemusic/AppleMusicTrackCard';
import { SpotifyTrackCard } from '@/components/spotify/SpotifyTrackCard';
import { MusicChartScaffold } from './MusicChartScaffold';
import type { MusicPageData } from '@/lib/music/types';

interface MusicChartPageProps extends MusicPageData {
  jsonLd?: unknown;
}

const CARD_GRID_CLASS = 'mt-4 grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4';

export function MusicChartPage({
  locale,
  chartType,
  country,
  countries,
  items,
  fetchedAt,
  chartEndDate,
  sourceUrl,
  itemCount,
  errorMessage,
  youtubeWeekly,
  youtubeDailyVideos,
  youtubeDailyShorts,
  appleMusic,
  spotify,
  jsonLd,
}: MusicChartPageProps) {
  const renderGrid = () => {
    if (items.length === 0) {
      return null;
    }

    switch (chartType) {
      case 'youtube-music-weekly': {
        return (
          <div className={CARD_GRID_CLASS}>
            {items.map((item) => (
              <YouTubeMusicTrackCard
                key={`${chartEndDate}-${item.rank}-${item.trackName}`}
                item={item}
                locale={locale}
                chartEndDate={chartEndDate}
                fallbackHref={`https://charts.youtube.com/charts/TopSongs/${country === 'global' ? 'global' : country.toLowerCase()}/weekly`}
              />
            ))}
          </div>
        );
      }
      case 'youtube-music-videos-daily': {
        return (
          <div className={CARD_GRID_CLASS}>
            {items.map((item) => (
              <YouTubeMusicDailyVideoCard
                key={`${chartEndDate}-${item.rank}-${item.videoId}`}
                item={item}
                locale={locale}
                chartEndDate={chartEndDate}
                fallbackHref={sourceUrl}
              />
            ))}
          </div>
        );
      }
      case 'youtube-music-shorts-songs-daily': {
        return (
          <div className={CARD_GRID_CLASS}>
            {items.map((item) => (
              <YouTubeMusicShortsSongCard
                key={`${chartEndDate}-${item.rank}-${item.trackName}`}
                item={item}
                locale={locale}
                chartEndDate={chartEndDate}
                fallbackHref={sourceUrl}
              />
            ))}
          </div>
        );
      }
      case 'apple-music': {
        return (
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
        );
      }
      case 'spotify': {
        return (
          <div className={CARD_GRID_CLASS}>
            {items.map((item) => (
              <SpotifyTrackCard
                key={`${chartEndDate}-${item.rank}-${item.spotifyTrackId ?? item.trackName}`}
                item={item}
                locale={locale}
                chartEndDate={chartEndDate}
                fallbackHref={sourceUrl}
              />
            ))}
          </div>
        );
      }
      default:
        return null;
    }
  };

  return (
    <MusicChartScaffold
      locale={locale}
      chartType={chartType}
      country={country}
      countryName={appleMusic?.countryName ?? spotify?.countryName ?? ''}
      countries={countries}
      items={items}
      fetchedAt={fetchedAt}
      chartEndDate={chartEndDate}
      sourceUrl={sourceUrl}
      itemCount={itemCount}
      errorMessage={errorMessage}
      youtubeWeekly={youtubeWeekly}
      youtubeDailyVideos={youtubeDailyVideos}
      youtubeDailyShorts={youtubeDailyShorts}
      appleMusic={appleMusic}
      spotify={spotify}
      jsonLd={jsonLd}
    >
      {renderGrid()}
    </MusicChartScaffold>
  );
}
