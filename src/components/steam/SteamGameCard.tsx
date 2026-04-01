'use client';

import { YouTubeVideoCard, type YouTubeVideoCardTag } from '@/components/youtubehot/YouTubeVideoCard';
import type { Locale } from '@/i18n/config';
import { getMessages } from '@/i18n/messages';
import type { SteamChartItem } from '@/lib/steam/types';
import { normalizeSteamChartType } from '@/lib/steam/types';

interface SteamGameCardProps {
  item: SteamChartItem;
  locale: Locale;
  chartType: string;
}

function formatCompactNumber(value: number | null | undefined, locale: Locale) {
  if (value == null || value <= 0) return null;
  return new Intl.NumberFormat(locale, {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

export function SteamGameCard({ item, locale, chartType }: SteamGameCardProps) {
  const t = getMessages(locale).steam;
  const normalizedChartType = normalizeSteamChartType(chartType);
  const currentPlayersText = formatCompactNumber(item.currentPlayers, locale);
  const peakTodayText = formatCompactNumber(item.peakToday, locale);
  const tags: YouTubeVideoCardTag[] = [
    {
      text: `#${item.rank}`,
      variant: 'default',
      className: 'bg-sky-700 text-white dark:bg-sky-500 dark:text-zinc-950',
    },
  ];

  if (normalizedChartType === 'most-played') {
    if (currentPlayersText) {
      tags.push({
        text: `${currentPlayersText} ${t.cardCurrentPlayers}`,
        variant: 'outline',
        className: 'border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300',
      });
    }
    if (peakTodayText) {
      tags.push({
        text: `${peakTodayText} ${t.cardPeakToday}`,
        variant: 'outline',
        className: 'border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300',
      });
    }
  } else {
    if (item.priceText) {
      tags.push({
        text: item.priceText,
        variant: 'outline',
        className: 'border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300',
      });
    }
    if (item.discountPercent != null && item.discountPercent !== 0) {
      tags.push({
        text: `${item.discountPercent > 0 ? '-' : ''}${Math.abs(item.discountPercent)}%`,
        variant: 'outline',
        className: 'border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-300',
      });
    }
  }

  return (
    <YouTubeVideoCard
      videoHref={item.steamUrl}
      videoTitle={item.gameName}
      thumbnailUrl={item.thumbnailUrl}
      noThumbnailText={t.cardNoThumbnail}
      channelHref={item.steamUrl}
      channelTitle="Steam"
      channelAvatarUrl={null}
      metaLeft={item.tagSummary || item.releaseDateText || item.priceText || t.platformName}
      metaRightTop={item.originalPriceText || currentPlayersText || undefined}
      metaRightBottom={item.releaseDateText || peakTodayText || undefined}
      tags={tags}
    />
  );
}
