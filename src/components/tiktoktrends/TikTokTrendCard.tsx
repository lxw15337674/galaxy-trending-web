'use client';

import { ArrowDownRight, ArrowRight, ArrowUpRight, Flame } from 'lucide-react';
import { formatCompactNumber } from '@/i18n/format';
import type { Locale } from '@/i18n/config';
import { getMessages } from '@/i18n/messages';
import type { TikTokHashtagQueryItem } from '@/lib/tiktok-hashtag-trends/types';

interface TikTokTrendCardProps {
  item: TikTokHashtagQueryItem;
  locale: Locale;
}

function buildSparkline(points: TikTokHashtagQueryItem['trendPoints']) {
  const sample = points.slice(-12);
  if (!sample.length) return [];

  const values = sample.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);

  return sample.map((point) => ({
    time: point.time,
    value: point.value,
    height: 24 + Math.round(((point.value - min) / range) * 76),
  }));
}

function getMovement(item: TikTokHashtagQueryItem, t: ReturnType<typeof getMessages>['tiktokTrending']) {
  if (item.rankDiffType === 3) {
    return {
      label: t.cardMovementNew,
      tone: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300',
      icon: Flame,
    };
  }

  if ((item.rankDiff ?? 0) > 0 || item.rankDiffType === 1) {
    return {
      label: `${t.cardMovementUp} ${Math.abs(item.rankDiff ?? 0)}`,
      tone: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
      icon: ArrowUpRight,
    };
  }

  if ((item.rankDiff ?? 0) < 0 || item.rankDiffType === 2) {
    return {
      label: `${t.cardMovementDown} ${Math.abs(item.rankDiff ?? 0)}`,
      tone: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
      icon: ArrowDownRight,
    };
  }

  return {
    label: t.cardMovementFlat,
    tone: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-300',
    icon: ArrowRight,
  };
}

function uniqueList(values: string[]) {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)));
}

export function TikTokTrendCard({ item, locale }: TikTokTrendCardProps) {
  const t = getMessages(locale).tiktokTrending;
  const sparkline = buildSparkline(item.trendPoints);
  const movement = getMovement(item, t);
  const MovementIcon = movement.icon;
  const creators = uniqueList([
    ...item.creatorPreview.map((creator) => creator.nickName),
    ...(item.detail?.creatorNames ?? []),
  ]).slice(0, 4);
  const relatedHashtags = uniqueList(item.detail?.relatedHashtags ?? []).slice(0, 6);

  return (
    <article className="group overflow-hidden rounded-[28px] border border-rose-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,246,243,0.94))] shadow-[0_18px_60px_rgba(244,114,182,0.10)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_24px_80px_rgba(244,114,182,0.16)] dark:border-rose-950/60 dark:bg-[linear-gradient(180deg,rgba(24,24,27,0.98),rgba(39,19,23,0.96))]">
      <div className="flex items-start justify-between gap-3 border-b border-rose-100/80 px-5 py-4 dark:border-rose-950/50">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-600 text-lg font-semibold text-white shadow-sm">
            {item.rank}
          </div>
          <div className="min-w-0">
            <a
              href={item.publicTagUrl}
              target="_blank"
              rel="noreferrer"
              className="line-clamp-2 text-lg font-semibold tracking-tight text-zinc-950 transition group-hover:text-rose-700 dark:text-zinc-50 dark:group-hover:text-rose-300"
            >
              #{item.hashtagName}
            </a>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
              <span>{item.countryCode}</span>
              {item.industryName ? <span>{item.industryName}</span> : null}
            </div>
          </div>
        </div>

        <div className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${movement.tone}`}>
          <MovementIcon className="size-3.5" />
          <span>{movement.label}</span>
        </div>
      </div>

      <div className="space-y-4 px-5 py-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white/75 p-3 dark:bg-white/5">
            <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
              {t.publishCountLabel}
            </div>
            <div className="mt-2 text-xl font-semibold text-zinc-950 dark:text-zinc-50">
              {formatCompactNumber(item.publishCount, locale)}
            </div>
          </div>
          <div className="rounded-2xl bg-white/75 p-3 dark:bg-white/5">
            <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
              {t.videoViewsLabel}
            </div>
            <div className="mt-2 text-xl font-semibold text-zinc-950 dark:text-zinc-50">
              {formatCompactNumber(item.videoViews, locale)}
            </div>
          </div>
        </div>

        {sparkline.length > 0 ? (
          <div className="rounded-2xl bg-rose-50/80 p-3 dark:bg-white/5">
            <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">{t.trendLabel}</div>
            <div className="mt-3 flex h-16 items-end gap-1">
              {sparkline.map((point, index) => (
                <div
                  key={`${point.time}-${index}`}
                  className="min-w-0 flex-1 rounded-t-full bg-gradient-to-t from-rose-500 via-orange-400 to-amber-300"
                  style={{ height: `${point.height}%` }}
                  title={`${point.value}`}
                />
              ))}
            </div>
          </div>
        ) : null}

        {creators.length > 0 ? (
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">{t.creatorsLabel}</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {creators.map((creator) => (
                <span
                  key={creator}
                  className="rounded-full border border-rose-200 bg-white/80 px-3 py-1 text-xs font-medium text-zinc-700 dark:border-rose-900/60 dark:bg-white/5 dark:text-zinc-200"
                >
                  @{creator}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {relatedHashtags.length > 0 ? (
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">{t.relatedHashtagsLabel}</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {relatedHashtags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-zinc-950 px-3 py-1 text-xs font-medium text-white dark:bg-white dark:text-zinc-950"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {item.detail?.postsLastPeriodText || item.detail?.postsOverallText ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {item.detail?.postsLastPeriodText ? (
              <div className="rounded-2xl border border-rose-100 bg-white/75 p-3 dark:border-rose-950/50 dark:bg-white/5">
                <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">{t.postsWindowLabel}</div>
                <div className="mt-2 text-sm font-medium text-zinc-800 dark:text-zinc-100">{item.detail.postsLastPeriodText}</div>
              </div>
            ) : null}
            {item.detail?.postsOverallText ? (
              <div className="rounded-2xl border border-rose-100 bg-white/75 p-3 dark:border-rose-950/50 dark:bg-white/5">
                <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">{t.postsOverallLabel}</div>
                <div className="mt-2 text-sm font-medium text-zinc-800 dark:text-zinc-100">{item.detail.postsOverallText}</div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}
