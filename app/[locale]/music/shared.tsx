import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { MusicChartPage } from '@/components/music/MusicChartPage';
import type { Locale } from '@/i18n/config';
import { routing } from '@/i18n/routing';
import { buildMusicPageData } from '@/lib/music/page-data';
import { buildMusicJsonLd, buildMusicMetadata } from '@/lib/music/seo';
import {
  createURLSearchParams,
  type SearchParamsInput,
  type SearchParamsObject,
} from '@/lib/server/search-params';
import { toAbsoluteUrl } from '@/lib/seo/site-origin';
import type { MusicChartType } from '@/lib/music/types';

export interface MusicPageProps {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function resolveLocale(locale: string): Locale {
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  return locale;
}

function forceMusicChartType(
  rawSearchParams: SearchParamsInput,
  chartType?: MusicChartType,
): SearchParamsInput {
  if (!chartType) {
    return rawSearchParams;
  }

  const params = createURLSearchParams(rawSearchParams);
  params.set('type', chartType);

  const nextSearchParams: SearchParamsObject = {};

  for (const [key, value] of params.entries()) {
    const current = nextSearchParams[key];

    if (current === undefined) {
      nextSearchParams[key] = value;
      continue;
    }

    nextSearchParams[key] = Array.isArray(current) ? [...current, value] : [current, value];
  }

  return nextSearchParams;
}

function buildMusicCanonicalPath(locale: Locale, searchParams: SearchParamsInput): string {
  const query = createURLSearchParams(searchParams).toString();
  return query ? `/${locale}/music?${query}` : `/${locale}/music`;
}

export async function generateMusicRouteMetadata(
  { params, searchParams }: MusicPageProps,
  chartType?: MusicChartType,
): Promise<Metadata> {
  const [{ locale: requestedLocale }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams ?? Promise.resolve(undefined),
  ]);
  const locale = resolveLocale(requestedLocale);
  const effectiveSearchParams = forceMusicChartType(resolvedSearchParams, chartType);
  const pageData = await buildMusicPageData(effectiveSearchParams, locale);
  const metadata = buildMusicMetadata(locale, {
    chartType: pageData.chartType,
    countryCode: pageData.country,
    countryName: pageData.countryName,
  });

  if (!chartType) {
    return metadata;
  }

  return {
    ...metadata,
    alternates: {
      canonical: toAbsoluteUrl(buildMusicCanonicalPath(locale, effectiveSearchParams)),
    },
  };
}

export async function renderMusicRoute(
  { params, searchParams }: MusicPageProps,
  chartType?: MusicChartType,
) {
  const [{ locale: requestedLocale }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams ?? Promise.resolve(undefined),
  ]);
  const locale = resolveLocale(requestedLocale);
  const effectiveSearchParams = forceMusicChartType(resolvedSearchParams, chartType);
  const pageData = await buildMusicPageData(effectiveSearchParams, locale);
  const jsonLd = buildMusicJsonLd(locale, pageData);

  return <MusicChartPage {...pageData} jsonLd={jsonLd} />;
}
