import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { YouTubeMusicDailyVideosPage } from '@/components/youtubehot/YouTubeMusicDailyVideosPage';
import type { Locale } from '@/i18n/config';
import { routing } from '@/i18n/routing';
import { buildYouTubeMusicDailyVideosPageData } from '@/lib/youtube-music/daily-videos-page-data';
import {
  buildYouTubeMusicDailyVideosJsonLd,
  buildYouTubeMusicDailyVideosMetadata,
} from '@/lib/youtube-music/daily-videos-seo';

interface YouTubeMusicDailyVideosRouteProps {
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

export async function generateMetadata({ params }: YouTubeMusicDailyVideosRouteProps): Promise<Metadata> {
  const { locale: requestedLocale } = await params;
  const locale = resolveLocale(requestedLocale);
  return buildYouTubeMusicDailyVideosMetadata(locale);
}

export default async function YouTubeMusicDailyVideosRoute({
  params,
  searchParams,
}: YouTubeMusicDailyVideosRouteProps) {
  const [{ locale: requestedLocale }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams ?? Promise.resolve(undefined),
  ]);
  const locale = resolveLocale(requestedLocale);
  const pageData = await buildYouTubeMusicDailyVideosPageData(resolvedSearchParams, locale);
  const jsonLd = buildYouTubeMusicDailyVideosJsonLd(locale, pageData.items);

  return <YouTubeMusicDailyVideosPage {...pageData} jsonLd={jsonLd} />;
}
