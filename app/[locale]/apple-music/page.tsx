import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

interface AppleMusicRedirectProps {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export const revalidate = 600;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Redirecting...',
  };
}

export default async function AppleMusicRedirect({ params, searchParams }: AppleMusicRedirectProps) {
  const [{ locale }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams ?? Promise.resolve(undefined),
  ]);

  const country = resolvedSearchParams?.country;
  const query = country ? `?type=apple-music&country=${country}` : '?type=apple-music';

  redirect(`/${locale}/music${query}`);
}
