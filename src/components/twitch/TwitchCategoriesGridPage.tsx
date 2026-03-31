'use client';

import { TwitchCategoryCard } from '@/components/twitch/TwitchCategoryCard';
import { TwitchChartScaffold } from '@/components/twitch/TwitchChartScaffold';
import { getMessages } from '@/i18n/messages';
import type { TwitchCategoriesPageData } from '@/lib/twitch/page-data';

interface TwitchCategoriesGridPageProps {
  initialData: TwitchCategoriesPageData;
  jsonLd?: unknown;
}

const CARD_GRID_CLASS = 'mt-2 grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-4';

export function TwitchCategoriesGridPage({ initialData, jsonLd }: TwitchCategoriesGridPageProps) {
  const t = getMessages(initialData.locale).twitchCategories;

  return (
    <TwitchChartScaffold
      locale={initialData.locale}
      chartType="categories"
      fetchedAt={initialData.fetchedAt}
      errorMessage={initialData.errorMessage}
      jsonLd={jsonLd}
      t={t}
    >
      {!initialData.errorMessage && initialData.items.length > 0 ? (
        <div className={CARD_GRID_CLASS}>
          {initialData.items.map((item, index) => (
            <TwitchCategoryCard
              key={item.gameId}
              name={item.name}
              boxArtUrl={item.boxArtUrl}
              href={item.directoryUrl}
              rank={index + 1}
            />
          ))}
        </div>
      ) : null}
    </TwitchChartScaffold>
  );
}
