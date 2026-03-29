'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { startTransition, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { type ComboboxOption } from '@/components/ui/combobox';
import { FilterCombobox } from '@/components/ui/filter-combobox';
import { TikTokTrendCard } from '@/components/tiktoktrends/TikTokTrendCard';
import { formatRelativeUpdate } from '@/i18n/format';
import { getMessages } from '@/i18n/messages';
import { prioritizePreferredItem } from '@/lib/filters/prioritize-preferred-item';
import { createRegionDisplayNames, getLocalizedYouTubeRegionLabel } from '@/lib/youtube-hot/labels';
import type { TikTokTrendPageData } from '@/lib/tiktok-hashtag-trends/page-data';

interface TikTokTrendGridPageProps {
  initialData: TikTokTrendPageData;
  userCountry?: string | null;
  jsonLd?: unknown;
}

function buildCountryOptions(
  countries: TikTokTrendPageData['countries'],
  userCountry: string | null | undefined,
  locale: TikTokTrendPageData['locale'],
) {
  const sortedCountries = prioritizePreferredItem(countries, (item) => item.countryCode, userCountry?.toUpperCase());
  const regionDisplayNames = createRegionDisplayNames(locale);
  return sortedCountries.map((country) => ({
    value: country.countryCode,
    label: getLocalizedYouTubeRegionLabel(country.countryCode, country.countryName, locale, regionDisplayNames),
    keywords: [country.countryCode, country.countryName],
  })) satisfies ComboboxOption[];
}

