import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { MusicChartPage } from '@/components/music/MusicChartPage';
import type { Locale } from '@/i18n/config';
import { routing } from '@/i18n/routing';
import { buildMusicPageData } from '@/lib/music/page-data';
import { buildMusicJsonLd, buildMusicMetadata } from '@/lib/music/seo';

interface MusicPageProps {
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

export async function generateMetadata({ params, searchParams }: MusicPageProps): Promise<Metadata> {
  const [{ locale: requestedLocale }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams ?? Promise.resolve(undefined),
  ]);
  const locale = resolveLocale(requestedLocale);
  const pageData = await buildMusicPageData(resolvedSearchParams, locale);

  return buildMusicMetadata(locale, {
    chartType: pageData.chartType,
    countryCode: pageData.country,
    countryName: pageData.countryName,
  });
}

export default async function MusicPage({ params, searchParams }: MusicPageProps) {
  const [{ locale: requestedLocale }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams ?? Promise.resolve(undefined),
  ]);
  const locale = resolveLocale(requestedLocale);
  const pageData = await buildMusicPageData(resolvedSearchParams, locale);
  const jsonLd = buildMusicJsonLd(locale, pageData);

  return <MusicChartPage {...pageData} jsonLd={jsonLd} />;
}
