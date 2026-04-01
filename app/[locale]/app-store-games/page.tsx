import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { AppStoreGameGridPage } from '@/components/appstoregames/AppStoreGameGridPage';
import type { Locale } from '@/i18n/config';
import { routing } from '@/i18n/routing';
import { buildAppStoreGamesPageData } from '@/lib/app-store-games/page-data';
import { buildAppStoreGamesJsonLd, buildAppStoreGamesMetadata } from '@/lib/app-store-games/seo';

interface AppStoreGamesPageProps {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export const revalidate = 3600;

function resolveLocale(locale: string): Locale {
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  return locale;
}

export async function generateMetadata({ params, searchParams }: AppStoreGamesPageProps): Promise<Metadata> {
  const [{ locale: requestedLocale }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams ?? Promise.resolve(undefined),
  ]);
  const locale = resolveLocale(requestedLocale);
  const pageData = await buildAppStoreGamesPageData(resolvedSearchParams, locale);

  return buildAppStoreGamesMetadata(locale, {
    countryCode: pageData.country,
    countryName: pageData.countryName,
  });
}

export default async function AppStoreGamesPage({ params, searchParams }: AppStoreGamesPageProps) {
  const [{ locale: requestedLocale }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams ?? Promise.resolve(undefined),
  ]);
  const locale = resolveLocale(requestedLocale);
  const pageData = await buildAppStoreGamesPageData(resolvedSearchParams, locale);
  const jsonLd = buildAppStoreGamesJsonLd(locale, pageData.sections.flatMap((section) => section.items), {
    countryCode: pageData.country,
    countryName: pageData.countryName,
  });

  return <AppStoreGameGridPage {...pageData} jsonLd={jsonLd} />;
}
