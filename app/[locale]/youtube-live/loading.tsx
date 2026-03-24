import { ChevronDown } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/card';
import { YouTubeVideoCard } from '@/components/youtubehot/YouTubeVideoCard';

const PAGE_SECTION_CLASS = 'mx-auto w-full px-4 pt-6 md:px-6 md:pt-8 lg:w-[80%]';
const CARD_GRID_CLASS = 'mt-4 grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4';

export default function YouTubeLiveLoading() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-100 via-zinc-50 to-white pb-10 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950">
      <section className={PAGE_SECTION_CLASS}>
        <Card className="border-zinc-200 bg-white/90 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/85">
          <CardHeader className="p-2 md:p-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="grid w-full grid-cols-1 gap-2 min-[360px]:grid-cols-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:justify-end">
                <div className="relative w-full sm:w-[260px] xl:w-[300px]">
                  <div className="h-10 w-full rounded-md border border-zinc-300 bg-background px-3 pr-9 dark:border-zinc-700" />
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
                </div>
                <div className="relative w-full sm:w-[260px] xl:w-[300px]">
                  <div className="h-10 w-full rounded-md border border-zinc-300 bg-background px-3 pr-9 dark:border-zinc-700" />
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        <div className={CARD_GRID_CLASS}>
          {Array.from({ length: 10 }).map((_, idx) => (
            <YouTubeVideoCard key={idx} loading tagsCount={4} />
          ))}
        </div>
      </section>
    </main>
  );
}
