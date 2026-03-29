import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { YouTubeMusicDailyShortsPage } from '@/components/youtubehot/YouTubeMusicDailyShortsPage';
import type { Locale } from '@/i18n/config';
import { routing } from '@/i18n/routing';
import { buildYouTubeMusicDailyShortsSongsPageData } from '@/lib/youtube-music/daily-shorts-page-data';
import {
  buildYouTubeMusicDailyShortsSongsJsonLd,
  buildYouTubeMusicDailyShortsSongsMetadata,
} from '@/lib/youtube-music/daily-shorts-seo';

interface YouTubeMusicDailyShortsRouteProps {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export const revalidate = 600;

function resolveLocale(locale: string): Locale {
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  return locale;
}

export async function generateMetadata({ params }: YouTubeMusicDailyShortsRouteProps): Promise<Metadata> {
  const { locale: requestedLocale } = await params;
  const locale = resolveLocale(requestedLocale);
  return buildYouTubeMusicDailyShortsSongsMetadata(locale);
}

export default async function YouTubeMusicDailyShortsRoute({
  params,
  searchParams,
}: YouTubeMusicDailyShortsRouteProps) {
  const [{ locale: requestedLocale }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams ?? Promise.resolve(undefined),
  ]);
  const locale = resolveLocale(requestedLocale);
  const pageData = await buildYouTubeMusicDailyShortsSongsPageData(resolvedSearchParams, locale);
  const jsonLd = buildYouTubeMusicDailyShortsSongsJsonLd(locale, pageData.items);

  return <YouTubeMusicDailyShortsPage {...pageData} jsonLd={jsonLd} />;
}
