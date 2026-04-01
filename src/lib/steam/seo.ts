import type { Metadata } from 'next';
import type { Locale } from '@/i18n/config';
import { getIntlLocale } from '@/i18n/locale-meta';
import { buildLocaleAlternates } from '@/lib/seo/locale-alternates';
import { toAbsoluteUrl } from '@/lib/seo/site-origin';
import type { SteamChartItem, SteamChartType } from './types';
import { normalizeSteamChartType } from './types';

const STEAM_METADATA_TEXT: Record<Locale, { title: string; description: string; keywords: string[] }> = {
  en: {
    title: 'Steam Game Charts',
    description: 'Latest Steam game charts with Most Played, Top Sellers, and Popular New Releases on one stable page.',
    keywords: ['steam charts', 'steam most played', 'steam top sellers', 'steam new releases'],
  },
  zh: {
    title: 'Steam 游戏榜',
    description: '聚合 Steam 热门、畅销和新作趋势榜，统一展示最近一次成功抓取结果。',
    keywords: ['Steam 榜单', 'Steam 热门游戏', 'Steam 畅销榜', 'Steam 新游趋势'],
  },
  es: {
    title: 'Charts de juegos de Steam',
    description: 'Últimos charts de Steam con Most Played, Top Sellers y Popular New Releases en una sola página.',
    keywords: ['steam charts', 'steam most played', 'steam top sellers', 'steam new releases'],
  },
  ja: {
    title: 'Steam ゲームチャート',
    description: 'Steam の人気、売上、新作トレンドをまとめて確認できるチャートページです。',
    keywords: ['steam charts', 'steam most played', 'steam top sellers', 'steam new releases'],
  },
};

function getLocalizedChartLabel(locale: Locale, chartType: SteamChartType) {
  if (locale === 'zh') {
    if (chartType === 'top-sellers') return '畅销榜';
    if (chartType === 'trending') return '趋势榜';
    return '热门榜';
  }
  if (locale === 'es') {
    if (chartType === 'top-sellers') return 'Top Sellers';
    if (chartType === 'trending') return 'Nuevos lanzamientos populares';
    return 'Más jugados';
  }
  if (locale === 'ja') {
    if (chartType === 'top-sellers') return '売上上位';
    if (chartType === 'trending') return '人気の新作';
    return '人気プレイ中';
  }
  if (chartType === 'top-sellers') return 'Top Sellers';
  if (chartType === 'trending') return 'Popular New Releases';
  return 'Most Played';
}

function buildAlternates(chartType: SteamChartType) {
  const alternates = buildLocaleAlternates('/steam');
  if (chartType === 'most-played') {
    return alternates;
  }

  const querySuffix = `?chart=${encodeURIComponent(chartType)}`;
  return Object.fromEntries(Object.entries(alternates).map(([key, value]) => [key, `${value}${querySuffix}`]));
}

function resolveMetadataText(locale: Locale, chartTypeInput?: string) {
  const base = STEAM_METADATA_TEXT[locale];
  const chartType = normalizeSteamChartType(chartTypeInput);
  const chartLabel = getLocalizedChartLabel(locale, chartType);
  const canonicalPath = chartType === 'most-played' ? `/${locale}/steam` : `/${locale}/steam?chart=${encodeURIComponent(chartType)}`;

  return {
    title: `${base.title} - ${chartLabel}`,
    description: `${base.description} ${chartLabel}.`,
    keywords: base.keywords,
    canonicalPath,
    alternates: buildAlternates(chartType),
    inLanguage: getIntlLocale(locale),
  };
}

export function buildSteamMetadata(locale: Locale, chartTypeInput?: string): Metadata {
  const t = resolveMetadataText(locale, chartTypeInput);
  const absoluteCanonical = toAbsoluteUrl(t.canonicalPath);

  return {
    title: t.title,
    description: t.description,
    keywords: t.keywords,
    alternates: {
      canonical: absoluteCanonical,
      languages: t.alternates,
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

export function buildSteamJsonLd(locale: Locale, items: SteamChartItem[], chartTypeInput?: string) {
  const t = resolveMetadataText(locale, chartTypeInput);
  const itemListElement = items.slice(0, 10).map((item, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: item.gameName,
    url: item.steamUrl ?? toAbsoluteUrl(t.canonicalPath),
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
