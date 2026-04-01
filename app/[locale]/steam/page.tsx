import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { SteamGridPage } from '@/components/steam/SteamGridPage';
import type { Locale } from '@/i18n/config';
import { routing } from '@/i18n/routing';
import { buildSteamPageData } from '@/lib/steam/page-data';
import { buildSteamJsonLd, buildSteamMetadata } from '@/lib/steam/seo';

interface SteamPageProps {
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

export async function generateMetadata({ params, searchParams }: SteamPageProps): Promise<Metadata> {
  const [{ locale: requestedLocale }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams ?? Promise.resolve(undefined),
  ]);
  const locale = resolveLocale(requestedLocale);
  const pageData = await buildSteamPageData(resolvedSearchParams, locale);

  return buildSteamMetadata(locale, pageData.chartType);
}

export default async function SteamPage({ params, searchParams }: SteamPageProps) {
  const [{ locale: requestedLocale }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams ?? Promise.resolve(undefined),
  ]);
  const locale = resolveLocale(requestedLocale);
  const pageData = await buildSteamPageData(resolvedSearchParams, locale);
  const jsonLd = buildSteamJsonLd(locale, pageData.items, pageData.chartType);

  return <SteamGridPage {...pageData} jsonLd={jsonLd} />;
}
