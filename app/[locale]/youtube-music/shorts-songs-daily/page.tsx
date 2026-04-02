import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

interface YouTubeMusicShortsSongsDailyRedirectProps {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export const revalidate = 600;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Redirecting...',
  };
}

export default async function YouTubeMusicShortsSongsDailyRedirect({
  params,
  searchParams,
}: YouTubeMusicShortsSongsDailyRedirectProps) {
  const [{ locale }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams ?? Promise.resolve(undefined),
  ]);

  const country = resolvedSearchParams?.country;
  const query = country
    ? `?type=youtube-music-shorts-songs-daily&country=${country}`
    : '?type=youtube-music-shorts-songs-daily';

  redirect(`/${locale}/music${query}`);
}
