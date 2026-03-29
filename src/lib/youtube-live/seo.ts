import type { Metadata } from 'next';
import { type Locale } from '@/i18n/config';
import { getIntlLocale } from '@/i18n/locale-meta';
import { buildLocaleAlternates } from '@/lib/seo/locale-alternates';
import { toAbsoluteUrl } from '@/lib/seo/site-origin';
import type { YouTubeLiveItem } from '@/lib/youtube-hot/types';

const YOUTUBE_LIVE_METADATA_TEXT: Record<Locale, { title: string; description: string; keywords: string[] }> = {
  en: {
    title: 'YouTube Live Ranking',
    description: 'Track global YouTube live rankings with language and category filters from scheduled snapshots.',
    keywords: [
      'youtube live ranking',
      'youtube live trending',
      'youtube live viewers',
      'youtube livestream leaderboard',
      'youtube live by language',
    ],
  },
  zh: {
    title: 'YouTube 直播热榜',
    description: '基于定时抓取的 YouTube 全球直播热榜，支持语言和分类筛选，持续追踪热门直播走势。',
    keywords: ['YouTube 直播热榜', 'YouTube 直播排行', 'YouTube 实时直播', 'YouTube 热门直播', 'YouTube 直播榜单'],
  },
  es: {
    title: 'Ranking de Directos de YouTube',
    description: 'Sigue el ranking global de directos de YouTube con filtros por idioma y categoría a partir de capturas programadas.',
    keywords: [
      'ranking de directos de youtube',
      'youtube live tendencia',
      'youtube espectadores en vivo',
      'tabla de directos youtube',
      'youtube live por idioma',
    ],
  },
  ja: {
    title: 'YouTubeライブランキング',
    description: '定期スナップショットから、言語・カテゴリ別に YouTube ライブの世界ランキングを追跡できます。',
    keywords: ['youtube ライブランキング', 'youtube ライブ トレンド', 'youtube 同時視聴', 'youtube 配信ランキング', 'youtube 言語別ライブ'],
  },
};

function resolveMetadataText(locale: Locale) {
  return {
    ...YOUTUBE_LIVE_METADATA_TEXT[locale],
    canonicalPath: `/${locale}/youtube-live`,
    inLanguage: getIntlLocale(locale),
  };
}

export function buildYouTubeLiveMetadata(locale: Locale): Metadata {
  const t = resolveMetadataText(locale);
  const absoluteCanonical = toAbsoluteUrl(t.canonicalPath);

  return {
    title: t.title,
    description: t.description,
    keywords: t.keywords,
    alternates: {
      canonical: absoluteCanonical,
      languages: buildLocaleAlternates('/youtube-live'),
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

export function buildYouTubeLiveJsonLd(locale: Locale, items: YouTubeLiveItem[]) {
  const t = resolveMetadataText(locale);
  const itemListElement = items.slice(0, 10).map((item, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: item.title,
    url: item.videoUrl,
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
