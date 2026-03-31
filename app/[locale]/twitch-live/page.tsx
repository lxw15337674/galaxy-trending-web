import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { TwitchLiveGridPage } from '@/components/twitch/TwitchLiveGridPage';
import { type Locale } from '@/i18n/config';
import { routing } from '@/i18n/routing';
import { type SearchParamsInput } from '@/lib/server/search-params';
import { buildTwitchLivePageData } from '@/lib/twitch/page-data';
import { buildTwitchLiveJsonLd, buildTwitchLiveMetadata } from '@/lib/twitch/seo';

interface TwitchLivePageProps {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<SearchParamsInput>;
}

export const revalidate = 120;

function resolveLocale(locale: string): Locale {
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  return locale;
}

export async function generateMetadata({ params }: Pick<TwitchLivePageProps, 'params'>): Promise<Metadata> {
  const { locale: requestedLocale } = await params;
  const locale = resolveLocale(requestedLocale);
  return buildTwitchLiveMetadata(locale);
}

export default async function TwitchLivePage({ params, searchParams }: TwitchLivePageProps) {
  const [{ locale: requestedLocale }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams ?? Promise.resolve(undefined),
  ]);
  const locale = resolveLocale(requestedLocale);
  const pageData = await buildTwitchLivePageData(resolvedSearchParams, locale);
  const jsonLd = buildTwitchLiveJsonLd(locale, pageData.items);

  return <TwitchLiveGridPage initialData={pageData} jsonLd={jsonLd} />;
}
