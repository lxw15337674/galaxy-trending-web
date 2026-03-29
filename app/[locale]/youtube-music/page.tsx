import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { YouTubeMusicGridPage } from '@/components/youtubehot/YouTubeMusicGridPage';
import type { Locale } from '@/i18n/config';
import { routing } from '@/i18n/routing';
import { buildYouTubeMusicPageData } from '@/lib/youtube-music/page-data';
import { buildYouTubeMusicJsonLd, buildYouTubeMusicMetadata } from '@/lib/youtube-music/seo';

interface YouTubeMusicPageProps {
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

export async function generateMetadata({ params }: YouTubeMusicPageProps): Promise<Metadata> {
  const { locale: requestedLocale } = await params;
  const locale = resolveLocale(requestedLocale);
  return buildYouTubeMusicMetadata(locale);
}

export default async function YouTubeMusicPage({ params, searchParams }: YouTubeMusicPageProps) {
  const [{ locale: requestedLocale }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams ?? Promise.resolve(undefined),
  ]);
  const locale = resolveLocale(requestedLocale);
  const pageData = await buildYouTubeMusicPageData(resolvedSearchParams, locale);
  const jsonLd = buildYouTubeMusicJsonLd(locale, pageData.items);

  return <YouTubeMusicGridPage {...pageData} jsonLd={jsonLd} />;
}
