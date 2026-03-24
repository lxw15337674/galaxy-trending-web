import dayjs from 'dayjs';
import { ThumbsUp } from 'lucide-react';
import type { Locale } from '@/i18n/config';
import { getMessages } from '@/i18n/messages';
import type { YouTubeLiveItem } from '@/lib/youtube-hot/types';
import { YouTubeVideoCard, type YouTubeVideoCardTag } from '@/components/youtubehot/YouTubeVideoCard';

interface YouTubeLiveVideoCardProps {
  item: YouTubeLiveItem;
  locale: Locale;
  categoryLabel: string;
  languageLabel: string;
}

function formatCompactNumber(value: number | null | undefined, locale: Locale) {
  if (value == null || !Number.isFinite(value)) return '--';

  if (locale === 'zh') {
    if (value >= 100000000) return `${(value / 100000000).toFixed(1)}亿`;
    if (value >= 10000) return `${(value / 10000).toFixed(1)}万`;
    return new Intl.NumberFormat('zh-CN').format(value);
  }

  if (value >= 1000000000) return `${(value / 1000000000).toFixed(1)}B`;
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return new Intl.NumberFormat('en-US').format(value);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '--';
  const parsed = dayjs(value);
  if (!parsed.isValid()) return value;
  return parsed.format('MM-DD HH:mm');
}

function formatSubscriberText(item: YouTubeLiveItem, locale: Locale) {
  const t = getMessages(locale).youtubeLive;
  if (item.hiddenSubscriberCount) return t.cardSubscribersHidden;
  return `${formatCompactNumber(item.subscriberCount, locale)} ${t.cardSubscriberSuffix}`;
}

function formatWatchingText(value: number | null | undefined, locale: Locale, t: ReturnType<typeof getMessages>['youtubeLive']) {
  const compact = formatCompactNumber(value, locale);
  if (locale === 'zh') {
    return `${compact}${t.cardWatching}`;
  }
  return `${compact} ${t.cardWatching}`;
}

function buildMetricTag(value: number | null | undefined, locale: Locale): YouTubeVideoCardTag | null {
  if (value == null || !Number.isFinite(value)) return null;

  return {
    text: formatCompactNumber(value, locale),
    variant: 'outline',
    className: 'border-zinc-300 text-zinc-500 dark:border-zinc-700 dark:text-zinc-400',
    icon: <ThumbsUp className="size-3.5" aria-hidden="true" />,
  };
}

export function YouTubeLiveVideoCard({ item, locale, categoryLabel, languageLabel }: YouTubeLiveVideoCardProps) {
  const t = getMessages(locale).youtubeLive;
  const tags: YouTubeVideoCardTag[] = [
    {
      text: languageLabel,
      variant: 'outline',
      className: 'border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300',
    },
    {
      text: categoryLabel,
      variant: 'outline',
      className: 'border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300',
    },
    buildMetricTag(item.likeCount, locale),
  ].filter((tag): tag is YouTubeVideoCardTag => tag !== null);

  return (
    <YouTubeVideoCard
      videoHref={item.videoUrl}
      videoTitle={item.title}
      thumbnailUrl={item.thumbnailUrl}
      noThumbnailText={t.cardNoThumbnail}
      channelHref={item.channelUrl}
      channelTitle={item.channelTitle}
      channelAvatarUrl={item.channelAvatarUrl}
      metaLeft={formatSubscriberText(item, locale)}
      metaRightTop={formatWatchingText(item.concurrentViewers, locale, t)}
      metaRightBottom={formatDateTime(item.startedAt)}
      tags={tags}
    />
  );
}
