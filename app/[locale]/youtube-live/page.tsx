import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { YouTubeLiveGridPage } from '@/components/youtubehot/YouTubeLiveGridPage';
import { type Locale } from '@/i18n/config';
import { routing } from '@/i18n/routing';
import { buildYouTubeLivePageData } from '@/lib/youtube-live/page-data';
import { buildYouTubeLiveJsonLd, buildYouTubeLiveMetadata } from '@/lib/youtube-live/seo';

interface YouTubeLivePageProps {
  params: Promise<{ locale: string }>;
}

export const revalidate = 180;

function resolveLocale(locale: string): Locale {
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  return locale;
}

export async function generateMetadata({ params }: YouTubeLivePageProps): Promise<Metadata> {
  const { locale: requestedLocale } = await params;
  const locale = resolveLocale(requestedLocale);
  return buildYouTubeLiveMetadata(locale);
}

export default async function YouTubeLivePage({ params }: YouTubeLivePageProps) {
  const { locale: requestedLocale } = await params;
  const locale = resolveLocale(requestedLocale);
  const pageData = await buildYouTubeLivePageData(locale);
  const jsonLd = buildYouTubeLiveJsonLd(locale, pageData.items);

  return <YouTubeLiveGridPage {...pageData} jsonLd={jsonLd} />;
}

