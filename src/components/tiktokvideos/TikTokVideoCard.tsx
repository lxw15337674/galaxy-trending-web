'use client';

import Image from 'next/image';
import { Clock3 } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Locale } from '@/i18n/config';
import { formatRelativeUpdate } from '@/i18n/format';
import { getMessages } from '@/i18n/messages';
import type { TikTokVideoQueryItem } from '@/lib/tiktok-videos/types';

interface TikTokVideoCardProps {
  item: TikTokVideoQueryItem;
  locale: Locale;
}

function formatDuration(durationSeconds: number | null) {
  if (!Number.isFinite(durationSeconds) || (durationSeconds ?? 0) <= 0) return null;
  const total = Math.max(0, Math.floor(durationSeconds ?? 0));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function getPeriodLabel(period: number, t: ReturnType<typeof getMessages>['tiktokVideos']) {
  return period === 30 ? t.periodLast30Days : t.periodLast7Days;
}

function getSortLabel(orderBy: TikTokVideoQueryItem['orderBy'], t: ReturnType<typeof getMessages>['tiktokVideos']) {
  switch (orderBy) {
    case 'like':
      return t.sortLike;
    case 'comment':
      return t.sortComments;
    case 'repost':
      return t.sortShares;
    default:
      return t.sortHot;
  }
}

export function TikTokVideoCard({ item, locale }: TikTokVideoCardProps) {
  const t = getMessages(locale).tiktokVideos;
  const durationLabel = formatDuration(item.durationSeconds);
  const locationLabel = item.regionName || item.countryName || item.countryCode;

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm transition-all duration-200 hover:shadow-md hover:ring-1 hover:ring-zinc-200 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:ring-zinc-700">
      <a
        href={item.itemUrl}
        target="_blank"
        rel="noreferrer"
        className="relative block aspect-video overflow-hidden bg-zinc-100 dark:bg-zinc-900"
      >
        {item.coverUrl ? (
          <Image
            src={item.coverUrl}
            alt={item.title}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1536px) 50vw, 33vw"
            className="object-cover transition duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-zinc-500 dark:text-zinc-400">
            {t.cardNoCover}
          </div>
        )}

        <div className="absolute left-3 top-3 inline-flex items-center rounded-full bg-white/96 px-2.5 py-1 text-xs font-semibold text-zinc-900 shadow-sm dark:bg-zinc-950/92 dark:text-zinc-100">
          #{item.rank}
        </div>

        {durationLabel ? (
          <div className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-md bg-black/78 px-2 py-1 text-[11px] font-medium text-white">
            <Clock3 className="size-3" />
            <span>{durationLabel}</span>
          </div>
        ) : null}
      </a>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <a
          href={item.itemUrl}
          target="_blank"
          rel="noreferrer"
          className="line-clamp-2 text-[15px] font-semibold leading-6 text-zinc-950 hover:underline dark:text-zinc-50"
        >
          {item.title}
        </a>

        <div className="min-w-0 text-sm leading-5 text-zinc-600 dark:text-zinc-300">
          <div className="truncate">
            {locationLabel}
            <span className="px-1.5 text-zinc-400">•</span>
            {formatRelativeUpdate(item.fetchedAt, locale)}
          </div>
        </div>

        <div className="mt-auto flex flex-wrap gap-2 pt-1">
          <MetaChip>{item.countryCode}</MetaChip>
          <MetaChip>{getPeriodLabel(item.period, t)}</MetaChip>
          <MetaChip>{getSortLabel(item.orderBy, t)}</MetaChip>
        </div>
      </div>
    </article>
  );
}

function MetaChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
      {children}
    </span>
  );
}
