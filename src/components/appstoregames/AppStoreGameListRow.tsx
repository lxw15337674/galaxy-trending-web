'use client';

import Image from 'next/image';
import type { Locale } from '@/i18n/config';
import { formatMonthDay } from '@/i18n/format';
import { getMessages } from '@/i18n/messages';
import type { AppStoreGameChartItem } from '@/lib/app-store-games/types';

interface AppStoreGameListRowProps {
  item: AppStoreGameChartItem;
  locale: Locale;
}

function buildPriceText(item: AppStoreGameChartItem) {
  if (item.priceLabel?.trim()) return item.priceLabel.trim();
  if (item.priceAmount?.trim()) {
    return `${item.priceAmount.trim()}${item.currencyCode ? ` ${item.currencyCode}` : ''}`;
  }
  return null;
}

export function AppStoreGameListRow({ item, locale }: AppStoreGameListRowProps) {
  const t = getMessages(locale).appStoreGames;
  const priceText = buildPriceText(item);
  const releaseDateText = item.releaseDate ? formatMonthDay(item.releaseDate, locale) : null;

  return (
    <a
      href={item.storeUrl}
      target="_blank"
      rel="noreferrer"
      className="grid grid-cols-[36px,48px,1fr] items-start gap-2.5 px-3 py-2.5 transition-colors hover:bg-white/[0.035] xl:grid-cols-[36px,52px,1fr,76px]"
    >
      <div className="pt-0.5 text-[12px] font-semibold tabular-nums text-cyan-300">#{item.rank}</div>

      <div className="relative size-12 overflow-hidden rounded-xl bg-white/5 ring-1 ring-white/8 xl:size-[52px]">
        {item.artworkUrl ? (
          <Image
            src={item.artworkUrl}
            alt={item.appName}
            fill
            sizes="52px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center px-2 text-center text-[11px] leading-4 text-zinc-500">
            {t.cardNoThumbnail}
          </div>
        )}
      </div>

      <div className="min-w-0">
        <div className="truncate text-[14px] font-semibold tracking-tight text-zinc-50">{item.appName}</div>
        <div className="mt-0.5 truncate text-[11px] leading-4.5 text-zinc-400">{item.developerName}</div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {priceText ? (
            <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-medium text-zinc-200">
              {priceText}
            </span>
          ) : null}
          {item.categoryName ? (
            <span className="rounded-full border border-emerald-500/20 bg-emerald-500/8 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
              {item.categoryName}
            </span>
          ) : null}
        </div>
      </div>

      <div className="col-start-3 mt-1 text-[10px] text-zinc-500 xl:col-start-auto xl:mt-0 xl:pt-0.5 xl:text-right">
        {releaseDateText ? (
          <div className="flex items-center gap-1 xl:flex-col xl:items-end xl:gap-0.5">
            <span className="text-zinc-400">{t.cardReleaseDate}</span>
            <span className="font-medium text-zinc-300">{releaseDateText}</span>
          </div>
        ) : null}
      </div>
    </a>
  );
}
