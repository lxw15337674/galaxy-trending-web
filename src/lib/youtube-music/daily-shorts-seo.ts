import type { Metadata } from 'next';
import type { Locale } from '@/i18n/config';
import { getIntlLocale } from '@/i18n/locale-meta';
import { buildLocaleAlternates } from '@/lib/seo/locale-alternates';
import { toAbsoluteUrl } from '@/lib/seo/site-origin';
import type { YouTubeMusicChartItem } from './types';

const METADATA_COPY: Record<Locale, { title: string; description: string; keywords: string[] }> = {
  en: {
    title: 'YouTube Music Daily Shorts Songs',
    description: 'Latest official YouTube Music daily top songs on Shorts chart from charts.youtube.com.',
    keywords: ['youtube music daily shorts songs', 'top songs on shorts', 'youtube shorts songs daily'],
  },
  zh: {
    title: 'YouTube Music 每日 Shorts 热门歌曲榜',
    description: '来自 charts.youtube.com 的官方 YouTube Music 每日 Shorts 热门歌曲榜。',
    keywords: ['YouTube Music Shorts 日榜', 'Shorts 热门歌曲', '每日 Shorts 歌曲榜'],
  },
  es: {
    title: 'Daily Shorts Songs de YouTube Music',
    description: 'Último ranking oficial diario de canciones en Shorts de YouTube Music desde charts.youtube.com.',
    keywords: ['youtube music daily shorts songs', 'shorts songs daily', 'ranking diario shorts canciones'],
  },
  ja: {
    title: 'YouTube Music デイリーShorts人気楽曲',
    description: 'charts.youtube.com から取得した公式の YouTube Music デイリーShorts人気楽曲チャートです。',
    keywords: ['youtube music shorts デイリー', 'shorts 人気楽曲', 'デイリーshortsソング'],
  },
};

function resolveMetadataCopy(locale: Locale) {
  return {
    ...METADATA_COPY[locale],
    canonicalPath: `/${locale}/youtube-music/shorts-songs-daily`,
    inLanguage: getIntlLocale(locale),
  };
}

export function buildYouTubeMusicDailyShortsSongsMetadata(locale: Locale): Metadata {
  const copy = resolveMetadataCopy(locale);
  const absoluteCanonical = toAbsoluteUrl(copy.canonicalPath);

  return {
    title: copy.title,
    description: copy.description,
    keywords: copy.keywords,
    alternates: {
      canonical: absoluteCanonical,
      languages: buildLocaleAlternates('/youtube-music/shorts-songs-daily'),
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

export function buildYouTubeMusicDailyShortsSongsJsonLd(locale: Locale, items: YouTubeMusicChartItem[]) {
  const copy = resolveMetadataCopy(locale);
  const itemListElement = items.slice(0, 10).map((item, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: item.trackName,
    url: item.youtubeUrl ?? toAbsoluteUrl(copy.canonicalPath),
  }));

  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: copy.title,
    description: copy.description,
    url: toAbsoluteUrl(copy.canonicalPath),
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