export function TikTokTrendGridPage({ initialData, userCountry, jsonLd }: TikTokTrendGridPageProps) {
  const t = getMessages(initialData.locale).tiktokTrending;
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedCountry, setSelectedCountry] = useState(initialData.focusCountry);
  const regionDisplayNames = createRegionDisplayNames(initialData.locale);
  const countryOptions = buildCountryOptions(initialData.countries, userCountry, initialData.locale);
  const localizedCountryName = getLocalizedYouTubeRegionLabel(
    initialData.focusCountry,
    initialData.countryName ?? initialData.focusCountry,
    initialData.locale,
    regionDisplayNames,
  );

  useEffect(() => {
    setSelectedCountry(initialData.focusCountry);
  }, [initialData.focusCountry]);

  const onCountryChange = (value: string) => {
    const nextCountry = value.trim().toUpperCase();
    if (!nextCountry || nextCountry === selectedCountry) return;

    setSelectedCountry(nextCountry);
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set('country', nextCountry);
    const nextQuery = nextParams.toString();

    startTransition(() => {
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
    });
  };

  return (
    <main
      suppressHydrationWarning
      className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(251,146,60,0.18),transparent_28%),linear-gradient(180deg,#fff7ed_0%,#fffaf5_35%,#ffffff_100%)] pb-12 text-zinc-950 dark:bg-[radial-gradient(circle_at_top,rgba(251,146,60,0.18),transparent_24%),linear-gradient(180deg,#161012_0%,#120d0f_38%,#09090b_100%)] dark:text-zinc-100"
    >
      {jsonLd ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} /> : null}
      <h1 className="sr-only">{t.title}</h1>

      <section className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 pt-4 md:px-6 md:pt-8">
        <Card className="overflow-hidden border-orange-200/80 bg-white/90 shadow-[0_20px_70px_rgba(251,146,60,0.12)] dark:border-orange-950/60 dark:bg-zinc-950/80">
          <CardHeader className="space-y-4 p-5 md:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-600 dark:text-orange-300">
                  TikTok Creative Center
                </div>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 md:text-4xl">
                  {t.title}
                </h2>
                <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300 md:text-base">{t.subtitle}</p>
              </div>

              <div className="w-full lg:w-[320px]">
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                  {t.filterCountryLabel}
                </div>
                <FilterCombobox
                  options={countryOptions}
                  value={selectedCountry}
                  placeholder={t.filterCountrySearchPlaceholder}
                  emptyText={t.filterNoMatch}
                  clearLabel={t.clearSearch}
                  disabled={countryOptions.length === 0}
                  onValueChange={onCountryChange}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <BadgeLabel label={t.currentCountryLabel} value={localizedCountryName} tone="accent" />
              <BadgeLabel label={t.countriesLabel} value={String(initialData.totalCountries)} />
              <BadgeLabel label={t.itemsLabel} value={String(initialData.items.length)} />
              <BadgeLabel label={t.updatedAtLabel} value={formatRelativeUpdate(initialData.generatedAt, initialData.locale)} />
              <a
                href={initialData.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:border-orange-300 hover:text-zinc-950 dark:border-zinc-800 dark:bg-white/5 dark:text-zinc-200 dark:hover:border-orange-900"
              >
                {t.openOfficialSource}
              </a>
            </div>
          </CardHeader>
        </Card>

        {initialData.errorMessage ? (
          <Card className="border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/30">
            <CardContent className="p-4 text-base text-red-700 dark:text-red-200">{initialData.errorMessage}</CardContent>
          </Card>
        ) : null}

        {!initialData.errorMessage && initialData.items.length === 0 ? (
          <Card className="border-zinc-200 bg-white/90 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/70">
            <CardContent className="p-10 text-center text-zinc-500 dark:text-zinc-400">{t.emptyState}</CardContent>
          </Card>
        ) : null}

        {initialData.items.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {initialData.items.map((item) => (
              <TikTokTrendCard
                key={`${item.snapshotHour}-${item.countryCode}-${item.rank}-${item.hashtagId}`}
                item={item}
                locale={initialData.locale}
              />
            ))}
          </div>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-[1.15fr,0.85fr]">
          <Card className="border-zinc-200 bg-white/90 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/70">
            <CardContent className="space-y-6 p-6 md:p-7">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">{t.seoSectionTitle}</h2>
                <div className="mt-5 space-y-5 text-sm leading-7 text-zinc-600 dark:text-zinc-300 md:text-[15px]">
                  <div>
                    <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{t.seoIntroHeading}</h3>
                    <p className="mt-2">{t.seoIntroBody}</p>
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{t.seoMethodHeading}</h3>
                    <p className="mt-2">{t.seoMethodBody}</p>
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{t.seoUsageHeading}</h3>
                    <p className="mt-2">{t.seoUsageBody}</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <InfoCard title={t.infoSourceTitle} body={t.infoSourceBody} />
                <InfoCard title={t.infoCadenceTitle} body={t.infoCadenceBody} />
                <InfoCard title={t.infoMetricsTitle} body={t.infoMetricsBody} />
              </div>
            </CardContent>
          </Card>

          <Card className="border-zinc-200 bg-white/90 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/70">
            <CardContent className="space-y-5 p-6 md:p-7">
              <h2 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">{t.faqTitle}</h2>
              <FaqItem question={t.faqLoginQuestion} answer={t.faqLoginAnswer} />
              <FaqItem question={t.faqCountryQuestion} answer={t.faqCountryAnswer} />
              <FaqItem question={t.faqHistoryQuestion} answer={t.faqHistoryAnswer} />
            </CardContent>
          </Card>
        </section>
      </section>
    </main>
  );
}

function BadgeLabel({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'accent';
}) {
  const className =
    tone === 'accent'
      ? 'border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-900/60 dark:bg-orange-950/30 dark:text-orange-200'
      : 'border-zinc-200 bg-white text-zinc-700 dark:border-zinc-800 dark:bg-white/5 dark:text-zinc-200';

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-4 py-2 text-sm font-medium ${className}`}>
      <span className="opacity-70">{label}</span>
      <span>{value}</span>
    </span>
  );
}

function InfoCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-3xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-white/[0.03]">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{body}</p>
    </div>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  return (
    <div className="rounded-3xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-white/[0.03]">
      <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{question}</h3>
      <p className="mt-2 text-sm leading-7 text-zinc-600 dark:text-zinc-300">{answer}</p>
    </div>
  );
}
