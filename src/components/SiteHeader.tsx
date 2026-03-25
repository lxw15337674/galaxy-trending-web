'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useTheme } from 'next-themes';
import { ModeToggle } from './ModeToggle';
import { Suspense, useEffect } from 'react';
import { Check, ChevronDown, EllipsisVertical, Github, Globe } from 'lucide-react';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from './ui/navigation-menu';
import { cn } from '@/lib/utils';
import { type Locale, localeFromPathname, stripLocalePrefix, withLocalePrefix } from '@/i18n/config';
import { getLocaleLabel } from '@/i18n/locale-meta';
import { getMessages } from '@/i18n/messages';

const SHELL_CONTAINER_CLASS = 'mx-auto flex h-14 w-full items-center px-4 md:px-6 lg:w-[80%]';
const GITHUB_REPO_URL = 'https://github.com/lxw15337674/galaxy-trending-web';

function isLocaleSwitchablePath(barePath: string) {
  return barePath === '/youtube-trending' || barePath === '/youtube-live';
}

function SiteHeaderFrame({
  locale,
  pathname,
  switchQuery = '',
}: {
  locale: Locale;
  pathname?: string | null;
  switchQuery?: string;
}) {
  const { setTheme } = useTheme();
  const messages = getMessages(locale);
  const barePath = stripLocalePrefix(pathname ?? '/');
  const siteNav = [
    {
      href: withLocalePrefix('/youtube-trending', locale),
      label: messages.common.navYouTubeHot,
      mobileLabel: messages.common.navYouTubeHotShort,
    },
    {
      href: withLocalePrefix('/youtube-live', locale),
      label: messages.common.navYouTubeLive,
      mobileLabel: messages.common.navYouTubeLiveShort,
    },
  ];

  const switchablePath = pathname ? isLocaleSwitchablePath(barePath) : false;
  const buildLocaleHref = (nextLocale: Locale) => {
    const nextPath = switchablePath
      ? withLocalePrefix(barePath, nextLocale)
      : withLocalePrefix('/youtube-trending', nextLocale);
    return switchablePath && switchQuery ? `${nextPath}?${switchQuery}` : nextPath;
  };
  const localeOptions: Array<{ locale: Locale; label: string; href: string }> = [
    { locale: 'en', label: getLocaleLabel('en'), href: buildLocaleHref('en') },
    { locale: 'zh', label: getLocaleLabel('zh'), href: buildLocaleHref('zh') },
    { locale: 'es', label: getLocaleLabel('es'), href: buildLocaleHref('es') },
    { locale: 'ja', label: getLocaleLabel('ja'), href: buildLocaleHref('ja') },
  ];
  const currentLocaleLabel = localeOptions.find((option) => option.locale === locale)?.label ?? getLocaleLabel(locale);
  const activeItem =
    siteNav.find((item) => pathname && (pathname === item.href || pathname.startsWith(`${item.href}/`))) ?? siteNav[0];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className={SHELL_CONTAINER_CLASS}>
        <div className="md:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                {activeItem.label}
                <ChevronDown data-icon="inline-end" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-36">
              <DropdownMenuLabel>YouTube</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                {siteNav.map((item) => {
                  const isActive = !!pathname && (pathname === item.href || pathname.startsWith(`${item.href}/`));
                  return (
                    <DropdownMenuItem
                      key={item.href}
                      asChild
                      className={cn(isActive && 'bg-accent text-accent-foreground')}
                    >
                      <Link href={item.href} className="flex w-full items-center gap-2">
                        <span>{item.mobileLabel}</span>
                        {isActive ? <Check className="ml-auto" /> : null}
                      </Link>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <NavigationMenu className="hidden max-w-none justify-start md:flex">
          <NavigationMenuList>
            {siteNav.map((item) => {
              const isActive = !!pathname && (pathname === item.href || pathname.startsWith(`${item.href}/`));
              return (
                <NavigationMenuItem key={item.href}>
                  <NavigationMenuLink asChild>
                    <Link
                      href={item.href}
                      className={cn(
                        navigationMenuTriggerStyle(),
                        'h-9',
                        isActive
                          ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                          : 'bg-transparent hover:bg-accent hover:text-accent-foreground',
                      )}
                    >
                      {item.label}
                    </Link>
                  </NavigationMenuLink>
                </NavigationMenuItem>
              );
            })}
          </NavigationMenuList>
        </NavigationMenu>

        <div className="ml-auto flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2" aria-label={messages.common.switchLanguage}>
                <Globe className="size-4" />
                <span>{currentLocaleLabel}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {localeOptions.map((option) => {
                const isActive = option.locale === locale;
                return (
                  <DropdownMenuItem key={option.locale} asChild>
                    <Link
                      href={option.href}
                      className="flex w-full items-center gap-2"
                      onClick={() => {
                        document.cookie = `lang=${option.locale}; path=/; max-age=${60 * 60 * 24 * 180}; samesite=lax`;
                      }}
                    >
                      <span>{option.label}</span>
                      {isActive ? <Check className="ml-auto size-4" /> : null}
                    </Link>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="md:hidden"
                aria-label="More options"
              >
                <EllipsisVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Theme</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setTheme('light')}>Light</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme('dark')}>Dark</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme('system')}>System</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <a
                  href={GITHUB_REPO_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="flex w-full items-center gap-2"
                  aria-label="GitHub repository"
                >
                  <Github className="size-4" />
                  <span>GitHub</span>
                </a>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="hidden items-center gap-2 md:flex">
            <ModeToggle />
            <Button variant="outline" size="sm" asChild>
              <a href={GITHUB_REPO_URL} target="_blank" rel="noreferrer" aria-label="GitHub repository">
                <Github className="size-4" />
              </a>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}

function SiteHeaderContent({ initialLocale }: { initialLocale: Locale }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const locale = pathname ? localeFromPathname(pathname) : initialLocale;

  useEffect(() => {
    document.cookie = `lang=${locale}; path=/; max-age=${60 * 60 * 24 * 180}; samesite=lax`;
  }, [locale]);

  return <SiteHeaderFrame locale={locale} pathname={pathname} switchQuery={params.toString()} />;
}

export function SiteHeader({ locale }: { locale: Locale }) {
  return (
    <Suspense fallback={<SiteHeaderFrame locale={locale} />}>
      <SiteHeaderContent initialLocale={locale} />
    </Suspense>
  );
}
