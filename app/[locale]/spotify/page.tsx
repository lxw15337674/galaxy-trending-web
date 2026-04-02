import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

interface SpotifyRedirectProps {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export const revalidate = 600;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Redirecting...',
  };
}

export default async function SpotifyRedirect({ params, searchParams }: SpotifyRedirectProps) {
  const [{ locale }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams ?? Promise.resolve(undefined),
  ]);

  const country = resolvedSearchParams?.country;
  const query = country ? `?type=spotify&country=${country}` : '?type=spotify';

  redirect(`/${locale}/music${query}`);
}
