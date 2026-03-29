import type { Metadata } from 'next';
import type { Locale } from '@/i18n/config';
import { getIntlLocale } from '@/i18n/locale-meta';
import { buildLocaleAlternates } from '@/lib/seo/locale-alternates';
import { toAbsoluteUrl } from '@/lib/seo/site-origin';
import type { YouTubeMusicChartItem } from './types';

const YOUTUBE_MUSIC_METADATA_TEXT: Record<Locale, { title: string; description: string; keywords: string[] }> = {
  en: {
    title: 'YouTube Music Top Songs',
    description: 'Latest official global weekly YouTube Music top songs chart pulled from charts.youtube.com.',
    keywords: ['youtube music top songs', 'youtube music weekly chart', 'youtube music global chart', 'top songs weekly'],
  },
  zh: {
    title: 'YouTube Music 热门歌曲周榜',
    description: '抓取自 charts.youtube.com 的官方 YouTube Music 全球热门歌曲周榜。',
    keywords: ['YouTube Music 热门歌曲', 'YouTube Music 周榜', 'YouTube Music 全球榜', '热门歌曲周榜'],
  },
  es: {
    title: 'Top Songs de YouTube Music',
    description: 'Último ranking global semanal oficial de canciones de YouTube Music obtenido de charts.youtube.com.',
    keywords: ['youtube music top songs', 'youtube music semanal', 'ranking global youtube music', 'top songs weekly'],
  },
  ja: {
    title: 'YouTube Music 人気楽曲週間チャート',
    description: 'charts.youtube.com から取得した公式の YouTube Music グローバル週間トップソングです。',
    keywords: ['youtube music トップソング', 'youtube music 週間チャート', 'youtube music グローバル', '人気楽曲'],
  },
};

function resolveMetadataText(locale: Locale) {
  return {
    ...YOUTUBE_MUSIC_METADATA_TEXT[locale],
    canonicalPath: `/${locale}/youtube-music`,
    inLanguage: getIntlLocale(locale),
  };
}

export function buildYouTubeMusicMetadata(locale: Locale): Metadata {
  const t = resolveMetadataText(locale);
  const absoluteCanonical = toAbsoluteUrl(t.canonicalPath);

  return {
    title: t.title,
    description: t.description,
    keywords: t.keywords,
    alternates: {
      canonical: absoluteCanonical,
      languages: buildLocaleAlternates('/youtube-music'),
    },
    openGraph: {
      type: 'website',
      url: absoluteCanonical,
      title: t.title,
      description: t.description,
      locale: t.inLanguage,
      siteName: 'Galaxy Trending',
    },
    twitter: {
      card: 'summary_large_image',
      title: t.title,
      description: t.description,
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export function buildYouTubeMusicJsonLd(locale: Locale, items: YouTubeMusicChartItem[]) {
  const t = resolveMetadataText(locale);
  const itemListElement = items.slice(0, 10).map((item, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: item.trackName,
    url: item.youtubeUrl ?? toAbsoluteUrl(t.canonicalPath),
  }));

  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: t.title,
    description: t.description,
    url: toAbsoluteUrl(t.canonicalPath),
    inLanguage: t.inLanguage,
    about: t.keywords,
    mainEntity: {
      '@type': 'ItemList',
      name: t.title,
      itemListOrder: 'https://schema.org/ItemListOrderAscending',
      numberOfItems: itemListElement.length,
      itemListElement,
    },
  };
}
