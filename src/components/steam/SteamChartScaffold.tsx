'use client';

import type { ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { Locale } from '@/i18n/config';
import { formatRelativeUpdate } from '@/i18n/format';
import type { SteamChartOption } from '@/lib/steam/types';
import { normalizeSteamChartType } from '@/lib/steam/types';

interface SteamChartScaffoldMessages {
  title: string;
  subtitle: string;
  chartSelectorLabel: string;
  updatedAtLabel: string;
  emptyState: string;
  openOfficialChart: string;
}

interface SteamChartScaffoldProps {
  locale: Locale;
  t: SteamChartScaffoldMessages;
  chartType: string;
  charts: SteamChartOption[];
  fetchedAt: string | null;
  sourceUrl: string;
  errorMessage?: string | null;
  jsonLd?: unknown;
  children?: ReactNode;
}

const PAGE_SECTION_CLASS = 'mx-auto w-full px-4 pt-6 md:px-6 md:pt-8 lg:w-[80%]';

export function SteamChartScaffold({
  locale,
  t,
  chartType,
  charts,
  fetchedAt,
  sourceUrl,
  errorMessage,
  jsonLd,
  children,
}: SteamChartScaffoldProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateChart = (nextChart: string) => {
    const normalizedChart = normalizeSteamChartType(nextChart);
    const next = new URLSearchParams(searchParams.toString());
    if (normalizedChart === 'most-played') {
      next.delete('chart');
    } else {
      next.set('chart', normalizedChart);
    }

    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-100 via-zinc-50 to-white pb-10 text-zinc-900 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 dark:text-zinc-100">
      {jsonLd ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} /> : null}
      <section className={PAGE_SECTION_CLASS}>
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 md:text-3xl">{t.title}</h1>
            <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{t.subtitle}</p>
          </div>
          {sourceUrl ? (
            <Button variant="outline" asChild className="w-full md:w-auto">
              <a href={sourceUrl} target="_blank" rel="noreferrer">
                {t.openOfficialChart}
              </a>
            </Button>
          ) : null}
        </div>

        <Card className="border-zinc-200 bg-white/90 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/85">
          <CardHeader className="p-2 md:p-3">
            <div className="flex flex-wrap items-end gap-2">
              <div className="w-full min-[360px]:w-[240px] sm:w-[260px]">
                <div className="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">{t.chartSelectorLabel}</div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="h-10 w-full justify-between">
                      <span className="truncate">{charts.find((item) => item.chartType === chartType)?.chartLabel ?? charts[0]?.chartLabel}</span>
                      <ChevronDown className="size-4 opacity-60" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="min-w-[220px]">
                    {charts.map((item) => {
                      const isActive = item.chartType === chartType;
                      return (
                        <DropdownMenuItem key={item.chartType} onClick={() => updateChart(item.chartType)}>
                          <span>{item.chartLabel}</span>
                          {isActive ? <Check className="ml-auto size-4" /> : null}
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {fetchedAt ? (
                <span className="text-xs text-zinc-500 dark:text-zinc-400 sm:ml-auto sm:self-end">
                  {t.updatedAtLabel} {formatRelativeUpdate(fetchedAt, locale)}
                </span>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="hidden" />
        </Card>

        {errorMessage ? (
          <Card className="mt-2 border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/30">
            <CardContent className="p-4 text-base text-red-700 dark:text-red-200">{errorMessage}</CardContent>
          </Card>
        ) : null}

        {!errorMessage && !children ? (
          <Card className="mt-2 border-zinc-200 bg-white/90 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80">
            <CardContent className="p-10 text-center text-zinc-500 dark:text-zinc-400">{t.emptyState}</CardContent>
          </Card>
        ) : null}

        {children}
      </section>
    </main>
  );
}
