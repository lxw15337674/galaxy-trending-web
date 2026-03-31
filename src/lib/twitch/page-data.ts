import type { Locale } from '@/i18n/config';
import { getMessages } from '@/i18n/messages';
import type { SearchParamsInput } from '@/lib/server/search-params';
import { classifyRuntimeError, logServerError } from '@/lib/server/runtime-error';
import { TwitchHelixClient } from './client';
import type { TwitchTopCategoryItem, TwitchTopStreamItem } from './types';

export type TwitchLiveSort = 'viewers' | 'started';

export interface TwitchLiveFilterOption {
  value: string;
  label: string;
}

export interface TwitchLivePageData {
  locale: Locale;
  fetchedAt: string;
  items: TwitchTopStreamItem[];
  languages: TwitchLiveFilterOption[];
  categories: TwitchLiveFilterOption[];
  errorMessage?: string | null;
}

export interface TwitchCategoriesPageData {
  locale: Locale;
  fetchedAt: string;
  items: TwitchTopCategoryItem[];
  errorMessage?: string | null;
}

function takeFirst(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function createTwitchClient() {
  const clientId = process.env.TWITCH_CLIENT_ID?.trim();
  const clientSecret = process.env.TWITCH_CLIENT_SECRET?.trim();
  return new TwitchHelixClient(clientId ?? '', clientSecret ?? '');
}

function isMissingTwitchEnvError(error: unknown) {
  const text = error instanceof Error ? error.message : String(error);
  return text.includes('TWITCH_CLIENT_ID is missing') || text.includes('TWITCH_CLIENT_SECRET is missing');
}

function buildLanguageFilterOptions(items: TwitchTopStreamItem[]) {
  const seen = new Map<string, string>();
  for (const item of items) {
    const code = item.language.trim().toLowerCase();
    if (!code || seen.has(code)) continue;
    seen.set(code, item.language);
  }

  return Array.from(seen.entries())
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([value, label]) => ({ value, label }));
}

function buildCategoryFilterOptions(items: TwitchTopStreamItem[]) {
  const seen = new Map<string, string>();
  for (const item of items) {
    const value = item.gameId.trim();
    const label = item.gameName.trim();
    if (!value || !label || seen.has(value)) continue;
    seen.set(value, label);
  }

  return Array.from(seen.entries())
    .sort((left, right) => left[1].localeCompare(right[1]))
    .map(([value, label]) => ({ value, label }));
}

export function normalizeTwitchLiveLanguage(value: string | string[] | undefined) {
  const normalized = takeFirst(value)?.trim().toLowerCase() ?? '';
  return normalized || 'all';
}

export function normalizeTwitchLiveCategory(value: string | string[] | undefined) {
  const normalized = takeFirst(value)?.trim() ?? '';
  return normalized || 'all';
}

export function normalizeTwitchLiveSort(value: string | string[] | undefined): TwitchLiveSort {
  const normalized = takeFirst(value)?.trim().toLowerCase();
  return normalized === 'started' ? 'started' : 'viewers';
}

export async function buildTwitchLivePageData(
  _rawSearchParams: SearchParamsInput,
  locale: Locale,
): Promise<TwitchLivePageData> {
  const t = getMessages(locale).twitchLive;
  const fallbackNow = new Date().toISOString();

  try {
    const client = createTwitchClient();
    const result = await client.listTopStreams({ pageSize: 100, pages: 1 });

    return {
      locale,
      fetchedAt: result.fetchedAt,
      items: result.items,
      languages: buildLanguageFilterOptions(result.items),
      categories: buildCategoryFilterOptions(result.items),
    };
  } catch (error) {
    logServerError('twitch/live-page-data', error);
    let errorMessage = t.errorLoad;
    if (isMissingTwitchEnvError(error)) {
      errorMessage = t.errorNoApiEnv;
    } else {
      const category = classifyRuntimeError(error);
      if (category === 'auth') {
        errorMessage = t.errorAuth;
      } else if (category === 'network') {
        errorMessage = t.errorQueryFailed;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
    }

    return {
      locale,
      fetchedAt: fallbackNow,
      items: [],
      languages: [],
      categories: [],
      errorMessage,
    };
  }
}

export async function buildTwitchCategoriesPageData(locale: Locale): Promise<TwitchCategoriesPageData> {
  const t = getMessages(locale).twitchCategories;
  const fallbackNow = new Date().toISOString();

  try {
    const client = createTwitchClient();
    const result = await client.listTopCategories({ pageSize: 100, pages: 1 });

    return {
      locale,
      fetchedAt: result.fetchedAt,
      items: result.items,
    };
  } catch (error) {
    logServerError('twitch/categories-page-data', error);
    let errorMessage = t.errorLoad;
    if (isMissingTwitchEnvError(error)) {
      errorMessage = t.errorNoApiEnv;
    } else {
      const category = classifyRuntimeError(error);
      if (category === 'auth') {
        errorMessage = t.errorAuth;
      } else if (category === 'network') {
        errorMessage = t.errorQueryFailed;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
    }

    return {
      locale,
      fetchedAt: fallbackNow,
      items: [],
      errorMessage,
    };
  }
}
