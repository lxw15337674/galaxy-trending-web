'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { ModeToggle } from './ModeToggle';
import { Suspense, useEffect } from 'react';
import { Button } from './ui/button';
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from './ui/navigation-menu';
import { cn } from '@/lib/utils';
import { localeFromPathname, stripLocalePrefix, withLocalePrefix } from '@/i18n/config';
import { getMessages } from '@/i18n/messages';

function isLocaleSwitchablePath(barePath: string) {
  return barePath === '/youtube-trending' || barePath === '/youtube-live';
}

export function SiteHeaderContent() {
  const pathname = usePathname();
  const params = useSearchParams();
  const locale = localeFromPathname(pathname);
  const messages = getMessages(locale);
  const barePath = stripLocalePrefix(pathname ?? '/');
  const targetLocale = locale === 'zh' ? 'en' : 'zh';
  const siteNav = [
    { href: withLocalePrefix('/youtube-trending', locale), label: messages.common.navYouTubeHot },
    { href: withLocalePrefix('/youtube-live', locale), label: messages.common.navYouTubeLive },
  ];

  const switchPath = isLocaleSwitchablePath(barePath)
    ? withLocalePrefix(barePath, targetLocale)
    : withLocalePrefix('/youtube-live', targetLocale);
  const switchQuery = isLocaleSwitchablePath(barePath) ? params.toString() : '';
  const switchHref = switchQuery ? `${switchPath}?${switchQuery}` : switchPath;

  useEffect(() => {
    document.cookie = `lang=${locale}; path=/; max-age=${60 * 60 * 24 * 180}; samesite=lax`;
  }, [locale]);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 w-full max-w-[1920px] lg:max-w-[80%] items-center px-4 md:px-6">
        <NavigationMenu className="max-w-none justify-start">
          <NavigationMenuList>
            {siteNav.map((item) => {
              const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
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

        <div className="ml-auto flex items-center space-x-2">
          <Button variant="outline" size="sm" asChild>
            <Link
              href={switchHref}
              onClick={() => {
                document.cookie = `lang=${targetLocale}; path=/; max-age=${60 * 60 * 24 * 180}; samesite=lax`;
              }}
            >
              {messages.common.switchLanguage}
            </Link>
          </Button>
          <ModeToggle />
        </div>
      </div>
    </header>
  );
}

export function SiteHeader() {
  return (
    <Suspense fallback={null}>
      <SiteHeaderContent />
    </Suspense>
  );
}
