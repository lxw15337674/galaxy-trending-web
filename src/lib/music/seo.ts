import type { Metadata } from 'next';
import type { Locale } from '@/i18n/config';
import { getMessages } from '@/i18n/messages';
import type { MusicPageData, MusicChartType } from './types';

export function buildMusicMetadata(
  locale: Locale,
  {
    chartType,
    countryCode,
    countryName,
  }: {
    chartType: MusicChartType;
    countryCode: string;
    countryName: string;
  },
): Metadata {
  const t = getMessages(locale);
  const messages = t.music;

  const chartLabels: Record<MusicChartType, string> = {
    'youtube-music-weekly': messages.chartYouTubeMusicWeekly,
    'youtube-music-videos-daily': messages.chartYouTubeMusicVideosDaily,
    'youtube-music-shorts-songs-daily': messages.chartYouTubeMusicShortsDaily,
    'apple-music': messages.chartAppleMusic,
    'spotify': messages.chartSpotify,
  };

  const chartName = chartLabels[chartType];
  let title = `${messages.title} - ${chartName}`;
  let description = messages.description;

  if (countryCode !== 'global' && countryName) {
    title = `${title} (${countryName})`;
    description = `${messages.description} ${chartName} - ${countryName}`;
  }

  return {
    title,
    description,
    openGraph: {
      title,
      description,
    },
  };
}

export function buildMusicJsonLd(locale: Locale, pageData: MusicPageData): unknown {
  const { items, chartType, country, countryName } = pageData;
  const t = getMessages(locale).music;

  const chartLabels: Record<MusicChartType, string> = {
    'youtube-music-weekly': t.chartYouTubeMusicWeekly,
    'youtube-music-videos-daily': t.chartYouTubeMusicVideosDaily,
    'youtube-music-shorts-songs-daily': t.chartYouTubeMusicShortsDaily,
    'apple-music': t.chartAppleMusic,
    'spotify': t.chartSpotify,
  };

  const chartName = chartLabels[chartType];
  const name = `${t.title} - ${chartName}${country !== 'global' && countryName ? ` - ${countryName}` : ''}`;

  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
    description: t.description,
    numberOfItems: items.length,
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: 'trackName' in item ? item.trackName : item.title ?? 'Unknown',
      ...('artistName' in item && item.artistName ? { creator: item.artistName } : {}),
    })),
  };
}
