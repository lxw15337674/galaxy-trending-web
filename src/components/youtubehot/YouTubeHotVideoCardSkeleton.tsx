import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function YouTubeHotVideoCardSkeleton() {
  return (
    <Card className="flex h-full flex-col overflow-hidden border-0 bg-transparent text-zinc-900 shadow-sm dark:text-zinc-100">
      <Skeleton className="aspect-video w-full rounded-none bg-zinc-200 dark:bg-zinc-800" />

      <CardHeader className="flex flex-col gap-2 p-3 pb-2">
        <Skeleton className="h-5 w-full bg-zinc-200 dark:bg-zinc-800" />
        <Skeleton className="h-5 w-4/5 bg-zinc-200 dark:bg-zinc-800" />
      </CardHeader>

      <CardContent className="mt-auto flex flex-col gap-3 p-3 pt-0">
        <div className="flex items-start gap-2">
          <Skeleton className="mt-0.5 size-8 rounded-full bg-zinc-200 dark:bg-zinc-800" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-2/3 bg-zinc-200 dark:bg-zinc-800" />
            <Skeleton className="h-4 w-1/2 bg-zinc-200 dark:bg-zinc-800" />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-7 w-24 rounded-full bg-zinc-200 dark:bg-zinc-800" />
          <Skeleton className="h-7 w-28 rounded-full bg-zinc-200 dark:bg-zinc-800" />
          <Skeleton className="h-7 w-20 rounded-full bg-zinc-200 dark:bg-zinc-800" />
          <Skeleton className="h-7 w-24 rounded-full bg-zinc-200 dark:bg-zinc-800" />
        </div>
      </CardContent>
    </Card>
  );
}
