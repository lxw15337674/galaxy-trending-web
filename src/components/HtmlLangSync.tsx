'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { localeFromPathname } from '@/i18n/config';

export function HtmlLangSync() {
  const pathname = usePathname();

  useEffect(() => {
    const locale = localeFromPathname(pathname);
    document.documentElement.lang = locale === 'en' ? 'en' : 'zh-CN';
  }, [pathname]);

  return null;
}
