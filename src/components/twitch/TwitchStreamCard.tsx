'use client';

import { YouTubeVideoCard, type YouTubeVideoCardTag } from '@/components/youtubehot/YouTubeVideoCard';
import type { Locale } from '@/i18n/config';
import { formatCompactNumber, formatMonthDayTime } from '@/i18n/format';
import { usesTightUnitSpacing } from '@/i18n/locale-meta';
import { getMessages } from '@/i18n/messages';
import type { TwitchTopStreamItem } from '@/lib/twitch/types';

interface TwitchStreamCardProps {
  item: TwitchTopStreamItem;
  locale: Locale;
  rank: number;
}

function formatViewers(viewers: number, locale: Locale, label: string) {
  const compact = formatCompactNumber(viewers, locale);
  return usesTightUnitSpacing(locale) ? `${compact}${label}` : `${compact} ${label}`;
}

export function TwitchStreamCard({ item, locale, rank }: TwitchStreamCardProps) {
  const t = getMessages(locale).twitchLive;
  const tags: YouTubeVideoCardTag[] = [
    {
      text: `#${rank}`,
      variant: 'default',
      className: 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950',
    },
  ];

  if (item.gameName) {
    tags.push({
      text: item.gameName,
      variant: 'outline',
      className: 'border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300',
    });
  }

  if (item.language) {
    tags.push({
      text: item.language.toUpperCase(),
      variant: 'outline',
      className: 'border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300',
    });
  }

  if (item.isMature) {
    tags.push({
      text: t.cardMature,
      variant: 'outline',
      className: 'border-rose-300 text-rose-700 dark:border-rose-900 dark:text-rose-300',
    });
  }

  return (
    <YouTubeVideoCard
      videoHref={item.streamUrl}
      videoTitle={item.title}
      thumbnailUrl={item.thumbnailUrl}
      noThumbnailText={t.cardNoThumbnail}
      channelHref={item.streamUrl}
      channelTitle={item.userName}
      channelAvatarUrl={item.channelAvatarUrl}
      metaLeft={item.userName}
      metaRightTop={formatViewers(item.viewerCount, locale, t.cardViewers)}
      metaRightBottom={`${t.cardStartedAt} ${formatMonthDayTime(item.startedAt, locale)}`}
      tags={tags}
    />
  );
}
