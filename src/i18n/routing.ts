import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['en', 'zh'],
  defaultLocale: 'en',
  localePrefix: 'always',
  localeCookie: {
    name: 'lang',
    maxAge: 60 * 60 * 24 * 180,
    sameSite: 'lax',
  },
});

