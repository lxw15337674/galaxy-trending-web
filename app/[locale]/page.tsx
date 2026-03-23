import { hasLocale } from 'next-intl';
import { notFound, redirect } from 'next/navigation';
import { routing } from '@/i18n/routing';

interface LocaleIndexPageProps {
  params: Promise<{ locale: string }>;
}

export default async function LocaleIndexPage({ params }: LocaleIndexPageProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  redirect(`/${locale}/youtube-trending`);
}
