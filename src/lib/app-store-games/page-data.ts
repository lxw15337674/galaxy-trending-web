import type { Locale } from '@/i18n/config';
import { getMessages } from '@/i18n/messages';
import { resolveStandardPageDataErrorMessage } from '@/lib/page-data/runtime-error-message';
import type { SearchParamsInput } from '@/lib/server/search-params';
import { readSearchParamRaw } from '@/lib/server/search-params';
import { logServerError } from '@/lib/server/runtime-error';
import { getAppStoreGameCountryName } from './countries';
import { getLatestAppStoreGameChartSnapshot, listAppStoreGameChartTypes, listLatestAppStoreGameCountries } from './db';
import type { AppStoreGameChartItem, AppStoreGameChartOption, AppStoreGameChartType, AppStoreGameCountryOption } from './types';
import { APP_STORE_GAME_CHART_TYPE_FREE, normalizeAppStoreGameCountryCode } from './types';

export interface AppStoreGamesPageSection {
  chartType: AppStoreGameChartType;
  chartLabel: string;
  items: AppStoreGameChartItem[];
  fetchedAt: string | null;
  snapshotHour: string | null;
  sourceUrl: string;
  feedTitle: string;
  itemCount: number;
}

export interface AppStoreGamesPageData {
  country: string;
  countryName: string;
  countries: AppStoreGameCountryOption[];
  charts: AppStoreGameChartOption[];
  sections: AppStoreGamesPageSection[];
  fetchedAt: string | null;
  sourceUrl: string;
  errorMessage?: string | null;
  locale: Locale;
}

function buildChartLabel(locale: Locale, chartType: AppStoreGameChartType) {
  const t = getMessages(locale).appStoreGames;
  if (chartType === 'toppaid') return t.chartTopPaid;
  if (chartType === 'topgrossing') return t.chartTopGrossing;
  return t.chartTopFree;
}

export async function buildAppStoreGamesPageData(
  rawSearchParams: SearchParamsInput,
  locale: Locale,
): Promise<AppStoreGamesPageData> {
  const t = getMessages(locale).appStoreGames;
  const charts: AppStoreGameChartOption[] = listAppStoreGameChartTypes().map((chartType) => ({
    chartType,
    chartLabel: buildChartLabel(locale, chartType),
  }));
  const requestedCountry = normalizeAppStoreGameCountryCode(readSearchParamRaw(rawSearchParams, 'country'));

  try {
    const countries = await listLatestAppStoreGameCountries(APP_STORE_GAME_CHART_TYPE_FREE);
    const fallbackCountry = countries.find((item) => item.countryCode === 'US')?.countryCode ?? countries[0]?.countryCode ?? 'US';
    const country = countries.some((item) => item.countryCode === requestedCountry) ? requestedCountry : fallbackCountry;
    const snapshots = await Promise.all(charts.map((chart) => getLatestAppStoreGameChartSnapshot(chart.chartType, country)));
    const sections: AppStoreGamesPageSection[] = charts.map((chart, index) => {
      const snapshot = snapshots[index];
      return {
        chartType: chart.chartType,
        chartLabel: chart.chartLabel,
        items: snapshot?.items ?? [],
        fetchedAt: snapshot?.fetchedAt ?? null,
        snapshotHour: snapshot?.snapshotHour ?? null,
        sourceUrl: snapshot?.sourceUrl ?? '',
        feedTitle: snapshot?.feedTitle ?? '',
        itemCount: snapshot?.itemCount ?? 0,
      };
    });
    const firstSnapshot = snapshots.find((item) => item !== null);
    const latestFetchedAt = sections
      .map((section) => section.fetchedAt)
      .filter((value): value is string => Boolean(value))
      .sort((left, right) => right.localeCompare(left))[0] ?? null;

    return {
      country,
      countryName: firstSnapshot?.countryName ?? countries.find((item) => item.countryCode === country)?.countryName ?? getAppStoreGameCountryName(country),
      countries,
      charts,
      sections,
      fetchedAt: latestFetchedAt,
      sourceUrl: firstSnapshot?.sourceUrl ?? '',
      errorMessage: sections.every((section) => section.items.length === 0) ? t.errorNoSnapshot : null,
      locale,
    };
  } catch (error) {
    logServerError('app-store-games/page-data', error);
    return {
      country: requestedCountry,
      countryName: getAppStoreGameCountryName(requestedCountry),
      countries: [],
      charts,
      sections: charts.map((chart) => ({
        chartType: chart.chartType,
        chartLabel: chart.chartLabel,
        items: [],
        fetchedAt: null,
        snapshotHour: null,
        sourceUrl: '',
        feedTitle: '',
        itemCount: 0,
      })),
      fetchedAt: null,
      sourceUrl: '',
      errorMessage: resolveStandardPageDataErrorMessage(error, t, { fallbackToErrorMessage: true }),
      locale,
    };
  }
}
