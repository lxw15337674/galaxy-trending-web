import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { YouTubeLiveGridPage } from '@/components/youtubehot/YouTubeLiveGridPage';
import { type Locale, withLocalePrefix } from '@/i18n/config';
import { getMessages } from '@/i18n/messages';
import { routing } from '@/i18n/routing';
import { buildYouTubeLivePageData } from '@/lib/youtube-live/page-data';

interface YouTubeLivePageProps {
  params: Promise<{ locale: string }>;
}

export const dynamic = 'force-dynamic';

function resolveLocale(locale: string): Locale {
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  return locale;
}

export async function generateMetadata({ params }: YouTubeLivePageProps): Promise<Metadata> {
  const { locale: requestedLocale } = await params;
  const locale = resolveLocale(requestedLocale);
  const t = getMessages(locale).youtubeLive;
  const canonical = withLocalePrefix('/youtube-live', locale);

  return {
    title: t.metadataTitle,
    description: t.metadataDescription,
    alternates: {
      canonical,
      languages: {
        'zh-CN': '/zh/youtube-live',
        en: '/en/youtube-live',
        'x-default': '/en/youtube-live',
      },
    },
  };
}

export default async function YouTubeLivePage({ params }: YouTubeLivePageProps) {
  const { locale: requestedLocale } = await params;
  const locale = resolveLocale(requestedLocale);
  const pageData = await buildYouTubeLivePageData(locale);

  return <YouTubeLiveGridPage {...pageData} />;
}

