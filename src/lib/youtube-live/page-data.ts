import type { Locale } from '@/i18n/config';
import { getMessages } from '@/i18n/messages';
import { classifyRuntimeError, logServerError } from '@/lib/server/runtime-error';
import type { YouTubeLiveItem } from '@/lib/youtube-hot/types';
import { getLatestYouTubeLiveSnapshot } from '@/lib/youtube-live/db';

export interface YouTubeLivePageData {
  items: YouTubeLiveItem[];
  fetchedAt: string;
  errorMessage?: string | null;
  locale: Locale;
}

export async function buildYouTubeLivePageData(locale: Locale): Promise<YouTubeLivePageData> {
  const t = getMessages(locale).youtubeLive;
  const fallbackFetchedAt = new Date().toISOString();
  let fetchedAt = fallbackFetchedAt;
  let items: YouTubeLivePageData['items'] = [];
  let errorMessage: string | null = null;

  try {
    const snapshot = await getLatestYouTubeLiveSnapshot();

    if (!snapshot) {
      errorMessage = t.errorNoSnapshot;
    } else {
      fetchedAt = snapshot.crawledAt;
      items = snapshot.items;

      if (snapshot.status === 'failed') {
        errorMessage = snapshot.errorText
          ? `${t.errorLatestFailedPrefix}${snapshot.errorText}`
          : t.errorLatestFailed;
      }
    }
  } catch (error) {
    logServerError('youtube-live/page-data', error);
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
    items,
    fetchedAt,
    errorMessage,
    locale,
  };
}
