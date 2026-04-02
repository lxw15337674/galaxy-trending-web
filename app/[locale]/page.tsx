import type { Metadata } from 'next';
import Link from 'next/link';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { LOCALES, type Locale } from '@/i18n/config';
import { getLocaleLabel } from '@/i18n/locale-meta';
import { getMessages } from '@/i18n/messages';
import { routing } from '@/i18n/routing';
import { buildLocaleAlternates } from '@/lib/seo/locale-alternates';
import { toAbsoluteUrl } from '@/lib/seo/site-origin';

interface LocaleIndexPageProps {
  params: Promise<{ locale: string }>;
}

function resolveLocale(locale: string): Locale {
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  return locale;
}

export async function generateMetadata({ params }: LocaleIndexPageProps): Promise<Metadata> {
  const { locale: requestedLocale } = await params;
  const locale = resolveLocale(requestedLocale);
  const messages = getMessages(locale).home;
  const absoluteCanonical = toAbsoluteUrl(`/${locale}`);

  return {
    title: {
      absolute: messages.metadataTitle,
    },
    description: messages.metadataDescription,
    alternates: {
      canonical: absoluteCanonical,
      languages: buildLocaleAlternates('/'),
    },
    openGraph: {
      type: 'website',
      url: absoluteCanonical,
      title: messages.metadataTitle,
      description: messages.metadataDescription,
      siteName: messages.metadataTitle,
    },
    twitter: {
      card: 'summary_large_image',
      title: messages.metadataTitle,
      description: messages.metadataDescription,
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default async function LocaleIndexPage({ params }: LocaleIndexPageProps) {
  const { locale: requestedLocale } = await params;
  const locale = resolveLocale(requestedLocale);
  const messages = getMessages(locale);

  const sections = [
    {
      href: `/${locale}/youtube-trending`,
      platform: 'YouTube',
      label: messages.common.navYouTubeHot,
      description: messages.home.trendingDescription,
    },
    {
      href: `/${locale}/music`,
      platform: 'YouTube Music / Apple Music / Spotify',
      label: messages.music.title,
      description: messages.music.description,
    },
    {
      href: `/${locale}/twitch-live`,
      platform: 'Twitch',
      label: messages.common.navTwitch,
      description: messages.home.twitchLiveDescription,
    },
    {
      href: `/${locale}/twitch-categories`,
      platform: 'Twitch',
      label: messages.twitchCategories.title,
      description: messages.home.twitchCategoriesDescription,
    },
    {
      href: `/${locale}/apple-music`,
      platform: 'Apple Music',
      label: messages.appleMusic.title,
      description: messages.home.appleMusicDescription,
    },
    {
      href: `/${locale}/spotify`,
      platform: 'Spotify',
      label: messages.spotify.title,
      description: messages.home.spotifyDescription,
    },
    {
      href: `/${locale}/steam`,
      platform: 'Steam',
      label: messages.common.navSteam,
      description: messages.home.steamDescription,
    },
    {
      href: `/${locale}/games`,
      platform: 'App Store / Google Play',
      label: messages.common.navAppStoreGames,
      description: messages.home.appStoreGamesDescription,
    },
    {
      href: `/${locale}/youtube-music/videos-daily`,
      platform: 'YouTube Music',
      label: messages.youtubeMusicVideosDaily.title,
      description: messages.home.musicVideosDailyDescription,
    },
    {
      href: `/${locale}/youtube-music/shorts-songs-daily`,
      platform: 'YouTube Music',
      label: messages.youtubeMusicShortsDaily.title,
      description: messages.home.musicShortsDailyDescription,
    },
    {
      href: `/${locale}/youtube-live`,
      platform: 'YouTube',
      label: messages.common.navYouTubeLive,
      description: messages.home.liveDescription,
    },
    {
      href: `/${locale}/x-trending`,
      platform: 'X',
      label: messages.common.navXTrends,
      description: messages.home.xTrendsDescription,
    },
    {
      href: `/${locale}/tiktok-trending`,
      platform: 'TikTok',
      label: messages.common.navTikTokTrends,
      description: messages.home.tiktokDescription,
    },
    {
      href: `/${locale}/tiktok-videos`,
      platform: 'TikTok',
      label: messages.common.navTikTokVideos,
      description: messages.home.tiktokVideosDescription,
    },
  ];

  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-100 via-zinc-50 to-white pb-10 text-zinc-900 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 dark:text-zinc-100">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 md:px-6 md:py-12">
        <div className="rounded-3xl border border-zinc-200 bg-white/90 p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/85 md:p-10">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
            {messages.home.metadataTitle}
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 md:text-5xl">
            {messages.home.title}
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-zinc-600 dark:text-zinc-300 md:text-lg">
            {messages.home.description}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {sections.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className="group rounded-3xl border border-zinc-200 bg-white/90 p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/80 dark:hover:border-zinc-700"
            >
              <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{section.platform}</div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                {section.label}
              </h2>
              <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{section.description}</p>
              <span className="mt-6 inline-flex text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {section.label}
              </span>
            </Link>
          ))}
        </div>

        <div className="rounded-3xl border border-zinc-200 bg-white/90 p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            {messages.home.browseLocales}
          </h2>
          <div className="mt-4 flex flex-wrap gap-3">
            {LOCALES.map((option) => (
              <Link
                key={option}
                href={`/${option}`}
                className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:border-zinc-400 hover:text-zinc-950 dark:border-zinc-700 dark:text-zinc-200 dark:hover:border-zinc-600 dark:hover:text-zinc-50"
                aria-label={`${messages.home.openLocale}: ${getLocaleLabel(option)}`}
              >
                {getLocaleLabel(option)}
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
