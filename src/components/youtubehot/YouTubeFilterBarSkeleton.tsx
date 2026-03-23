import { Card, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function YouTubeFilterBarSkeleton() {
  return (
    <Card className="border-zinc-200 bg-white/90 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/85">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-3">
          <div className="grid w-full grid-cols-1 gap-3 min-[360px]:grid-cols-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:justify-end">
            <Skeleton className="h-10 w-full sm:w-[260px] xl:w-[300px]" />
            <Skeleton className="h-10 w-full sm:w-[260px] xl:w-[300px]" />
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}
