import type { Metadata } from 'next';
import type { Locale } from '@/i18n/config';
import { getIntlLocale } from '@/i18n/locale-meta';
import { buildLocaleAlternates } from '@/lib/seo/locale-alternates';
import { toAbsoluteUrl } from '@/lib/seo/site-origin';
import type { TwitchTopCategoryItem, TwitchTopStreamItem } from './types';

const TWITCH_LIVE_TEXT: Record<Locale, { title: string; description: string; keywords: string[] }> = {
  zh: {
    title: 'Twitch 热门直播榜',
    description: '基于 Twitch 官方 API 聚合的热门直播列表，支持语言与分类筛选。',
    keywords: ['Twitch 直播榜', 'Twitch 热门直播', 'Twitch 官方 API', 'Twitch 直播排行'],
  },
  en: {
    title: 'Twitch Top Streams',
    description: 'Top Twitch live streams aggregated from the official Twitch API with language and category filters.',
    keywords: ['twitch top streams', 'twitch live ranking', 'twitch official api', 'twitch trending live'],
  },
  es: {
    title: 'Directos populares de Twitch',
    description: 'Lista de directos populares de Twitch agregada desde la API oficial con filtros por idioma y categoría.',
    keywords: ['twitch directos', 'twitch streams populares', 'api oficial twitch', 'ranking twitch'],
  },
  ja: {
    title: 'Twitch 人気ライブ',
    description: 'Twitch 公式 API を使って集計した人気ライブ配信一覧。言語とカテゴリで絞り込めます。',
    keywords: ['twitch 人気配信', 'twitch ライブランキング', 'twitch 公式 api', 'twitch 配信一覧'],
  },
};

const TWITCH_CATEGORIES_TEXT: Record<Locale, { title: string; description: string; keywords: string[] }> = {
  zh: {
    title: 'Twitch 热门类别榜',
    description: '基于 Twitch 官方 API 聚合的热门类别列表，按平台热度排序展示。',
    keywords: ['Twitch 类别榜', 'Twitch 热门游戏', 'Twitch 热门分类', 'Twitch 官方 API'],
  },
  en: {
    title: 'Twitch Top Categories',
    description: 'Top Twitch categories aggregated from the official Twitch API and ordered by platform popularity.',
    keywords: ['twitch top categories', 'twitch top games', 'twitch category ranking', 'twitch official api'],
  },
  es: {
    title: 'Categorías populares de Twitch',
    description: 'Categorías populares de Twitch agregadas desde la API oficial y ordenadas por popularidad en la plataforma.',
    keywords: ['categorias twitch', 'top games twitch', 'ranking categorias twitch', 'api oficial twitch'],
  },
  ja: {
    title: 'Twitch 人気カテゴリ',
    description: 'Twitch 公式 API を使って集計した人気カテゴリ一覧。プラットフォーム上の人気順で表示します。',
    keywords: ['twitch 人気カテゴリ', 'twitch 人気ゲーム', 'twitch カテゴリランキング', 'twitch 公式 api'],
  },
};

function buildMetadata(text: { title: string; description: string; keywords: string[] }, locale: Locale, pathname: string): Metadata {
  const absoluteCanonical = toAbsoluteUrl(pathname);
  return {
    title: text.title,
    description: text.description,
    keywords: text.keywords,
    alternates: {
      canonical: absoluteCanonical,
      languages: buildLocaleAlternates(pathname.replace(`/${locale}`, '')),
    },
    openGraph: {
      type: 'website',
      url: absoluteCanonical,
      title: text.title,
      description: text.description,
      locale: getIntlLocale(locale),
      siteName: 'Galaxy Trending',
    },
    twitter: {
      card: 'summary_large_image',
      title: text.title,
      description: text.description,
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export function buildTwitchLiveMetadata(locale: Locale) {
  return buildMetadata(TWITCH_LIVE_TEXT[locale], locale, `/${locale}/twitch-live`);
}

export function buildTwitchCategoriesMetadata(locale: Locale) {
  return buildMetadata(TWITCH_CATEGORIES_TEXT[locale], locale, `/${locale}/twitch-categories`);
}

export function buildTwitchLiveJsonLd(locale: Locale, items: TwitchTopStreamItem[]) {
  const text = TWITCH_LIVE_TEXT[locale];
  const pathname = `/${locale}/twitch-live`;
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: text.title,
    description: text.description,
    url: toAbsoluteUrl(pathname),
    inLanguage: getIntlLocale(locale),
    mainEntity: {
      '@type': 'ItemList',
      itemListOrder: 'https://schema.org/ItemListOrderDescending',
      numberOfItems: Math.min(10, items.length),
      itemListElement: items.slice(0, 10).map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.userName,
        url: item.streamUrl,
      })),
    },
  };
}

export function buildTwitchCategoriesJsonLd(locale: Locale, items: TwitchTopCategoryItem[]) {
  const text = TWITCH_CATEGORIES_TEXT[locale];
  const pathname = `/${locale}/twitch-categories`;
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: text.title,
    description: text.description,
    url: toAbsoluteUrl(pathname),
    inLanguage: getIntlLocale(locale),
    mainEntity: {
      '@type': 'ItemList',
      itemListOrder: 'https://schema.org/ItemListOrderDescending',
      numberOfItems: Math.min(10, items.length),
      itemListElement: items.slice(0, 10).map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
        url: item.directoryUrl,
      })),
    },
  };
}
