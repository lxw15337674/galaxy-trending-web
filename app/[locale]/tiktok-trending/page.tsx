import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { TikTokTrendGridPage } from '@/components/tiktoktrends/TikTokTrendGridPage';
import { type Locale } from '@/i18n/config';
import { routing } from '@/i18n/routing';
import { getRequestCountryCode } from '@/lib/server/request-country';
import { type SearchParamsInput } from '@/lib/server/search-params';
import { buildTikTokTrendPageData } from '@/lib/tiktok-hashtag-trends/page-data';
import { buildTikTokTrendJsonLd, buildTikTokTrendMetadata } from '@/lib/tiktok-hashtag-trends/seo';

interface TikTokTrendPageProps {
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

export async function generateMetadata({ params }: Pick<TikTokTrendPageProps, 'params'>): Promise<Metadata> {
  const { locale: requestedLocale } = await params;
  const locale = resolveLocale(requestedLocale);
  return buildTikTokTrendMetadata(locale);
}

export default async function TikTokTrendPage({ params, searchParams }: TikTokTrendPageProps) {
  const [{ locale: requestedLocale }, requestHeaders, resolvedSearchParams] = await Promise.all([
    params,
    headers(),
    searchParams ?? Promise.resolve(undefined),
  ]);
  const locale = resolveLocale(requestedLocale);
  const userCountry = getRequestCountryCode(requestHeaders)?.toUpperCase() ?? null;
  const pageData = await buildTikTokTrendPageData(resolvedSearchParams, locale, userCountry);
  const jsonLd = buildTikTokTrendJsonLd(locale, pageData.items, pageData.countryName);

  return <TikTokTrendGridPage initialData={pageData} userCountry={userCountry} jsonLd={jsonLd} />;
}
