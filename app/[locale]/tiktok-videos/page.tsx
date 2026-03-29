import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { TikTokVideoGridPage } from '@/components/tiktokvideos/TikTokVideoGridPage';
import { type Locale } from '@/i18n/config';
import { getMessages } from '@/i18n/messages';
import { routing } from '@/i18n/routing';
import { getRequestCountryCode } from '@/lib/server/request-country';
import { type SearchParamsInput } from '@/lib/server/search-params';
import { buildTikTokVideoPageData } from '@/lib/tiktok-videos/page-data';

interface TikTokVideoPageProps {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<SearchParamsInput>;
}

export const revalidate = 600;

function resolveLocale(locale: string): Locale {
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  return locale;
}

export async function generateMetadata({ params }: Pick<TikTokVideoPageProps, 'params'>): Promise<Metadata> {
  const { locale: requestedLocale } = await params;
  const locale = resolveLocale(requestedLocale);
  const t = getMessages(locale).tiktokVideos;

  return {
    title: t.metadataTitle,
    description: t.metadataDescription,
  };
}

export default async function TikTokVideoPage({ params, searchParams }: TikTokVideoPageProps) {
  const [{ locale: requestedLocale }, requestHeaders, resolvedSearchParams] = await Promise.all([
    params,
    headers(),
    searchParams ?? Promise.resolve(undefined),
  ]);
  const locale = resolveLocale(requestedLocale);
  const userCountry = getRequestCountryCode(requestHeaders)?.toUpperCase() ?? null;
  const pageData = await buildTikTokVideoPageData(resolvedSearchParams, locale, userCountry);

  return <TikTokVideoGridPage initialData={pageData} userCountry={userCountry} />;
}
