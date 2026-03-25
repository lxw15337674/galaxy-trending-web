import type { Metadata } from 'next';
import { LOCALES, type Locale } from '@/i18n/config';
import { getHtmlLang, getIntlLocale } from '@/i18n/locale-meta';
import { toAbsoluteUrl } from '@/lib/seo/site-origin';
import type { YouTubeHotQueryItem } from '@/lib/youtube-hot/types';

function buildAbsoluteUrl(pathname: string) {
  return toAbsoluteUrl(pathname);
}

const YOUTUBE_HOT_METADATA_COPY: Record<Locale, { title: string; description: string; keywords: string[] }> = {
  en: {
    title: 'YouTube Trending Videos',
    description:
      'Track the latest YouTube trending videos across regions with structured category filters and hourly refreshed snapshots.',
    keywords: [
      'youtube trending',
      'youtube trending videos',
      'youtube trending ranking',
      'youtube hot videos',
      'youtube category ranking',
    ],
  },
  zh: {
    title: 'YouTube Trending 视频榜',
    description: '按小时更新的 YouTube Trending 视频榜，支持地区和分类筛选，始终展示最近一次成功抓取结果。',
    keywords: ['youtube trending', 'youtube trending 视频', 'youtube 热门视频', 'YouTube 视频榜', 'YouTube 分类榜单'],
  },
  es: {
    title: 'Videos en Tendencia de YouTube',
    description:
      'Sigue los videos en tendencia de YouTube por región con filtros por categoría y capturas actualizadas cada hora.',
    keywords: [
      'videos en tendencia de youtube',
      'ranking youtube tendencia',
      'videos populares de youtube',
      'youtube por categoria',
      'youtube por region',
    ],
  },
  ja: {
    title: 'YouTube急上昇動画',
    description: '地域別の最新 YouTube 急上昇動画を、カテゴリフィルタと毎時更新のスナップショットで追跡できます。',
    keywords: ['youtube 急上昇', 'youtube トレンド動画', 'youtube 動画ランキング', 'youtube 人気動画', 'youtube カテゴリランキング'],
  },
};

function resolveMetadataCopy(locale: Locale) {
  return {
    ...YOUTUBE_HOT_METADATA_COPY[locale],
    canonicalPath: `/${locale}/youtube-trending`,
    inLanguage: getIntlLocale(locale),
  };
}

function buildLanguageAlternates(pathname: string) {
  const entries = LOCALES.map((locale) => [getHtmlLang(locale), `/${locale}${pathname}`]);
  return Object.fromEntries([...entries, ['x-default', `/en${pathname}`]]) as Record<string, string>;
}

export function buildYouTubeHotMetadata(locale: Locale): Metadata {
  const copy = resolveMetadataCopy(locale);
  const absoluteCanonical = buildAbsoluteUrl(copy.canonicalPath);

  return {
    title: copy.title,
    description: copy.description,
    keywords: copy.keywords,
    alternates: {
      canonical: copy.canonicalPath,
      languages: buildLanguageAlternates('/youtube-trending'),
    },
    openGraph: {
      type: 'website',
      url: absoluteCanonical,
      title: copy.title,
      description: copy.description,
      locale: copy.inLanguage,
      siteName: 'Galaxy Trending',
    },
    twitter: {
      card: 'summary_large_image',
      title: copy.title,
      description: copy.description,
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export function buildYouTubeHotJsonLd(locale: Locale, items: YouTubeHotQueryItem[]) {
  const copy = resolveMetadataCopy(locale);
  const itemListElement = items.slice(0, 10).map((item, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: item.title,
    url: item.videoUrl,
  }));

  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: copy.title,
    description: copy.description,
    url: buildAbsoluteUrl(copy.canonicalPath),
    inLanguage: copy.inLanguage,
    about: copy.keywords,
    mainEntity: {
      '@type': 'ItemList',
      name: copy.title,
      itemListOrder: 'https://schema.org/ItemListOrderAscending',
      numberOfItems: itemListElement.length,
      itemListElement,
    },
  };
}
