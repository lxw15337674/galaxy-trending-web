import type { Locale } from '@/i18n/config';
import { getMessages } from '@/i18n/messages';
import { getYouTubeCategoryLabel } from '@/lib/youtube-hot/labels';
import type { YouTubeHotQueryItem } from '@/lib/youtube-hot/types';
import { YouTubeVideoCard, type YouTubeVideoCardTag } from '@/components/youtubehot/YouTubeVideoCard';

type YouTubeHotVideoCardProps =
  | {
      loading: true;
      locale?: Locale;
      item?: never;
    }
  | {
      loading?: false;
      locale: Locale;
      item: YouTubeHotQueryItem;
    };

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

function formatPublishedDate(value: string | null | undefined) {
  if (!value) return '--';
  const normalized = value.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(normalized)) {
    return normalized.slice(5, 10);
  }
  return value;
}

function formatSubscriberText(item: YouTubeHotQueryItem, locale: Locale, t: ReturnType<typeof getMessages>['youtubeHot']) {
  if (item.hiddenSubscriberCount) {
    return t.cardSubscribersHidden;
  }
  return `${formatCompactNumber(item.subscriberCount, locale)} ${t.cardSubscriberSuffix}`;
}

function formatRegionCount(regionCount: number, locale: Locale) {
  return locale === 'zh' ? `${regionCount} 地区上榜` : `${regionCount} regions listed`;
}

function formatViewsText(value: number | null | undefined, locale: Locale, t: ReturnType<typeof getMessages>['youtubeHot']) {
  const compact = formatCompactNumber(value, locale);
  if (locale === 'zh') {
    return `${compact}次观看`;
  }
  return `${compact} ${t.cardViews}`;
}

export function YouTubeHotVideoCard(props: YouTubeHotVideoCardProps) {
  if (props.loading) {
    return <YouTubeVideoCard loading tagsCount={2} />;
  }

  const item = props.item;
  const locale = props.locale;
  const t = getMessages(locale).youtubeHot;
  const regionCount = item.aggregateRegionCount ?? item.aggregateRegionCodes?.length ?? 0;
  const categoryLabel = getYouTubeCategoryLabel(item.categoryId, item.categoryTitle, locale);

  const tags: YouTubeVideoCardTag[] = [
    {
      text: formatRegionCount(regionCount, locale),
      variant: item.isGlobalAggregate ? 'default' : 'secondary',
    },
    {
      text: categoryLabel,
      variant: 'secondary',
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
      metaLeft={formatSubscriberText(item, locale, t)}
      metaRightTop={formatViewsText(item.viewCount, locale, t)}
      metaRightBottom={formatPublishedDate(item.publishedAt)}
      tags={tags}
    />
  );
}
