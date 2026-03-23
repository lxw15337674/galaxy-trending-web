import { MetadataRoute } from 'next';
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

  return [
    {
      url: toAbsoluteUrl('/en/youtube-trending'),
      lastModified: trendingLastModified,
      changeFrequency: 'hourly',
      priority: 1,
    },
    {
      url: toAbsoluteUrl('/en/youtube-live'),
      lastModified: liveLastModified,
      changeFrequency: 'daily',
      priority: 0.6,
    },
    {
      url: toAbsoluteUrl('/zh/youtube-trending'),
      lastModified: trendingLastModified,
      changeFrequency: 'hourly',
      priority: 0.9,
    },
    {
      url: toAbsoluteUrl('/zh/youtube-live'),
      lastModified: liveLastModified,
      changeFrequency: 'daily',
      priority: 0.5,
    },
  ];
}
