import { DEFAULT_LOCALE, isLocale, type Locale } from '@/i18n/config';

type A11yLabelKey = 'clearSearch' | 'close';

const A11Y_LABELS: Record<Locale, Record<A11yLabelKey, string>> = {
  en: {
    clearSearch: 'Clear search',
    close: 'Close',
  },
  zh: {
    clearSearch: '清空搜索',
    close: '关闭',
  },
  es: {
    clearSearch: 'Borrar busqueda',
    close: 'Cerrar',
  },
  ja: {
    clearSearch: '検索をクリア',
    close: '閉じる',
  },
};

function resolveDocumentLocale(documentLang: string | null | undefined): Locale {
  const normalized = documentLang?.trim().toLowerCase() ?? '';
  const baseLocale = normalized.split('-')[0];
  return isLocale(baseLocale) ? baseLocale : DEFAULT_LOCALE;
}

export function getLocalizedA11yLabel(key: A11yLabelKey, documentLang?: string | null | undefined) {
  const locale =
    documentLang !== undefined
      ? resolveDocumentLocale(documentLang)
      : resolveDocumentLocale(typeof document === 'undefined' ? undefined : document.documentElement.lang);

  return A11Y_LABELS[locale][key];
}
