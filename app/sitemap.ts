import { MetadataRoute } from 'next';
import { LOCALES } from '@/i18n/config';
import { toAbsoluteUrl } from '@/lib/seo/site-origin';
import { getLatestPublishedBatch } from '@/lib/youtube-hot/db';
import { getLatestYouTubeLiveSnapshot } from '@/lib/youtube-live/db';

function toValidDate(input: string | null | undefined, fallback: Date) {
  if (!input) return fallback;
  const parsed = new Date(input);
  return Number.isNaN(parsed.valueOf()) ? fallback : parsed;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  let trendingLastModified = now;
  let liveLastModified = now;

  try {
    const latestTrendingBatch = await getLatestPublishedBatch();
    trendingLastModified = toValidDate(latestTrendingBatch?.generatedAt, now);
  } catch {
    trendingLastModified = now;
  }

  try {
    const latestLiveSnapshot = await getLatestYouTubeLiveSnapshot();
    liveLastModified = toValidDate(latestLiveSnapshot?.crawledAt, now);
  } catch {
    liveLastModified = now;
  }

  return LOCALES.flatMap((locale) => [
    {
      url: toAbsoluteUrl(`/${locale}`),
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: locale === 'en' ? 0.8 : 0.7,
    },
    {
      url: toAbsoluteUrl(`/${locale}/youtube-trending`),
      lastModified: trendingLastModified,
      changeFrequency: 'hourly' as const,
      priority: locale === 'en' ? 1 : 0.9,
    },
    {
      url: toAbsoluteUrl(`/${locale}/youtube-live`),
      lastModified: liveLastModified,
      changeFrequency: 'daily' as const,
      priority: locale === 'en' ? 0.6 : 0.5,
    },
  ]);
}
