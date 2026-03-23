'use client';

import { usePathname } from 'next/navigation';
import { SiteHeader } from '@/components/SiteHeader';
import { stripLocalePrefix } from '@/i18n/config';

export function AppShellHeader() {
  const pathname = usePathname();
  const barePath = stripLocalePrefix(pathname ?? '/');

  if (!pathname) return null;
  if (barePath === '/') return null;

  return <SiteHeader />;
}
