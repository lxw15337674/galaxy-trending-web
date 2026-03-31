'use client';

import type { ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { Locale } from '@/i18n/config';
import { formatRelativeUpdate } from '@/i18n/format';

interface TwitchChartScaffoldMessages {
  title: string;
  subtitle: string;
  updatedAtLabel: string;
  emptyState: string;
  chartSelectorLabel: string;
  tabLive: string;
  tabCategories: string;
}

interface TwitchChartScaffoldProps {
  locale: Locale;
  chartType: 'live' | 'categories';
  fetchedAt: string;
  errorMessage?: string | null;
  jsonLd?: unknown;
  t: TwitchChartScaffoldMessages;
  filters?: ReactNode;
  children?: ReactNode;
}

const PAGE_SECTION_CLASS = 'mx-auto w-full px-4 pt-2 md:px-6 md:pt-6 lg:w-[80%]';

export function TwitchChartScaffold({
  locale,
  chartType,
  fetchedAt,
  errorMessage,
  jsonLd,
  t,
  filters,
  children,
}: TwitchChartScaffoldProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const chartOptions = [
    { value: `/${locale}/twitch-live`, label: t.tabLive },
    { value: `/${locale}/twitch-categories`, label: t.tabCategories },
  ];
  const currentChartPath = chartType === 'categories' ? `/${locale}/twitch-categories` : `/${locale}/twitch-live`;

  const updateChart = (nextPath: string) => {
    if (nextPath === pathname) return;
    const query = nextPath.endsWith('/twitch-live') ? searchParams.toString() : '';
    router.replace(query ? `${nextPath}?${query}` : nextPath, { scroll: false });
  };

  return (
    <main
      suppressHydrationWarning
      className="min-h-screen bg-gradient-to-b from-zinc-100 via-zinc-50 to-white pb-10 text-zinc-900 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 dark:text-zinc-100"
    >
      {jsonLd ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} /> : null}
      <h1 className="sr-only">{t.title}</h1>
      <section className={PAGE_SECTION_CLASS}>
        <div className="mb-4 max-w-3xl">
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 md:text-3xl">{t.title}</h2>
          <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{t.subtitle}</p>
        </div>

        <Card className="border-zinc-200 bg-white/90 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/85">
          <CardHeader className="p-2 md:p-3">
            <div className="flex flex-wrap items-end gap-2">
              <div className="w-full min-[360px]:w-[220px] sm:w-[240px]">
                <div className="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">{t.chartSelectorLabel}</div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="h-10 w-full justify-between">
                      <span className="truncate">
                        {chartOptions.find((option) => option.value === currentChartPath)?.label ?? t.tabLive}
                      </span>
                      <ChevronDown className="size-4 opacity-60" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="min-w-[190px]">
                    {chartOptions.map((option) => {
                      const isActive = option.value === currentChartPath;
                      return (
                        <DropdownMenuItem key={option.value} onClick={() => updateChart(option.value)}>
                          <span>{option.label}</span>
                          {isActive ? <Check className="ml-auto size-4" /> : null}
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {filters}

              <span className="text-xs text-zinc-500 dark:text-zinc-400 sm:ml-auto sm:self-end">
                {t.updatedAtLabel} {formatRelativeUpdate(fetchedAt, locale)}
              </span>
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
