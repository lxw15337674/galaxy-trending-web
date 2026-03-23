import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import type { Locale } from '@/i18n/config';
import { getMessages } from '@/i18n/messages';
import { getYouTubeCategoryLabel } from '@/lib/youtube-hot/labels';
import type { YouTubeHotQueryItem } from '@/lib/youtube-hot/types';

interface YouTubeHotVideoCardProps {
  item: YouTubeHotQueryItem;
  locale: Locale;
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

export function YouTubeHotVideoCard({ item, locale }: YouTubeHotVideoCardProps) {
  const t = getMessages(locale).youtubeHot;
  const regionCount = item.aggregateRegionCount ?? item.aggregateRegionCodes?.length ?? 0;
  const categoryLabel = getYouTubeCategoryLabel(item.categoryId, item.categoryTitle, locale);

  return (
    <Card className="flex h-full flex-col overflow-hidden rounded-2xl border-0 bg-transparent p-2 text-zinc-900 shadow-sm transition-colors duration-500 ease-out hover:bg-zinc-100/80 dark:text-zinc-100 dark:hover:bg-zinc-800/70">
      <a
        href={item.videoUrl}
        target="_blank"
        rel="noreferrer"
        className="relative block aspect-video w-full overflow-hidden rounded-2xl bg-zinc-100 dark:bg-zinc-900"
      >
        {item.thumbnailUrl ? (
          <Image
            src={item.thumbnailUrl}
            alt={item.title}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 25vw"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-base text-zinc-500 dark:text-zinc-400">{t.cardNoThumbnail}</div>
        )}
      </a>

      <CardHeader className="flex flex-col gap-2 p-2 pb-2">
        <a
          href={item.videoUrl}
          target="_blank"
          rel="noreferrer"
          className="line-clamp-2 text-base font-semibold leading-6 hover:underline"
        >
          {item.title}
        </a>
      </CardHeader>

      <CardContent className="mt-auto flex flex-col gap-2 p-0 pt-0">
        <div className="flex items-start gap-2">
          <a
            href={item.channelUrl}
            target="_blank"
            rel="noreferrer"
            className="relative mt-0.5 block size-8 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700"
          >
            {item.channelAvatarUrl ? (
              <Image src={item.channelAvatarUrl} alt={item.channelTitle} fill sizes="32px" className="object-cover" />
            ) : null}
          </a>
          <div className="min-w-0 flex-1">
            <a
              href={item.channelUrl}
              target="_blank"
              rel="noreferrer"
              className="block truncate text-sm leading-5 text-zinc-800 hover:underline dark:text-zinc-100"
            >
              {item.channelTitle}
            </a>
            <p className="text-sm leading-5 text-zinc-500 dark:text-zinc-300">{formatSubscriberText(item, locale, t)}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant={item.isGlobalAggregate ? 'default' : 'secondary'} className="text-sm">
            {formatRegionCount(regionCount, locale)}
          </Badge>
          <Badge variant="outline" className="border-zinc-300 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
            {t.cardViews} {formatCompactNumber(item.viewCount, locale)}
          </Badge>
          <Badge
            variant="outline"
            className="border-zinc-300 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"
            title={item.publishedAt ?? ''}
          >
            {t.cardPublished} {formatPublishedDate(item.publishedAt)}
          </Badge>
          <Badge variant="secondary" className="text-sm">
            {categoryLabel}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
