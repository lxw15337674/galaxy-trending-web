import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import '../globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { AppShellHeader } from '@/components/AppShellHeader';
import { HtmlLangSync } from '@/components/HtmlLangSync';
import { getMessages } from '@/i18n/messages';
import { routing } from '@/i18n/routing';
import { getHtmlLang } from '@/i18n/locale-meta';
import { getSiteOrigin } from '@/lib/seo/site-origin';

const inter = Inter({ subsets: ['latin'] });
const metadataBase = getSiteOrigin();

interface LocaleLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

function resolveLocale(locale: string) {
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  return locale;
}

export async function generateMetadata({ params }: LocaleLayoutProps): Promise<Metadata> {
  const { locale: requestedLocale } = await params;
  const locale = resolveLocale(requestedLocale);

  return {
    metadataBase,
    title: {
      default: 'Galaxy Trending',
      template: '%s | Galaxy Trending',
    },
    description: getMessages(locale).home.metadataDescription,
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
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale: requestedLocale } = await params;
  const locale = resolveLocale(requestedLocale);

  return (
    <html lang={getHtmlLang(locale)} suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <HtmlLangSync />
          <AppShellHeader locale={locale} />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
