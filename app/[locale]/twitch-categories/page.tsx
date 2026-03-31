import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { TwitchCategoriesGridPage } from '@/components/twitch/TwitchCategoriesGridPage';
import { type Locale } from '@/i18n/config';
import { routing } from '@/i18n/routing';
import { buildTwitchCategoriesPageData } from '@/lib/twitch/page-data';
import { buildTwitchCategoriesJsonLd, buildTwitchCategoriesMetadata } from '@/lib/twitch/seo';

interface TwitchCategoriesPageProps {
  params: Promise<{ locale: string }>;
}

export const revalidate = 600;

function resolveLocale(locale: string): Locale {
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  return locale;
}

export async function generateMetadata({ params }: TwitchCategoriesPageProps): Promise<Metadata> {
  const { locale: requestedLocale } = await params;
  const locale = resolveLocale(requestedLocale);
  return buildTwitchCategoriesMetadata(locale);
}

export default async function TwitchCategoriesPage({ params }: TwitchCategoriesPageProps) {
  const { locale: requestedLocale } = await params;
  const locale = resolveLocale(requestedLocale);
  const pageData = await buildTwitchCategoriesPageData(locale);
  const jsonLd = buildTwitchCategoriesJsonLd(locale, pageData.items);

  return <TwitchCategoriesGridPage initialData={pageData} jsonLd={jsonLd} />;
}
