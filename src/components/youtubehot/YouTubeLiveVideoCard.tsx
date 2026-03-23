import dayjs from 'dayjs';
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

function formatViewsText(value: number | null | undefined, locale: Locale, t: ReturnType<typeof getMessages>['youtubeLive']) {
  const compact = formatCompactNumber(value, locale);
  if (locale === 'zh') {
    return `${compact}次观看`;
  }
  return `${compact} ${t.cardViews}`;
}

export function YouTubeLiveVideoCard({ item, locale, categoryLabel, languageLabel }: YouTubeLiveVideoCardProps) {
  const t = getMessages(locale).youtubeLive;
  const tags: YouTubeVideoCardTag[] = [
    { text: `#${item.rank}`, variant: 'default' },
    { text: `${formatCompactNumber(item.concurrentViewers, locale)} ${t.cardWatching}`, variant: 'secondary' },
    {
      text: categoryLabel,
      variant: 'outline',
      className: 'border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300',
    },
    {
      text: languageLabel,
      variant: 'outline',
      className: 'border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300',
    },
  ];

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
      metaRightTop={formatViewsText(item.viewCount, locale, t)}
      metaRightBottom={formatDateTime(item.startedAt)}
      tags={tags}
    />
  );
}
