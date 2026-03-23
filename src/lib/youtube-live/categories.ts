import type { Locale } from '@/i18n/config';
import { getYouTubeCategoryLabel } from '@/lib/youtube-hot/labels';

export function getYouTubeLiveCategoryLabel(
  categoryId: string | null | undefined,
  categoryTitle: string | null | undefined,
  locale: Locale,
) {
  return getYouTubeCategoryLabel(categoryId, categoryTitle, locale);
}
