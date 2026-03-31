import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { AppleMusicGridPage } from '@/components/applemusic/AppleMusicGridPage';
import type { Locale } from '@/i18n/config';
import { routing } from '@/i18n/routing';
import { buildAppleMusicPageData } from '@/lib/apple-music/page-data';
import { buildAppleMusicJsonLd, buildAppleMusicMetadata } from '@/lib/apple-music/seo';

interface AppleMusicPageProps {
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

export async function generateMetadata({ params, searchParams }: AppleMusicPageProps): Promise<Metadata> {
  const [{ locale: requestedLocale }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams ?? Promise.resolve(undefined),
  ]);
  const locale = resolveLocale(requestedLocale);
  const pageData = await buildAppleMusicPageData(resolvedSearchParams, locale);

  return buildAppleMusicMetadata(locale, {
    countryCode: pageData.country,
    countryName: pageData.countryName,
  });
}

export default async function AppleMusicPage({ params, searchParams }: AppleMusicPageProps) {
  const [{ locale: requestedLocale }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams ?? Promise.resolve(undefined),
  ]);
  const locale = resolveLocale(requestedLocale);
  const pageData = await buildAppleMusicPageData(resolvedSearchParams, locale);
  const jsonLd = buildAppleMusicJsonLd(locale, pageData.items, {
    countryCode: pageData.country,
    countryName: pageData.countryName,
  });

  return <AppleMusicGridPage {...pageData} jsonLd={jsonLd} />;
}
