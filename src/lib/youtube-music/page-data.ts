import type { Locale } from '@/i18n/config';
import { getMessages } from '@/i18n/messages';
import { classifyRuntimeError, logServerError } from '@/lib/server/runtime-error';
import {
  getLatestYouTubeMusicWeeklyTopSongsSnapshot,
  listLatestYouTubeMusicWeeklyCountries,
} from './db';
import { YouTubeMusicChartsClient } from './client';
import type { YouTubeMusicChartItem, YouTubeMusicCountryOption } from './types';
import type { SearchParamsInput } from '@/lib/server/search-params';
import { readSearchParamRaw } from '@/lib/server/search-params';

export interface YouTubeMusicPageData {
  country: string;
  countries: YouTubeMusicCountryOption[];
  items: YouTubeMusicChartItem[];
  fetchedAt: string;
  chartEndDate: string;
  sourceUrl: string;
  itemCount: number;
  errorMessage?: string | null;
  locale: Locale;
}

function takeFirst(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeCountryValue(rawValue: string | string[] | undefined) {
  const value = takeFirst(rawValue)?.trim() ?? '';
  if (!value || value.toLowerCase() === 'global') return 'global';
  return value.toUpperCase();
}

export async function buildYouTubeMusicPageData(
  rawSearchParams: SearchParamsInput,
  locale: Locale,
): Promise<YouTubeMusicPageData> {
  const t = getMessages(locale).youtubeMusic;
  const fallbackNow = new Date().toISOString();
  let country = 'global';
  let countries: YouTubeMusicCountryOption[] = [];
  let fetchedAt = fallbackNow;
  let chartEndDate = '';
  let sourceUrl = '';
  let itemCount = 0;
  let items: YouTubeMusicChartItem[] = [];
  let errorMessage: string | null = null;

  try {
    countries = await listLatestYouTubeMusicWeeklyCountries();
    if (countries.length === 0) {
      countries = await new YouTubeMusicChartsClient().listAvailableWeeklyTopSongsCountries();
    }

    const requestedCountry = normalizeCountryValue(readSearchParamRaw(rawSearchParams, 'country'));
    country = countries.some((item) => item.countryCode === requestedCountry) ? requestedCountry : 'global';
    const snapshot = await getLatestYouTubeMusicWeeklyTopSongsSnapshot(country);

    if (!snapshot) {
      errorMessage = t.errorNoSnapshot;
    } else {
      country = snapshot.countryCode;
      fetchedAt = snapshot.fetchedAt;
      chartEndDate = snapshot.chartEndDate;
      sourceUrl = snapshot.sourceUrl;
      itemCount = snapshot.itemCount;
      items = snapshot.items;
    }
  } catch (error) {
    logServerError('youtube-music/page-data', error);
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
    country,
    countries,
    items,
    fetchedAt,
    chartEndDate,
    sourceUrl,
    itemCount,
    errorMessage,
    locale,
  };
}
