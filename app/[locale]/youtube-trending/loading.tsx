import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { YouTubeFilterBarSkeleton } from '@/components/youtubehot/YouTubeFilterBarSkeleton';

export default function YouTubeHotLoading() {
  const initialSkeletonCount = 20;

  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-100 via-zinc-50 to-white pb-10 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950">
      <section className="mx-auto w-full max-w-[1920px] lg:max-w-[80%] px-4 pt-6 md:px-6 md:pt-8">
        <YouTubeFilterBarSkeleton />

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: initialSkeletonCount }).map((_, idx) => (
            <Card key={idx} className="overflow-hidden border-zinc-200 bg-white/90 dark:border-zinc-800 dark:bg-zinc-900/85">
              <Skeleton className="aspect-video w-full rounded-none" />
              <CardContent className="space-y-3 p-4">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-4/5" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
}
