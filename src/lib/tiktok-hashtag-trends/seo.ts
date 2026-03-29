import type { Metadata } from 'next';
import { type Locale } from '@/i18n/config';
import { getMessages } from '@/i18n/messages';
import { getIntlLocale } from '@/i18n/locale-meta';
import { buildLocaleAlternates } from '@/lib/seo/locale-alternates';
import { toAbsoluteUrl } from '@/lib/seo/site-origin';
import type { TikTokHashtagQueryItem } from './types';

export function buildTikTokTrendMetadata(locale: Locale): Metadata {
  const t = getMessages(locale).tiktokTrending;
  const canonicalPath = `/${locale}/tiktok-trending`;
  const absoluteCanonical = toAbsoluteUrl(canonicalPath);

  return {
    title: t.metadataTitle,
    description: t.metadataDescription,
    keywords: [
      'tiktok trends',
      'tiktok trending hashtags',
      'tiktok hashtag ranking',
      'tiktok trends by country',
      'tiktok hashtags by country',
      'tiktok creative center trends',
      'tiktok hot hashtags',
      'tiktok trending topics',
    ],
    alternates: {
      canonical: absoluteCanonical,
      languages: buildLocaleAlternates('/tiktok-trending'),
    },
    openGraph: {
      type: 'website',
      url: absoluteCanonical,
      title: t.metadataTitle,
      description: t.metadataDescription,
      locale: getIntlLocale(locale),
      siteName: 'Galaxy Trending',
    },
    twitter: {
      card: 'summary_large_image',
      title: t.metadataTitle,
      description: t.metadataDescription,
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export function buildTikTokTrendJsonLd(
  locale: Locale,
  items: TikTokHashtagQueryItem[],
  countryName: string | null,
) {
  const t = getMessages(locale).tiktokTrending;
  const canonicalPath = `/${locale}/tiktok-trending`;
  const itemListElement = items.slice(0, 10).map((item, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: `#${item.hashtagName}`,
    url: item.publicTagUrl,
  }));

  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: countryName ? `${t.title} - ${countryName}` : t.title,
    description: t.metadataDescription,
    url: toAbsoluteUrl(canonicalPath),
    inLanguage: getIntlLocale(locale),
    mainEntity: {
      '@type': 'ItemList',
      name: countryName ? `${countryName} ${t.title}` : t.title,
      itemListOrder: 'https://schema.org/ItemListOrderAscending',
      numberOfItems: itemListElement.length,
      itemListElement,
    },
  };
}
