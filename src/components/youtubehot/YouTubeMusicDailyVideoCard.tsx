import { YouTubeVideoCard, type YouTubeVideoCardTag } from '@/components/youtubehot/YouTubeVideoCard';
import type { Locale } from '@/i18n/config';
import { formatCompactNumber } from '@/i18n/format';
import { usesTightUnitSpacing } from '@/i18n/locale-meta';
import { getMessages } from '@/i18n/messages';
import type { YouTubeMusicDailyVideoItem } from '@/lib/youtube-music/types';

interface YouTubeMusicDailyVideoCardProps {
  item: YouTubeMusicDailyVideoItem;
  locale: Locale;
  chartEndDate: string;
  fallbackHref: string;
}

function formatChartEndDate(value: string, locale: Locale) {
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.valueOf())) return value;

  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    timeZone: 'UTC',
  }).format(parsed);
}

function buildPreviousRankTag(item: YouTubeMusicDailyVideoItem, locale: Locale): YouTubeVideoCardTag {
  const t = getMessages(locale).youtubeMusicVideosDaily;
  if (item.previousRank == null || item.previousRank <= 0) {
    return {
      text: t.cardNewEntry,
      variant: 'outline',
      className: 'border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-300',
    };
  }

  return {
    text: `${t.cardPreviousRank} #${item.previousRank}`,
    variant: 'outline',
    className: 'border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300',
  };
}

function buildDaysTag(item: YouTubeMusicDailyVideoItem, locale: Locale): YouTubeVideoCardTag | null {
  const t = getMessages(locale).youtubeMusicVideosDaily;
  if (item.periodsOnChart == null || item.periodsOnChart <= 0) return null;

  return {
    text: `${item.periodsOnChart} ${t.cardDaysOnChart}`,
    variant: 'outline',
    className: 'border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300',
  };
}

function formatViewsText(
  value: number | null | undefined,
  locale: Locale,
  t: ReturnType<typeof getMessages>['youtubeMusicVideosDaily'],
) {
  const compact = formatCompactNumber(value, locale);
  if (usesTightUnitSpacing(locale)) {
    return `${compact}${t.cardViews}`;
  }
  return `${compact} ${t.cardViews}`;
}

export function YouTubeMusicDailyVideoCard({
  item,
  locale,
  chartEndDate,
  fallbackHref,
}: YouTubeMusicDailyVideoCardProps) {
  const t = getMessages(locale).youtubeMusicVideosDaily;
  const videoHref = item.youtubeUrl ?? fallbackHref;
  const tags = [
    {
      text: `#${item.rank}`,
      variant: 'default' as const,
      className: 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950',
    },
    buildPreviousRankTag(item, locale),
    buildDaysTag(item, locale),
  ].filter((tag): tag is YouTubeVideoCardTag => Boolean(tag));

  return (
    <YouTubeVideoCard
      videoHref={videoHref}
      videoTitle={item.videoTitle}
      thumbnailUrl={item.thumbnailUrl}
      noThumbnailText={t.cardNoThumbnail}
      channelHref={videoHref}
      channelTitle={item.channelName ?? item.artistNames}
      channelAvatarUrl={null}
      metaLeft={item.artistNames}
      metaRightTop={formatViewsText(item.views, locale, t)}
      metaRightBottom={`${t.cardChartDate} ${formatChartEndDate(chartEndDate, locale)}`}
      tags={tags}
    />
  );
}
