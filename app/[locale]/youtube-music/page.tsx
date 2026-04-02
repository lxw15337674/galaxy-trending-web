import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

interface YouTubeMusicRedirectProps {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export const revalidate = 600;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Redirecting...',
  };
}

export default async function YouTubeMusicRedirect({ params, searchParams }: YouTubeMusicRedirectProps) {
  const [{ locale }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams ?? Promise.resolve(undefined),
  ]);

  const country = resolvedSearchParams?.country;
  const query = country ? `?type=youtube-music-weekly&country=${country}` : '?type=youtube-music-weekly';

  redirect(`/${locale}/music${query}`);
}
