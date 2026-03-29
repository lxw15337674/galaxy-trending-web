import type { Locale } from '@/i18n/config';
import { getMessages } from '@/i18n/messages';
import { classifyRuntimeError, logServerError } from '@/lib/server/runtime-error';
import { readSearchParamRaw, type SearchParamsInput } from '@/lib/server/search-params';
import { listLatestTikTokHashtagCountries, queryLatestTikTokHashtags } from './db';
import type { TikTokHashtagCountryFilter, TikTokHashtagQueryItem } from './types';

function takeFirst(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeCountryCode(rawValue: string | string[] | undefined) {
  const value = takeFirst(rawValue)?.trim().toUpperCase() ?? '';
  return /^[A-Z]{2}$/.test(value) ? value : null;
}

function hasCountry(countries: TikTokHashtagCountryFilter[], countryCode: string | null) {
  if (!countryCode) return false;
  return countries.some((item) => item.countryCode === countryCode);
}

export interface TikTokTrendPageData {
  focusCountry: string;
  countryName: string | null;
  countries: TikTokHashtagCountryFilter[];
  items: TikTokHashtagQueryItem[];
  generatedAt: string;
  sourceUrl: string;
  totalCountries: number;
  errorMessage?: string | null;
  locale: Locale;
}

export async function buildTikTokTrendPageData(
  rawSearchParams: SearchParamsInput,
  locale: Locale,
  preferredCountryCode?: string | null,
): Promise<TikTokTrendPageData> {
  const t = getMessages(locale).tiktokTrending;
  const fallbackNow = new Date().toISOString();

  try {
    const countries = await listLatestTikTokHashtagCountries();
    if (!countries.length) {
      return {
        focusCountry: 'US',
        countryName: null,
        countries: [],
        items: [],
        generatedAt: fallbackNow,
        sourceUrl: 'https://ads.tiktok.com/business/creativecenter/inspiration/popular/hashtag/pc/en',
        totalCountries: 0,
        errorMessage: t.errorNoSnapshot,
        locale,
      };
    }

    const requestedCountry = normalizeCountryCode(readSearchParamRaw(rawSearchParams, 'country'));
    const preferredCountry = preferredCountryCode?.trim().toUpperCase() ?? null;
    const resolvedCountry =
      (hasCountry(countries, requestedCountry) ? requestedCountry : null) ??
      (hasCountry(countries, preferredCountry) ? preferredCountry : null) ??
      countries[0]?.countryCode ??
      'US';

    const result = await queryLatestTikTokHashtags(resolvedCountry);

    return {
      focusCountry: resolvedCountry,
      countryName: result.country?.countryName ?? countries.find((item) => item.countryCode === resolvedCountry)?.countryName ?? null,
      countries,
      items: result.data,
      generatedAt: result.batch?.generatedAt ?? fallbackNow,
      sourceUrl: 'https://ads.tiktok.com/business/creativecenter/inspiration/popular/hashtag/pc/en',
      totalCountries: countries.length,
      locale,
    };
  } catch (error) {
    logServerError('tiktok-hashtag-trends/page-data', error);
    let errorMessage: string = t.errorLoad;
    const category = classifyRuntimeError(error);
    if (category === 'missing_db_env') {
      errorMessage = t.errorNoDbEnv;
    } else if (category === 'missing_table') {
      errorMessage = t.errorNoTable;
    } else if (category === 'query_failed' || category === 'network' || category === 'auth') {
      errorMessage = t.errorQueryFailed;
    }

    return {
      focusCountry: preferredCountryCode?.trim().toUpperCase() || 'US',
      countryName: null,
      countries: [],
      items: [],
      generatedAt: fallbackNow,
      sourceUrl: 'https://ads.tiktok.com/business/creativecenter/inspiration/popular/hashtag/pc/en',
      totalCountries: 0,
      errorMessage,
      locale,
    };
  }
}
