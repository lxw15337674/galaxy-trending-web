import { DEFAULT_LOCALE, LOCALES } from '@/i18n/config';
import { getHtmlLang } from '@/i18n/locale-meta';

function normalizeLocalizedPath(pathname: string) {
  if (!pathname || pathname === '/') {
    return '';
  }

  return pathname.startsWith('/') ? pathname : `/${pathname}`;
}

export function buildLocaleAlternates(pathname: string): Record<string, string> {
  const localizedPath = normalizeLocalizedPath(pathname);
  const entries = LOCALES.map((locale) => [getHtmlLang(locale), `/${locale}${localizedPath}`]);

  return Object.fromEntries([...entries, ['x-default', `/${DEFAULT_LOCALE}${localizedPath}`]]) as Record<string, string>;
}
