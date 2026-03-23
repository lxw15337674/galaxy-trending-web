export const LOCALES = ['en', 'zh'] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

export function isLocale(value: string | null | undefined): value is Locale {
  if (!value) return false;
  return (LOCALES as readonly string[]).includes(value);
}

export function normalizeLocale(value: string | null | undefined): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export function localeFromPathname(pathname: string | null | undefined): Locale {
  if (!pathname) return DEFAULT_LOCALE;
  const segment = pathname.split('/')[1];
  return isLocale(segment) ? segment : DEFAULT_LOCALE;
}

export function stripLocalePrefix(pathname: string): string {
  if (!pathname) return '/';
  const normalized = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const parts = normalized.split('/');
  const segment = parts[1];

  if (!isLocale(segment)) return normalized;
  const rest = `/${parts.slice(2).join('/')}`;
  return rest === '/' ? '/' : rest.replace(/\/+$/, '') || '/';
}

export function withLocalePrefix(pathname: string, locale: Locale): string {
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const barePath = stripLocalePrefix(normalizedPath);
  return barePath === '/' ? `/${locale}` : `/${locale}${barePath}`;
}

export function detectLocaleFromAcceptLanguage(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;

  const values = acceptLanguage
    .split(',')
    .map((part) => part.trim().split(';')[0]?.toLowerCase())
    .filter(Boolean) as string[];

  for (const value of values) {
    if (value.startsWith('zh')) return 'zh';
    if (value.startsWith('en')) return 'en';
  }

  return DEFAULT_LOCALE;
}

