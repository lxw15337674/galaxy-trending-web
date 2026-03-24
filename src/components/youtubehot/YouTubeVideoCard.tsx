import Image from 'next/image';
import type { ReactNode } from 'react';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export interface YouTubeVideoCardTag {
  text: string;
  icon?: ReactNode;
  variant?: BadgeProps['variant'];
  title?: string;
  className?: string;
}

type YouTubeVideoCardProps =
  | {
      loading: true;
      tagsCount?: number;
    }
  | {
      loading?: false;
      videoHref: string;
      videoTitle: string;
      thumbnailUrl: string | null;
      noThumbnailText: string;
      channelHref: string;
      channelTitle: string;
      channelAvatarUrl: string | null;
      metaLeft: string;
      metaRightTop?: string | null;
      metaRightBottom?: string | null;
      tags: YouTubeVideoCardTag[];
    };

const CARD_CLASS =
  'flex h-full flex-col overflow-hidden rounded-2xl border-0 bg-transparent p-2 text-zinc-900 shadow-sm transition-all duration-300 ease-out hover:bg-zinc-100 hover:shadow-md hover:ring-1 hover:ring-zinc-200/90 dark:text-zinc-100 dark:hover:bg-zinc-800/70 dark:hover:ring-zinc-700/70';
const MEDIA_CLASS = 'relative block aspect-video w-full overflow-hidden rounded-2xl bg-zinc-100 dark:bg-zinc-900';
const HEADER_CLASS = 'flex flex-col  p-1 ';
const CONTENT_CLASS = 'mt-auto flex flex-col gap-2 p-0 pt-0';

export function YouTubeVideoCard(props: YouTubeVideoCardProps) {
  if (props.loading) {
    const tagsCount = props.tagsCount ?? 4;
    return (
      <Card className={CARD_CLASS} aria-hidden="true">
        <Skeleton className={`${MEDIA_CLASS} bg-zinc-200 dark:bg-zinc-800`} />

        <CardHeader className={HEADER_CLASS}>
          <Skeleton className="h-5 w-full bg-zinc-200 dark:bg-zinc-800" />
          <Skeleton className="h-5 w-4/5 bg-zinc-200 dark:bg-zinc-800" />
        </CardHeader>

        <CardContent className={CONTENT_CLASS}>
          <div className="flex items-start gap-2">
            <Skeleton className="mt-0.5 size-8 rounded-full bg-zinc-200 dark:bg-zinc-800" />
            <div className="flex min-w-0 flex-1 items-start justify-between gap-2">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <Skeleton className="h-4 w-2/3 bg-zinc-200 dark:bg-zinc-800" />
                <Skeleton className="h-4 w-1/2 bg-zinc-200 dark:bg-zinc-800" />
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <Skeleton className="h-4 w-16 bg-zinc-200 dark:bg-zinc-800" />
                <Skeleton className="h-3 w-10 bg-zinc-200 dark:bg-zinc-800" />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {Array.from({ length: tagsCount }).map((_, index) => (
              <Skeleton key={index} className="h-7 w-24 rounded-full bg-zinc-200 dark:bg-zinc-800" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={CARD_CLASS}>
      <a href={props.videoHref} target="_blank" rel="noreferrer" className={MEDIA_CLASS}>
        {props.thumbnailUrl ? (
          <Image
            src={props.thumbnailUrl}
            alt={props.videoTitle}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 25vw"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-base text-zinc-500 dark:text-zinc-400">{props.noThumbnailText}</div>
        )}
      </a>

      <CardHeader className={HEADER_CLASS}>
        <a href={props.videoHref} target="_blank" rel="noreferrer" className="line-clamp-2 text-base font-semibold leading-6 hover:underline">
          {props.videoTitle}
        </a>
      </CardHeader>

      <CardContent className={CONTENT_CLASS}>
        <div className="flex items-start gap-2">
          <a
            href={props.channelHref}
            target="_blank"
            rel="noreferrer"
            className="relative block size-8 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700"
          >
            {props.channelAvatarUrl ? (
              <Image src={props.channelAvatarUrl} alt={props.channelTitle} fill sizes="32px" className="object-cover" />
            ) : null}
          </a>
          <div className="flex min-w-0 flex-1 items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <a href={props.channelHref} target="_blank" rel="noreferrer" className="block truncate text-xs leading-4 text-zinc-800 hover:underline dark:text-zinc-100">
                {props.channelTitle}
              </a>
              <p className="truncate text-xs leading-4 text-zinc-500 dark:text-zinc-300">{props.metaLeft}</p>
            </div>
            {props.metaRightTop || props.metaRightBottom ? (
              <span className="flex shrink-0 flex-col items-end text-right">
                {props.metaRightTop ? <span className="text-xs leading-4 font-medium text-zinc-600 dark:text-zinc-200">{props.metaRightTop}</span> : null}
                {props.metaRightBottom ? <span className="text-xs leading-4 text-zinc-500 dark:text-zinc-300">{props.metaRightBottom}</span> : null}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {props.tags.map((tag, index) => (
            <Badge key={`${tag.text}-${index}`} variant={tag.variant} title={tag.title} className={cn('text-xs', tag.className)}>
              {tag.icon ? <span className="mr-1 inline-flex items-center">{tag.icon}</span> : null}
              {tag.text}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
