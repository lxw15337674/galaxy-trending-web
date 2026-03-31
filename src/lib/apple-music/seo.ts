import type { Metadata } from 'next';
import type { Locale } from '@/i18n/config';
import { getIntlLocale } from '@/i18n/locale-meta';
import { buildLocaleAlternates } from '@/lib/seo/locale-alternates';
import { toAbsoluteUrl } from '@/lib/seo/site-origin';
import { getLocalizedAppleMusicCountryLabel } from './labels';
import type { AppleMusicChartItem } from './types';

const APPLE_MUSIC_METADATA_TEXT: Record<Locale, { title: string; description: string; keywords: string[] }> = {
  en: {
    title: 'Apple Music Top Songs',
    description: 'Latest public Apple Music Top 100 songs chart with country switching and stable indexable URLs.',
    keywords: ['apple music top songs', 'apple music chart', 'apple music top 100', 'apple music country chart'],
  },
  zh: {
    title: 'Apple Music 热门歌曲榜',
    description: '基于 Apple Music 公开榜单页抓取的 Top 100 歌曲榜，支持国家切换。',
    keywords: ['Apple Music 榜单', 'Apple Music 热门歌曲', 'Apple Music Top 100', 'Apple Music 国家榜'],
  },
  es: {
    title: 'Top Songs de Apple Music',
    description: 'Ranking Top 100 de canciones de Apple Music obtenido de páginas públicas con cambio por país.',
    keywords: ['apple music top songs', 'apple music top 100', 'ranking apple music', 'apple music por país'],
  },
  ja: {
    title: 'Apple Music 人気楽曲チャート',
    description: 'Apple Music の公開チャートページをもとにした Top 100 楽曲ランキング。国切り替えに対応しています。',
    keywords: ['apple music トップソング', 'apple music top 100', 'apple music チャート', 'apple music 国別'],
  },
};

interface AppleMusicMetadataOptions {
  countryCode?: string;
  countryName?: string;
}

function buildCountryDescriptionSuffix(locale: Locale, countryLabel: string) {
  if (locale === 'zh') return `当前国家：${countryLabel}。`;
  if (locale === 'es') return `País actual: ${countryLabel}.`;
  if (locale === 'ja') return `現在の国: ${countryLabel}。`;
  return `Current country: ${countryLabel}.`;
}

function buildLocaleAlternatesWithCountry(countryCode: string | undefined) {
  const alternates = buildLocaleAlternates('/apple-music');
  if (!countryCode || countryCode === 'global') {
    return alternates;
  }

  const querySuffix = `?country=${encodeURIComponent(countryCode)}`;
  return Object.fromEntries(Object.entries(alternates).map(([key, value]) => [key, `${value}${querySuffix}`]));
}

function resolveMetadataText(locale: Locale, options?: AppleMusicMetadataOptions) {
  const base = APPLE_MUSIC_METADATA_TEXT[locale];
  const normalizedCountryCode = options?.countryCode?.trim() || 'global';
  const countryLabel =
    normalizedCountryCode !== 'global'
      ? getLocalizedAppleMusicCountryLabel(normalizedCountryCode, options?.countryName, locale)
      : null;
  const canonicalPath =
    normalizedCountryCode !== 'global'
      ? `/${locale}/apple-music?country=${encodeURIComponent(normalizedCountryCode)}`
      : `/${locale}/apple-music`;

  return {
    title: countryLabel ? `${base.title} - ${countryLabel}` : base.title,
    description: countryLabel ? `${base.description} ${buildCountryDescriptionSuffix(locale, countryLabel)}` : base.description,
    keywords: base.keywords,
    canonicalPath,
    alternates: buildLocaleAlternatesWithCountry(countryLabel ? normalizedCountryCode : undefined),
    inLanguage: getIntlLocale(locale),
  };
}

export function buildAppleMusicMetadata(locale: Locale, options?: AppleMusicMetadataOptions): Metadata {
  const t = resolveMetadataText(locale, options);
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

export function buildAppleMusicJsonLd(locale: Locale, items: AppleMusicChartItem[], options?: AppleMusicMetadataOptions) {
  const t = resolveMetadataText(locale, options);
  const itemListElement = items.slice(0, 10).map((item, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: item.trackName,
    url: item.appleSongUrl ?? toAbsoluteUrl(t.canonicalPath),
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
