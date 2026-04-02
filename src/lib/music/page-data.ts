import type { Locale } from '@/i18n/config';
import { getMessages } from '@/i18n/messages';
import type { SearchParamsInput } from '@/lib/server/search-params';
import { readSearchParamRaw } from '@/lib/server/search-params';
import { classifyRuntimeError, logServerError } from '@/lib/server/runtime-error';
import { buildYouTubeMusicPageData } from '@/lib/youtube-music/page-data';
import { buildYouTubeMusicDailyVideosPageData } from '@/lib/youtube-music/daily-videos-page-data';
import { buildYouTubeMusicDailyShortsSongsPageData } from '@/lib/youtube-music/daily-shorts-page-data';
import { buildAppleMusicPageData } from '@/lib/apple-music/page-data';
import { buildSpotifyPageData } from '@/lib/spotify/page-data';
import type {
  MusicChartType,
  MusicPageData,
  YouTubeMusicWeeklyData,
  YouTubeMusicDailyVideosData,
  YouTubeMusicDailyShortsData,
  AppleMusicData,
  SpotifyData,
} from './types';

export { type MusicPageData } from './types';

const DEFAULT_CHART_TYPE: MusicChartType = 'spotify';

function takeFirst(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeChartType(rawValue: string | string[] | undefined): MusicChartType {
  const value = takeFirst(rawValue)?.trim() ?? '';
  switch (value) {
    case 'youtube-music-weekly':
      return 'youtube-music-weekly';
    case 'youtube-music-videos-daily':
      return 'youtube-music-videos-daily';
    case 'youtube-music-shorts-songs-daily':
      return 'youtube-music-shorts-songs-daily';
    case 'apple-music':
      return 'apple-music';
    case 'spotify':
      return 'spotify';
    default:
      return DEFAULT_CHART_TYPE;
  }
}

export async function buildMusicPageData(
  rawSearchParams: SearchParamsInput,
  locale: Locale,
): Promise<MusicPageData> {
  const t = getMessages(locale).music;
  const requestedType = normalizeChartType(readSearchParamRaw(rawSearchParams, 'type'));

  let errorMessage: string | null = null;
  let combinedData: Omit<MusicPageData, 'chartType' | 'errorMessage' | 'locale'> = {
    country: 'global',
    countryName: '',
    countries: [],
    items: [],
    fetchedAt: null,
    chartEndDate: '',
    sourceUrl: '',
    itemCount: 0,
    youtubeWeekly: null,
    youtubeDailyVideos: null,
    youtubeDailyShorts: null,
    appleMusic: null,
    spotify: null,
  };

  try {
    switch (requestedType) {
      case 'youtube-music-weekly': {
        const data = await buildYouTubeMusicPageData(rawSearchParams, locale);
        combinedData = {
          country: data.country,
          countryName: '',
          countries: data.countries,
          items: data.items,
          fetchedAt: data.fetchedAt,
          chartEndDate: data.chartEndDate,
          sourceUrl: data.sourceUrl,
          itemCount: data.itemCount,
          youtubeWeekly: data as YouTubeMusicWeeklyData,
          youtubeDailyVideos: null,
          youtubeDailyShorts: null,
          appleMusic: null,
          spotify: null,
        };
        break;
      }
      case 'youtube-music-videos-daily': {
        const data = await buildYouTubeMusicDailyVideosPageData(rawSearchParams, locale);
        combinedData = {
          country: data.country,
          countryName: '',
          countries: data.countries,
          items: data.items,
          fetchedAt: data.fetchedAt,
          chartEndDate: data.chartEndDate,
          sourceUrl: data.sourceUrl,
          itemCount: data.itemCount,
          youtubeWeekly: null,
          youtubeDailyVideos: data as YouTubeMusicDailyVideosData,
          youtubeDailyShorts: null,
          appleMusic: null,
          spotify: null,
        };
        break;
      }
      case 'youtube-music-shorts-songs-daily': {
        const data = await buildYouTubeMusicDailyShortsSongsPageData(rawSearchParams, locale);
        combinedData = {
          country: data.country,
          countryName: '',
          countries: data.countries,
          items: data.items,
          fetchedAt: data.fetchedAt,
          chartEndDate: data.chartEndDate,
          sourceUrl: data.sourceUrl,
          itemCount: data.itemCount,
          youtubeWeekly: null,
          youtubeDailyVideos: null,
          youtubeDailyShorts: data as YouTubeMusicDailyShortsData,
          appleMusic: null,
          spotify: null,
        };
        break;
      }
      case 'apple-music': {
        const data = await buildAppleMusicPageData(rawSearchParams, locale);
        combinedData = {
          country: data.country,
          countryName: data.countryName,
          countries: data.countries,
          items: data.items,
          fetchedAt: data.fetchedAt,
          chartEndDate: data.chartEndDate,
          sourceUrl: data.sourceUrl,
          itemCount: data.itemCount,
          youtubeWeekly: null,
          youtubeDailyVideos: null,
          youtubeDailyShorts: null,
          appleMusic: data as AppleMusicData,
          spotify: null,
        };
        break;
      }
      case 'spotify': {
        const data = await buildSpotifyPageData(rawSearchParams, locale);
        combinedData = {
          country: data.country,
          countryName: data.countryName,
          countries: data.countries,
          items: data.items,
          fetchedAt: data.fetchedAt,
          chartEndDate: data.chartEndDate,
          sourceUrl: data.sourceUrl,
          itemCount: data.itemCount,
          youtubeWeekly: null,
          youtubeDailyVideos: null,
          youtubeDailyShorts: null,
          appleMusic: null,
          spotify: data as SpotifyData,
        };
        break;
      }
    }
  } catch (error) {
    logServerError('music/page-data', error);
    const category = classifyRuntimeError(error);
    if (category === 'missing_db_env') {
      errorMessage = t.errorNoDbEnv;
    } else if (category === 'missing_table') {
      errorMessage = t.errorNoTable;
    } else if (category === 'query_failed' || category === 'network' || category === 'auth') {
      errorMessage = t.errorQueryFailed;
    } else if (error instanceof Error) {
      errorMessage = error.message;
    } else {
      errorMessage = t.errorLoad;
    }
  }

  return {
    chartType: requestedType,
    errorMessage,
    locale,
    ...combinedData,
  };
}
