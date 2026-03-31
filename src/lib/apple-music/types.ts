export const APPLE_MUSIC_TOP_SONGS_CHART_TYPE = 'tracks';
export const APPLE_MUSIC_DAILY_PERIOD_TYPE = 'daily';
export const APPLE_MUSIC_GLOBAL_COUNTRY_CODE = 'global';
export const APPLE_MUSIC_GLOBAL_COUNTRY_NAME = 'Global';
export const APPLE_MUSIC_TOP_SONGS_INDEX_URL = 'https://music.apple.com/us/new/top-charts/daily-global-top-charts';
export const APPLE_MUSIC_TOP_SONGS_SOURCE_TYPE = 'rss.marketingtools.apple.com';
export const APPLE_MUSIC_GLOBAL_PLAYLIST_SOURCE_TYPE = 'music.apple.com.playlist';
export const DEFAULT_APPLE_MUSIC_TOP_SONGS_COUNTRY_CODES = ['US', 'JP'] as const;

export interface AppleMusicCountryOption {
  countryCode: string;
  countryName: string;
  playlistId: string;
  playlistSlug: string;
  sourceUrl: string;
}

export interface AppleMusicChartItem {
  rank: number;
  trackName: string;
  artistNames: string;
  appleSongId: string;
  appleSongUrl: string;
  durationMs: number | null;
  thumbnailUrl: string | null;
  rawItem: unknown;
}

export interface AppleMusicTopSongsSnapshot {
  chartType: typeof APPLE_MUSIC_TOP_SONGS_CHART_TYPE;
  periodType: typeof APPLE_MUSIC_DAILY_PERIOD_TYPE;
  countryCode: string;
  countryName: string;
  chartEndDate: string;
  fetchedAt: string;
  sourceUrl: string;
  playlistId: string;
  playlistSlug: string;
  playlistTitle: string;
  items: AppleMusicChartItem[];
  rawPayload: unknown;
}

export interface AppleMusicTopSongsSnapshotWithItems {
  id: number;
  chartType: string;
  periodType: string;
  countryCode: string;
  countryName: string;
  chartEndDate: string;
  fetchedAt: string;
  sourceUrl: string;
  playlistId: string;
  playlistSlug: string;
  playlistTitle: string;
  itemCount: number;
  items: AppleMusicChartItem[];
}
