import type { ComboboxOption } from '@/components/ui/combobox';
import type { Locale } from '@/i18n/config';
import { getMessages } from '@/i18n/messages';
import { prioritizePreferredItem } from '@/lib/filters/prioritize-preferred-item';
import { getLocalizedYouTubeRegionLabel, getYouTubeCategoryLabel } from '@/lib/youtube-hot/labels';
import {
  getAvailableYouTubeHotSorts,
  type YouTubeCategory,
  type YouTubeHotQueryItem,
  type YouTubeHotSort,
  type YouTubeRegion,
} from '@/lib/youtube-hot/types';

type YouTubeHotMessages = ReturnType<typeof getMessages>['youtubeHot'];

export const DEFAULT_PAGE_SIZE = 20;

export function buildItemKey(item: YouTubeHotQueryItem) {
  return `${item.snapshotDate}-${item.regionCode}-${item.rank}-${item.videoId}`;
}

export function mergeItems(current: YouTubeHotQueryItem[], next: YouTubeHotQueryItem[]) {
  const merged = [...current];
  const seen = new Set(current.map(buildItemKey));

  for (const item of next) {
    const key = buildItemKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }

  return merged;
}

export function normalizeFilterValue(value: string | null | undefined) {
  const normalized = value?.trim() ?? '';
  return normalized ? normalized : 'all';
}

export function toRegionContext(region: string | null | undefined) {
  const normalized = normalizeFilterValue(region);
  return normalized === 'all' ? null : normalized;
}

export function buildRegionOptions(
  regions: YouTubeRegion[],
  t: YouTubeHotMessages,
  formatRegionLabel: (region: YouTubeRegion) => string,
  userRegion: string | null | undefined,
) {
  const sortedRegions = prioritizePreferredItem(regions, (item) => item.regionCode, userRegion);

  return [
    { value: 'all', label: t.allRegions },
    ...sortedRegions.map((item) => {
      const localizedLabel = formatRegionLabel(item);
      return {
        value: item.regionCode,
        label: localizedLabel,
        keywords: [item.regionCode, item.regionName, localizedLabel],
      };
    }),
  ] satisfies ComboboxOption[];
}

export function buildCategoryOptions(
  categories: YouTubeCategory[],
  t: YouTubeHotMessages,
  locale: Locale,
) {
  return [
    { value: 'all', label: t.allCategories },
    ...categories.map((item) => {
      const categoryLabel = getYouTubeCategoryLabel(item.categoryId, item.categoryTitle, locale);
      const countSuffix = typeof item.count === 'number' ? ` (${item.count})` : '';
      return {
        value: item.categoryId,
        label: `${categoryLabel}${countSuffix}`,
        keywords: [item.categoryId, item.categoryTitle ?? '', categoryLabel],
      };
    }),
  ] satisfies ComboboxOption[];
}

export function buildSortOptions(t: YouTubeHotMessages, region: string | null) {
  const labels: Record<YouTubeHotSort, string> = {
    rank_asc: t.sortRank,
    region_coverage_desc: t.sortRegionCoverage,
    views_desc: t.sortViews,
    published_newest: t.sortPublishedNewest,
  };

  return getAvailableYouTubeHotSorts(region).map((sort) => ({
    value: sort,
    label: labels[sort],
    keywords: [labels[sort], sort],
  })) satisfies ComboboxOption[];
}

export function createRegionLabelFormatter(locale: Locale, regionDisplayNames: Intl.DisplayNames | null) {
  const cache = new Map<string, string>();

  return (regionItem: YouTubeRegion) => {
    const key = `${regionItem.regionCode}|${regionItem.regionName}`;
    const hit = cache.get(key);
    if (hit) return hit;

    const label = getLocalizedYouTubeRegionLabel(regionItem.regionCode, regionItem.regionName, locale, regionDisplayNames);
    cache.set(key, label);
    return label;
  };
}
