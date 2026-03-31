'use client';

import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';

interface TwitchCategoryCardProps {
  name: string;
  boxArtUrl: string | null;
  href: string;
  rank: number;
}

export function TwitchCategoryCard({ name, boxArtUrl, href, rank }: TwitchCategoryCardProps) {
  return (
    <Card className="overflow-hidden rounded-2xl border-zinc-200 bg-white/90 shadow-sm transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/85">
      <a href={href} target="_blank" rel="noreferrer" className="block">
        <div className="relative aspect-[3/4] w-full overflow-hidden bg-zinc-100 dark:bg-zinc-900">
          {boxArtUrl ? (
            <Image
              src={boxArtUrl}
              alt={name}
              fill
              sizes="(max-width: 768px) 50vw, (max-width: 1280px) 33vw, 20vw"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-zinc-500 dark:text-zinc-400">
              {name}
            </div>
          )}
          <div className="absolute left-3 top-3 rounded-full bg-zinc-950/90 px-2.5 py-1 text-xs font-semibold text-white dark:bg-zinc-100 dark:text-zinc-950">
            #{rank}
          </div>
        </div>
        <CardContent className="p-4">
          <div className="line-clamp-2 text-base font-semibold leading-6 text-zinc-950 dark:text-zinc-50">{name}</div>
        </CardContent>
      </a>
    </Card>
  );
}
