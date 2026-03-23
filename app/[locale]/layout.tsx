import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import '../globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { AppShellHeader } from '@/components/AppShellHeader';
import { routing } from '@/i18n/routing';
import { getSiteOrigin } from '@/lib/seo/site-origin';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  metadataBase: getSiteOrigin(),
  title: {
    default: 'Media Trending Web',
    template: '%s | Media Trending Web',
  },
  description: 'Hourly YouTube trending video ranking with multilingual filters and global live insights.',
  keywords: [
    'youtube trending',
    'youtube trending videos',
    'youtube trending by region',
    'youtube trending categories',
    'youtube video ranking',
    'youtube live ranking',
    'youtube live tracker',
  ],
};

interface LocaleLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  return (
    <html lang={locale === 'zh' ? 'zh-CN' : 'en'} suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <AppShellHeader />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
