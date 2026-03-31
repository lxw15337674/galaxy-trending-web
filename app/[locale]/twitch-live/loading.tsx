import { ChevronDown } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { YouTubeVideoCard } from '@/components/youtubehot/YouTubeVideoCard';

const PAGE_SECTION_CLASS = 'mx-auto w-full px-4 pt-2 md:px-6 md:pt-6 lg:w-[80%]';
const CARD_GRID_CLASS = 'mt-2 grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4';

export default function TwitchLiveLoading() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-100 via-zinc-50 to-white pb-10 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950">
      <section className={PAGE_SECTION_CLASS}>
        <Card className="border-zinc-200 bg-white/90 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/85">
          <CardHeader className="p-2 md:p-3">
            <div className="flex flex-wrap items-end gap-2">
              <div className="w-full min-[360px]:w-[220px] sm:w-[240px]">
                <div className="mb-2 h-4 w-16 rounded bg-zinc-200 dark:bg-zinc-800" />
                <div className="relative">
                  <div className="h-10 w-full rounded-md border border-zinc-300 bg-background px-3 pr-9 dark:border-zinc-700" />
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
                </div>
              </div>
              <div className="grid w-full grid-cols-1 gap-2 min-[360px]:grid-cols-2 lg:flex lg:w-auto lg:flex-wrap lg:items-end">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="w-full lg:w-[260px] xl:w-[300px]">
                    <div className="mb-2 h-4 w-20 rounded bg-zinc-200 dark:bg-zinc-800" />
                    <div className="relative">
                      <div className="h-10 w-full rounded-md border border-zinc-300 bg-background px-3 pr-9 dark:border-zinc-700" />
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
                    </div>
                  </div>
                ))}
              </div>
              <div className="h-4 w-28 rounded bg-zinc-200 dark:bg-zinc-800 sm:ml-auto" />
            </div>
          </CardHeader>
          <CardContent className="hidden" />
        </Card>

        <div className={CARD_GRID_CLASS}>
          {Array.from({ length: 20 }).map((_, index) => (
            <YouTubeVideoCard key={index} loading />
          ))}
        </div>
      </section>
    </main>
  );
}
