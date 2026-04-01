import type { Locale } from '@/i18n/config';
import { getMessages } from '@/i18n/messages';
import { resolveStandardPageDataErrorMessage } from '@/lib/page-data/runtime-error-message';
import type { SearchParamsInput } from '@/lib/server/search-params';
import { readSearchParamRaw } from '@/lib/server/search-params';
import { logServerError } from '@/lib/server/runtime-error';
import { getLatestSteamChartSnapshot, listSteamChartTypes } from './db';
import type { SteamChartItem, SteamChartOption, SteamChartType } from './types';
import { normalizeSteamChartType } from './types';

export interface SteamPageData {
  chartType: SteamChartType;
  chartLabel: string;
  charts: SteamChartOption[];
  items: SteamChartItem[];
  fetchedAt: string | null;
  snapshotHour: string | null;
  sourceUrl: string;
  itemCount: number;
  errorMessage?: string | null;
  locale: Locale;
}

export async function buildSteamPageData(rawSearchParams: SearchParamsInput, locale: Locale): Promise<SteamPageData> {
  const t = getMessages(locale).steam;
  const fallbackChartType = normalizeSteamChartType(readSearchParamRaw(rawSearchParams, 'chart'));
  const charts: SteamChartOption[] = listSteamChartTypes().map((chartType) => ({
    chartType,
    chartLabel:
      chartType === 'top-sellers'
        ? t.chartTopSellers
        : chartType === 'trending'
          ? t.chartTrending
          : t.chartMostPlayed,
  }));

  try {
    const snapshot = await getLatestSteamChartSnapshot(fallbackChartType);
    if (!snapshot) {
      return {
        chartType: fallbackChartType,
        chartLabel: charts.find((item) => item.chartType === fallbackChartType)?.chartLabel ?? t.chartMostPlayed,
        charts,
        items: [],
        fetchedAt: null,
        snapshotHour: null,
        sourceUrl: '',
        itemCount: 0,
        errorMessage: t.errorNoSnapshot,
        locale,
      };
    }

    return {
      chartType: snapshot.chartType,
      chartLabel: charts.find((item) => item.chartType === snapshot.chartType)?.chartLabel ?? snapshot.chartLabel,
      charts,
      items: snapshot.items,
      fetchedAt: snapshot.fetchedAt,
      snapshotHour: snapshot.snapshotHour,
      sourceUrl: snapshot.sourceUrl,
      itemCount: snapshot.itemCount,
      locale,
    };
  } catch (error) {
    logServerError('steam/page-data', error);
    return {
      chartType: fallbackChartType,
      chartLabel: charts.find((item) => item.chartType === fallbackChartType)?.chartLabel ?? t.chartMostPlayed,
      charts,
      items: [],
      fetchedAt: null,
      snapshotHour: null,
      sourceUrl: '',
      itemCount: 0,
      errorMessage: resolveStandardPageDataErrorMessage(error, t, { fallbackToErrorMessage: true }),
      locale,
    };
  }
}
