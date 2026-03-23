import type { Metadata } from 'next';
import type { Locale } from '@/i18n/config';
import { toAbsoluteUrl } from '@/lib/seo/site-origin';
import type { YouTubeHotQueryItem } from '@/lib/youtube-hot/types';

function buildAbsoluteUrl(pathname: string) {
  return toAbsoluteUrl(pathname);
}

function resolveMetadataCopy(locale: Locale) {
  if (locale === 'en') {
    return {
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
      canonicalPath: '/en/youtube-trending',
      inLanguage: 'en-US',
    };
  }

  return {
    title: 'YouTube Trending 视频榜',
    description: '按小时更新的 YouTube Trending 视频榜，支持地区和分类筛选，始终展示最近一次成功抓取结果。',
    keywords: ['youtube trending', 'youtube trending 视频', 'youtube 热门视频', 'YouTube 视频榜', 'YouTube 分类榜单'],
    canonicalPath: '/zh/youtube-trending',
    inLanguage: 'zh-CN',
  };
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
      languages: {
        'zh-CN': '/zh/youtube-trending',
        en: '/en/youtube-trending',
        'x-default': '/en/youtube-trending',
      },
    },
    openGraph: {
      type: 'website',
      url: absoluteCanonical,
      title: copy.title,
      description: copy.description,
      locale: copy.inLanguage,
      siteName: 'Media Trending Web',
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
