import type { Locale } from '@/i18n/config';
import { getMessages } from '@/i18n/messages';
import type { SearchParamsInput } from '@/lib/server/search-params';
import { readSearchParamRaw } from '@/lib/server/search-params';
import { classifyRuntimeError, logServerError } from '@/lib/server/runtime-error';
import { normalizeAppleMusicCountryCode } from './countries';
import { getLatestAppleMusicTopSongsSnapshot, listLatestAppleMusicTopSongsCountries } from './db';
import type { AppleMusicChartItem, AppleMusicCountryOption } from './types';

export interface AppleMusicPageData {
  country: string;
  countryName: string;
  countries: AppleMusicCountryOption[];
  items: AppleMusicChartItem[];
  fetchedAt: string | null;
  chartEndDate: string;
  sourceUrl: string;
  playlistTitle: string;
  itemCount: number;
  errorMessage?: string | null;
  locale: Locale;
}

function takeFirst(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeCountryValue(rawValue: string | string[] | undefined) {
  return normalizeAppleMusicCountryCode(takeFirst(rawValue));
}

export async function buildAppleMusicPageData(
  rawSearchParams: SearchParamsInput,
  locale: Locale,
): Promise<AppleMusicPageData> {
  const t = getMessages(locale).appleMusic;
  let country = 'global';
  let countryName = '';
  let countries: AppleMusicCountryOption[] = [];
  let fetchedAt: string | null = null;
  let chartEndDate = '';
  let sourceUrl = '';
  let playlistTitle = '';
  let itemCount = 0;
  let items: AppleMusicChartItem[] = [];
  let errorMessage: string | null = null;

  try {
    countries = await listLatestAppleMusicTopSongsCountries();
    const fallbackCountry = countries.find((item) => item.countryCode === 'global')?.countryCode ?? countries[0]?.countryCode ?? 'global';

    const requestedCountry = normalizeCountryValue(readSearchParamRaw(rawSearchParams, 'country'));
    country = countries.some((item) => item.countryCode === requestedCountry) ? requestedCountry : fallbackCountry;
    const snapshot = await getLatestAppleMusicTopSongsSnapshot(country);

    if (!snapshot) {
      errorMessage = t.errorNoSnapshot;
    } else {
      country = snapshot.countryCode;
      countryName = snapshot.countryName;
      fetchedAt = snapshot.fetchedAt;
      chartEndDate = snapshot.chartEndDate;
      sourceUrl = snapshot.sourceUrl;
      playlistTitle = snapshot.playlistTitle;
      itemCount = snapshot.itemCount;
      items = snapshot.items;
    }
  } catch (error) {
    logServerError('apple-music/page-data', error);
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
    countryName,
    countries,
    items,
    fetchedAt,
    chartEndDate,
    sourceUrl,
    playlistTitle,
    itemCount,
    errorMessage,
    locale,
  };
}
