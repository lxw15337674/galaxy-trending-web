import type { Metadata } from 'next';
import type { Locale } from '@/i18n/config';
import { getIntlLocale } from '@/i18n/locale-meta';
import { buildLocaleAlternates } from '@/lib/seo/locale-alternates';
import { toAbsoluteUrl } from '@/lib/seo/site-origin';
import type { YouTubeMusicDailyVideoItem } from './types';

const METADATA_TEXT: Record<Locale, { title: string; description: string; keywords: string[] }> = {
  en: {
    title: 'YouTube Music Daily Top Videos',
    description: 'Latest official YouTube Music daily top videos chart from charts.youtube.com.',
    keywords: ['youtube music daily top videos', 'youtube music daily videos', 'music videos daily chart'],
  },
  zh: {
    title: 'YouTube Music 每日热门音乐视频榜',
    description: '来自 charts.youtube.com 的官方 YouTube Music 每日热门音乐视频榜。',
    keywords: ['YouTube Music 日榜', 'YouTube Music 音乐视频榜', '每日热门音乐视频'],
  },
  es: {
    title: 'Daily Top Videos de YouTube Music',
    description: 'Último ranking oficial diario de videos musicales de YouTube Music desde charts.youtube.com.',
    keywords: ['youtube music daily top videos', 'videos diarios youtube music', 'ranking diario videos musicales'],
  },
  ja: {
    title: 'YouTube Music デイリー人気動画チャート',
    description: 'charts.youtube.com から取得した公式の YouTube Music デイリー人気動画チャートです。',
    keywords: ['youtube music デイリー動画', 'youtube music 人気動画', 'デイリー音楽動画'],
  },
};

function resolveMetadataText(locale: Locale) {
  return {
    ...METADATA_TEXT[locale],
    canonicalPath: `/${locale}/youtube-music/videos-daily`,
    inLanguage: getIntlLocale(locale),
  };
}

export function buildYouTubeMusicDailyVideosMetadata(locale: Locale): Metadata {
  const t = resolveMetadataText(locale);
  const absoluteCanonical = toAbsoluteUrl(t.canonicalPath);

  return {
    title: t.title,
    description: t.description,
    keywords: t.keywords,
    alternates: {
      canonical: absoluteCanonical,
      languages: buildLocaleAlternates('/youtube-music/videos-daily'),
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

export function buildYouTubeMusicDailyVideosJsonLd(locale: Locale, items: YouTubeMusicDailyVideoItem[]) {
  const t = resolveMetadataText(locale);
  const itemListElement = items.slice(0, 10).map((item, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: item.videoTitle,
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
