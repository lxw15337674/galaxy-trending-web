import type { Locale } from '@/i18n/config';
import { getMessages } from '@/i18n/messages';
import { resolveStandardPageDataErrorMessage } from '@/lib/page-data/runtime-error-message';
import { normalizeCountryCode, normalizeEnumOption, normalizeNumberOption } from '@/lib/page-data/search-param-utils';
import { resolvePreferredCode } from '@/lib/page-data/selection-utils';
import { logServerError } from '@/lib/server/runtime-error';
import { readSearchParamRaw, type SearchParamsInput } from '@/lib/server/search-params';
import {
  getLatestPublishedTikTokVideoBatch,
  getLatestTikTokVideoBatchHealth,
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

function normalizePeriod(rawValue: string | string[] | undefined) {
  return normalizeNumberOption(rawValue, TIKTOK_VIDEO_PERIOD_OPTIONS);
}

function normalizeOrderBy(rawValue: string | string[] | undefined) {
  return normalizeEnumOption(rawValue, TIKTOK_VIDEO_ORDER_OPTIONS, { transform: 'lowercase' });
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
      const latestBatchHealth = await getLatestTikTokVideoBatchHealth();
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
        errorMessage: latestBatchHealth && !latestBatchHealth.isComplete ? t.errorLoad : t.errorNoSnapshot,
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
    const resolvedCountry = resolvePreferredCode({
      items: countries,
      candidates: [requestedCountry, preferredCountry],
      getCode: (item) => item.countryCode,
      fallback: 'US',
    });

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
    const errorMessage = resolveStandardPageDataErrorMessage(error, t);

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
