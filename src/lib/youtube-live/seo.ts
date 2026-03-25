import type { Metadata } from 'next';
import { LOCALES, type Locale } from '@/i18n/config';
import { getHtmlLang, getIntlLocale } from '@/i18n/locale-meta';
import { toAbsoluteUrl } from '@/lib/seo/site-origin';
import type { YouTubeLiveItem } from '@/lib/youtube-hot/types';

const YOUTUBE_LIVE_METADATA_COPY: Record<Locale, { title: string; description: string; keywords: string[] }> = {
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

function resolveMetadataCopy(locale: Locale) {
  return {
    ...YOUTUBE_LIVE_METADATA_COPY[locale],
    canonicalPath: `/${locale}/youtube-live`,
    inLanguage: getIntlLocale(locale),
  };
}

function buildLanguageAlternates(pathname: string) {
  const entries = LOCALES.map((locale) => [getHtmlLang(locale), `/${locale}${pathname}`]);
  return Object.fromEntries([...entries, ['x-default', `/en${pathname}`]]) as Record<string, string>;
}

export function buildYouTubeLiveMetadata(locale: Locale): Metadata {
  const copy = resolveMetadataCopy(locale);
  const absoluteCanonical = toAbsoluteUrl(copy.canonicalPath);

  return {
    title: copy.title,
    description: copy.description,
    keywords: copy.keywords,
    alternates: {
      canonical: copy.canonicalPath,
      languages: buildLanguageAlternates('/youtube-live'),
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

export function buildYouTubeLiveJsonLd(locale: Locale, items: YouTubeLiveItem[]) {
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
