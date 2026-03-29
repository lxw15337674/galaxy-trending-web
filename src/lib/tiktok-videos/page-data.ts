import type { Locale } from '@/i18n/config';
import { getMessages } from '@/i18n/messages';
import { classifyRuntimeError, logServerError } from '@/lib/server/runtime-error';
import { readSearchParamRaw, type SearchParamsInput } from '@/lib/server/search-params';
import {
  getLatestPublishedTikTokVideoBatch,
  listLatestTikTokVideoCountries,
  listLatestTikTokVideoScopes,
  queryLatestTikTokVideos,
} from './db';
import {
  TIKTOK_VIDEO_ORDER_OPTIONS,
  TIKTOK_VIDEO_PERIOD_OPTIONS,
  type TikTokVideoCountryFilter,
  type TikTokVideoOrderBy,
  type TikTokVideoQueryItem,
  type TikTokVideoScopeFilter,
} from './types';

function takeFirst(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeCountryCode(rawValue: string | string[] | undefined) {
  const value = takeFirst(rawValue)?.trim().toUpperCase() ?? '';
  return /^[A-Z]{2}$/.test(value) ? value : null;
}

function normalizePeriod(rawValue: string | string[] | undefined) {
  const value = Number(takeFirst(rawValue)?.trim());
  if (!Number.isFinite(value)) return null;
  return TIKTOK_VIDEO_PERIOD_OPTIONS.includes(value as (typeof TIKTOK_VIDEO_PERIOD_OPTIONS)[number]) ? value : null;
}

function normalizeOrderBy(rawValue: string | string[] | undefined) {
  const value = takeFirst(rawValue)?.trim().toLowerCase() ?? '';
  return TIKTOK_VIDEO_ORDER_OPTIONS.includes(value as TikTokVideoOrderBy) ? (value as TikTokVideoOrderBy) : null;
}

function hasCountry(countries: TikTokVideoCountryFilter[], countryCode: string | null) {
  if (!countryCode) return false;
  return countries.some((item) => item.countryCode === countryCode);
}

function hasScope(scopes: TikTokVideoScopeFilter[], period: number | null, orderBy: TikTokVideoOrderBy | null) {
  if (!period || !orderBy) return false;
  return scopes.some((item) => item.period === period && item.orderBy === orderBy);
}

export interface TikTokVideoPageData {
  focusCountry: string;
  countryName: string | null;
  countries: TikTokVideoCountryFilter[];
  items: TikTokVideoQueryItem[];
  generatedAt: string;
  sourceUrl: string;
  totalCountries: number;
  period: number;
  orderBy: TikTokVideoOrderBy;
  scopes: TikTokVideoScopeFilter[];
  errorMessage?: string | null;
  locale: Locale;
}

export async function buildTikTokVideoPageData(
  rawSearchParams: SearchParamsInput,
  locale: Locale,
  preferredCountryCode?: string | null,
): Promise<TikTokVideoPageData> {
  const t = getMessages(locale).tiktokVideos;
  const fallbackNow = new Date().toISOString();

  try {
    const [batch, scopes] = await Promise.all([
      getLatestPublishedTikTokVideoBatch(),
      listLatestTikTokVideoScopes(),
    ]);

    if (!batch || !scopes.length) {
      return {
        focusCountry: 'US',
        countryName: null,
        countries: [],
        items: [],
        generatedAt: fallbackNow,
        sourceUrl: 'https://ads.tiktok.com/business/creativecenter/inspiration/popular/pc/en',
        totalCountries: 0,
        period: 7,
        orderBy: 'vv',
        scopes: [],
        errorMessage: t.errorNoSnapshot,
        locale,
      };
    }

    const requestedPeriod = normalizePeriod(readSearchParamRaw(rawSearchParams, 'period'));
    const requestedOrderBy = normalizeOrderBy(readSearchParamRaw(rawSearchParams, 'sort'));
    const fallbackScope = scopes.find((item) => item.period === 7 && item.orderBy === 'vv') ?? scopes[0];
    const resolvedScope =
      hasScope(scopes, requestedPeriod, requestedOrderBy)
        ? scopes.find((item) => item.period === requestedPeriod && item.orderBy === requestedOrderBy)
        : null;
    const selectedScope = resolvedScope ?? fallbackScope;

    const countries = await listLatestTikTokVideoCountries(selectedScope.period, selectedScope.orderBy);
    const requestedCountry = normalizeCountryCode(readSearchParamRaw(rawSearchParams, 'country'));
    const preferredCountry = preferredCountryCode?.trim().toUpperCase() ?? null;
    const resolvedCountry =
      (hasCountry(countries, requestedCountry) ? requestedCountry : null) ??
      (hasCountry(countries, preferredCountry) ? preferredCountry : null) ??
      countries[0]?.countryCode ??
      'US';

    const result = await queryLatestTikTokVideos({
      countryCode: resolvedCountry,
      period: selectedScope.period,
      orderBy: selectedScope.orderBy,
    });

    return {
      focusCountry: resolvedCountry,
      countryName:
        result.country?.countryName ??
        countries.find((item) => item.countryCode === resolvedCountry)?.countryName ??
        null,
      countries,
      items: result.data,
      generatedAt: result.batch?.generatedAt ?? fallbackNow,
      sourceUrl: 'https://ads.tiktok.com/business/creativecenter/inspiration/popular/pc/en',
      totalCountries: countries.length,
      period: selectedScope.period,
      orderBy: selectedScope.orderBy,
      scopes,
      locale,
    };
  } catch (error) {
    logServerError('tiktok-videos/page-data', error);
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
      sourceUrl: 'https://ads.tiktok.com/business/creativecenter/inspiration/popular/pc/en',
      totalCountries: 0,
      period: 7,
      orderBy: 'vv',
      scopes: [],
      errorMessage,
      locale,
    };
  }
}
