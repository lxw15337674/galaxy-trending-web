import { MetadataRoute } from 'next';
import { LOCALES } from '@/i18n/config';
import { getLatestSpotifyTopSongsGlobalSnapshot } from '@/lib/spotify/db';
import { getLatestSteamMostPlayedSnapshot } from '@/lib/steam/db';
import { getLatestPublishedTikTokHashtagBatch } from '@/lib/tiktok-hashtag-trends/db';
import { getLatestPublishedXTrendBatch } from '@/lib/x-trends/db';
import { getLatestPublishedBatch } from '@/lib/youtube-hot/db';
import { getLatestYouTubeLiveSnapshot } from '@/lib/youtube-live/db';
import { getLatestYouTubeMusicDailyShortsSongsGlobalSnapshot } from '@/lib/youtube-music/daily-shorts-db';
import { getLatestYouTubeMusicDailyVideosGlobalSnapshot } from '@/lib/youtube-music/daily-videos-db';
import { getLatestYouTubeMusicWeeklyTopSongsGlobalSnapshot } from '@/lib/youtube-music/db';
import { toAbsoluteUrl } from '@/lib/seo/site-origin';

function toValidDate(input: string | null | undefined, fallback: Date) {
  if (!input) return fallback;
  const parsed = new Date(input);
  return Number.isNaN(parsed.valueOf()) ? fallback : parsed;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  let trendingLastModified = now;
  let musicLastModified = now;
  let musicVideosDailyLastModified = now;
  let musicShortsDailyLastModified = now;
  let liveLastModified = now;
  let spotifyLastModified = now;
  let steamLastModified = now;
  let xTrendingLastModified = now;
  let tiktokTrendingLastModified = now;

  try {
    const latestTrendingBatch = await getLatestPublishedBatch();
    trendingLastModified = toValidDate(latestTrendingBatch?.generatedAt, now);
  } catch {
    trendingLastModified = now;
  }

  try {
    const latestMusicSnapshot = await getLatestYouTubeMusicWeeklyTopSongsGlobalSnapshot();
    musicLastModified = toValidDate(latestMusicSnapshot?.fetchedAt, now);
  } catch {
    musicLastModified = now;
  }

  try {
    const latestMusicVideosDailySnapshot = await getLatestYouTubeMusicDailyVideosGlobalSnapshot();
    musicVideosDailyLastModified = toValidDate(latestMusicVideosDailySnapshot?.fetchedAt, now);
  } catch {
    musicVideosDailyLastModified = now;
  }

  try {
    const latestMusicShortsDailySnapshot = await getLatestYouTubeMusicDailyShortsSongsGlobalSnapshot();
    musicShortsDailyLastModified = toValidDate(latestMusicShortsDailySnapshot?.fetchedAt, now);
  } catch {
    musicShortsDailyLastModified = now;
  }

  try {
    const latestLiveSnapshot = await getLatestYouTubeLiveSnapshot();
    liveLastModified = toValidDate(latestLiveSnapshot?.crawledAt, now);
  } catch {
    liveLastModified = now;
  }

  try {
    const latestSpotifySnapshot = await getLatestSpotifyTopSongsGlobalSnapshot();
    spotifyLastModified = toValidDate(latestSpotifySnapshot?.fetchedAt, now);
  } catch {
    spotifyLastModified = now;
  }

  try {
    const latestSteamSnapshot = await getLatestSteamMostPlayedSnapshot();
    steamLastModified = toValidDate(latestSteamSnapshot?.fetchedAt, now);
  } catch {
    steamLastModified = now;
  }

  try {
    const latestXTrendingBatch = await getLatestPublishedXTrendBatch();
    xTrendingLastModified = toValidDate(latestXTrendingBatch?.generatedAt, now);
  } catch {
    xTrendingLastModified = now;
  }

  try {
    const latestTikTokTrendingBatch = await getLatestPublishedTikTokHashtagBatch();
    tiktokTrendingLastModified = toValidDate(latestTikTokTrendingBatch?.generatedAt, now);
  } catch {
    tiktokTrendingLastModified = now;
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
      url: toAbsoluteUrl(`/${locale}/youtube-music`),
      lastModified: musicLastModified,
      changeFrequency: 'daily' as const,
      priority: locale === 'en' ? 0.8 : 0.7,
    },
    {
      url: toAbsoluteUrl(`/${locale}/youtube-music/videos-daily`),
      lastModified: musicVideosDailyLastModified,
      changeFrequency: 'daily' as const,
      priority: locale === 'en' ? 0.8 : 0.7,
    },
    {
      url: toAbsoluteUrl(`/${locale}/youtube-music/shorts-songs-daily`),
      lastModified: musicShortsDailyLastModified,
      changeFrequency: 'daily' as const,
      priority: locale === 'en' ? 0.8 : 0.7,
    },
    {
      url: toAbsoluteUrl(`/${locale}/youtube-live`),
      lastModified: liveLastModified,
      changeFrequency: 'daily' as const,
      priority: locale === 'en' ? 0.6 : 0.5,
    },
    {
      url: toAbsoluteUrl(`/${locale}/spotify`),
      lastModified: spotifyLastModified,
      changeFrequency: 'daily' as const,
      priority: locale === 'en' ? 0.8 : 0.7,
    },
    {
      url: toAbsoluteUrl(`/${locale}/steam`),
      lastModified: steamLastModified,
      changeFrequency: 'hourly' as const,
      priority: locale === 'en' ? 0.8 : 0.7,
    },
    {
      url: toAbsoluteUrl(`/${locale}/x-trending`),
      lastModified: xTrendingLastModified,
      changeFrequency: 'hourly' as const,
      priority: locale === 'en' ? 0.9 : 0.8,
    },
    {
      url: toAbsoluteUrl(`/${locale}/tiktok-trending`),
      lastModified: tiktokTrendingLastModified,
      changeFrequency: 'hourly' as const,
      priority: locale === 'en' ? 0.9 : 0.8,
    },
  ]);
}
