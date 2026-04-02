import type { YouTubeMusicPageData } from '@/lib/youtube-music/page-data';
import type { YouTubeMusicDailyVideosPageData } from '@/lib/youtube-music/daily-videos-page-data';
import type { YouTubeMusicDailyShortsSongsPageData } from '@/lib/youtube-music/daily-shorts-page-data';
import type { AppleMusicPageData } from '@/lib/apple-music/page-data';
import type { SpotifyPageData } from '@/lib/spotify/page-data';
import type { Locale } from '@/i18n/config';

export type MusicChartType =
  | 'youtube-music-weekly'
  | 'youtube-music-videos-daily'
  | 'youtube-music-shorts-songs-daily'
  | 'apple-music'
  | 'spotify';

export type YouTubeMusicWeeklyData = YouTubeMusicPageData;
export type YouTubeMusicDailyVideosData = YouTubeMusicDailyVideosPageData;
export type YouTubeMusicDailyShortsData = YouTubeMusicDailyShortsSongsPageData;
export type AppleMusicData = AppleMusicPageData;
export type SpotifyData = SpotifyPageData;

export interface MusicPageData {
  chartType: MusicChartType;
  country: string;
  countryName: string;
  countries: Array<{ countryCode: string; countryName: string }>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  items: any[];
  fetchedAt: string | null;
  chartEndDate: string;
  sourceUrl: string;
  itemCount: number;
  errorMessage?: string | null;
  locale: Locale;
  youtubeWeekly: YouTubeMusicWeeklyData | null;
  youtubeDailyVideos: YouTubeMusicDailyVideosData | null;
  youtubeDailyShorts: YouTubeMusicDailyShortsData | null;
  appleMusic: AppleMusicData | null;
  spotify: SpotifyData | null;
}

export const MUSIC_CHART_TYPES = [
  {
    value: 'youtube-music-weekly' as const,
    labelKey: 'chartYouTubeMusicWeekly',
    keywords: ['youtube', 'youtube music', 'weekly', 'top songs'],
  },
  {
    value: 'youtube-music-videos-daily' as const,
    labelKey: 'chartYouTubeMusicVideosDaily',
    keywords: ['youtube', 'youtube music', 'videos', 'daily'],
  },
  {
    value: 'youtube-music-shorts-songs-daily' as const,
    labelKey: 'chartYouTubeMusicShortsDaily',
    keywords: ['youtube', 'youtube music', 'shorts', 'daily', 'songs'],
  },
  {
    value: 'apple-music' as const,
    labelKey: 'chartAppleMusic',
    keywords: ['apple', 'apple music', 'top 100'],
  },
  {
    value: 'spotify' as const,
    labelKey: 'chartSpotify',
    keywords: ['spotify', 'top songs'],
  },
] as const;
