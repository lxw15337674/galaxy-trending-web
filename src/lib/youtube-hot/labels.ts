import type { Locale } from '@/i18n/config';

const YOUTUBE_CATEGORY_LABELS: Record<string, { zh: string; en: string }> = {
  '1': { zh: '电影与动画', en: 'Film & Animation' },
  '2': { zh: '汽车与交通', en: 'Autos & Vehicles' },
  '10': { zh: '音乐', en: 'Music' },
  '15': { zh: '宠物与动物', en: 'Pets & Animals' },
  '17': { zh: '体育', en: 'Sports' },
  '18': { zh: '短片', en: 'Short Movies' },
  '19': { zh: '旅游与活动', en: 'Travel & Events' },
  '20': { zh: '游戏', en: 'Gaming' },
  '21': { zh: '视频博客', en: 'Videoblogging' },
  '22': { zh: '人物与博客', en: 'People & Blogs' },
  '23': { zh: '喜剧', en: 'Comedy' },
  '24': { zh: '娱乐', en: 'Entertainment' },
  '25': { zh: '新闻与政治', en: 'News & Politics' },
  '26': { zh: '生活技巧与时尚', en: 'Howto & Style' },
  '27': { zh: '教育', en: 'Education' },
  '28': { zh: '科学与技术', en: 'Science & Technology' },
  '29': { zh: '公益与行动', en: 'Nonprofits & Activism' },
  '30': { zh: '电影', en: 'Movies' },
  '31': { zh: '动画', en: 'Anime/Animation' },
  '32': { zh: '动作与冒险', en: 'Action/Adventure' },
  '33': { zh: '经典', en: 'Classics' },
  '34': { zh: '喜剧电影', en: 'Comedy' },
  '35': { zh: '纪录片', en: 'Documentary' },
  '36': { zh: '剧情', en: 'Drama' },
  '37': { zh: '家庭', en: 'Family' },
  '38': { zh: '海外', en: 'Foreign' },
  '39': { zh: '恐怖', en: 'Horror' },
  '40': { zh: '科幻与奇幻', en: 'Sci-Fi/Fantasy' },
  '41': { zh: '惊悚', en: 'Thriller' },
  '42': { zh: '短视频', en: 'Shorts' },
  '43': { zh: '节目', en: 'Shows' },
  '44': { zh: '预告片', en: 'Trailers' },
};

function getDisplayLocale(locale: Locale) {
  return locale === 'zh' ? 'zh-CN' : 'en';
}

function normalizeRegionCode(value: string | null | undefined) {
  return String(value ?? '')
    .trim()
    .toUpperCase();
}

function formatLabelWithCode(code: string, label: string) {
  const normalizedLabel = label.trim();
  if (!normalizedLabel || normalizedLabel === code) return code;
  return `${normalizedLabel} (${code})`;
}

export function createRegionDisplayNames(locale: Locale) {
  try {
    return new Intl.DisplayNames([getDisplayLocale(locale)], { type: 'region' });
  } catch {
    return null;
  }
}

export function getLocalizedYouTubeRegionLabel(
  regionCode: string | null | undefined,
  regionName: string | null | undefined,
  locale: Locale,
  displayNames?: Intl.DisplayNames | null,
) {
  const normalizedCode = normalizeRegionCode(regionCode);
  const fallbackName = String(regionName ?? '').trim();
  if (!normalizedCode) return fallbackName || '--';

  const regionDisplayNames = displayNames === undefined ? createRegionDisplayNames(locale) : displayNames;
  const localized = regionDisplayNames?.of(normalizedCode) ?? '';
  const baseLabel = localized && localized !== normalizedCode ? localized : fallbackName || normalizedCode;
  return formatLabelWithCode(normalizedCode, baseLabel);
}

export function getYouTubeCategoryLabel(
  categoryId: string | null | undefined,
  categoryTitle: string | null | undefined,
  locale: Locale,
) {
  if (categoryId) {
    const labels = YOUTUBE_CATEGORY_LABELS[categoryId];
    if (labels) {
      return locale === 'zh' ? labels.zh : labels.en;
    }
  }

  if (categoryTitle?.trim()) {
    return categoryTitle.trim();
  }

  return locale === 'zh' ? '未分类' : 'Uncategorized';
}
