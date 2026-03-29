export const YOUTUBE_MUSIC_TOP_SONGS_CHART_TYPE = 'tracks';
export const YOUTUBE_MUSIC_TOP_VIDEOS_CHART_TYPE = 'videos';
export const YOUTUBE_MUSIC_SHORTS_SONGS_CHART_TYPE = 'shorts_tracks_by_usage';
export const YOUTUBE_MUSIC_DAILY_PERIOD_TYPE = 'daily';
export const YOUTUBE_MUSIC_WEEKLY_PERIOD_TYPE = 'weekly';
export const YOUTUBE_MUSIC_GLOBAL_COUNTRY_CODE = 'global';
export const YOUTUBE_MUSIC_GLOBAL_COUNTRY_NAME = 'Global';
export const YOUTUBE_MUSIC_TOP_SONGS_GLOBAL_PAGE_URL = 'https://charts.youtube.com/charts/TopSongs/global/weekly';
export const DEFAULT_YOUTUBE_MUSIC_WEEKLY_COUNTRY_CODES = [
  YOUTUBE_MUSIC_GLOBAL_COUNTRY_CODE,
  'US',
  'JP',
] as const;
export const DEFAULT_YOUTUBE_MUSIC_DAILY_COUNTRY_CODES = DEFAULT_YOUTUBE_MUSIC_WEEKLY_COUNTRY_CODES;

export interface YouTubeMusicChartArtist {
  name: string;
  kgMid: string | null;
}

export interface YouTubeMusicChartItem {
  rank: number;
  previousRank: number | null;
  trackName: string;
  artistNames: string;
  artists: YouTubeMusicChartArtist[];
  views: number | null;
  periodsOnChart: number | null;
  youtubeVideoId: string | null;
  youtubeUrl: string | null;
  thumbnailUrl: string | null;
  rawItem: unknown;
}

export interface YouTubeMusicDailyVideoItem {
  rank: number;
  previousRank: number | null;
  videoTitle: string;
  artistNames: string;
  artists: YouTubeMusicChartArtist[];
  views: number | null;
  periodsOnChart: number | null;
  youtubeVideoId: string | null;
  youtubeUrl: string | null;
  thumbnailUrl: string | null;
  channelName: string | null;
  channelId: string | null;
  durationSeconds: number | null;
  rawItem: unknown;
}

export interface YouTubeMusicWeeklyChartSnapshot {
  chartType: typeof YOUTUBE_MUSIC_TOP_SONGS_CHART_TYPE;
  periodType: typeof YOUTUBE_MUSIC_WEEKLY_PERIOD_TYPE;
  countryCode: string;
  countryName: string;
  chartEndDate: string;
  fetchedAt: string;
  sourceUrl: string;
  items: YouTubeMusicChartItem[];
  rawPayload: unknown;
}

export interface YouTubeMusicDailyVideoSnapshot {
  chartType: typeof YOUTUBE_MUSIC_TOP_VIDEOS_CHART_TYPE;
  periodType: typeof YOUTUBE_MUSIC_DAILY_PERIOD_TYPE;
  countryCode: string;
  countryName: string;
  chartEndDate: string;
  fetchedAt: string;
  sourceUrl: string;
  items: YouTubeMusicDailyVideoItem[];
  rawPayload: unknown;
}

export interface YouTubeMusicShortsSongDailySnapshot {
  chartType: typeof YOUTUBE_MUSIC_SHORTS_SONGS_CHART_TYPE;
  periodType: typeof YOUTUBE_MUSIC_DAILY_PERIOD_TYPE;
  countryCode: string;
  countryName: string;
  chartEndDate: string;
  fetchedAt: string;
  sourceUrl: string;
  items: YouTubeMusicChartItem[];
  rawPayload: unknown;
}

export interface YouTubeMusicCountryOption {
  countryCode: string;
  countryName: string;
}

export interface YouTubeMusicChartSnapshotWithItems {
  id: number;
  chartType: string;
  periodType: string;
  countryCode: string;
  countryName: string;
  chartEndDate: string;
  fetchedAt: string;
  sourceUrl: string;
  itemCount: number;
  items: YouTubeMusicChartItem[];
}

export interface YouTubeMusicDailyVideoSnapshotWithItems {
  id: number;
  countryCode: string;
  countryName: string;
  chartEndDate: string;
  fetchedAt: string;
  sourceUrl: string;
  itemCount: number;
  items: YouTubeMusicDailyVideoItem[];
}
