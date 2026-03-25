import createMiddleware from 'next-intl/middleware';
import { hasLocale } from 'next-intl';
import { NextRequest, NextResponse } from 'next/server';
import { detectLocaleFromAcceptLanguage, isLocale } from '@/i18n/config';
import { routing } from '@/i18n/routing';

const handleI18nRouting = createMiddleware(routing);

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === '/') {
    return handleI18nRouting(request);
  }

  const segment = pathname.split('/')[1];
  if (!hasLocale(routing.locales, segment)) {
    const redirectUrl = request.nextUrl.clone();
    const localeCookieName =
      typeof routing.localeCookie === 'object' && typeof routing.localeCookie.name === 'string'
        ? routing.localeCookie.name
        : 'lang';
    const cookieLocale = request.cookies.get(localeCookieName)?.value;
    const preferredLocale = isLocale(cookieLocale)
      ? cookieLocale
      : detectLocaleFromAcceptLanguage(request.headers.get('accept-language'));

    redirectUrl.pathname = `/${preferredLocale}${pathname}`;
    return NextResponse.redirect(redirectUrl, 307);
  }

  return handleI18nRouting(request);
}

export default proxy;

export const config = {
  matcher: '/((?!api|trpc|_next|_vercel|.*\\..*).*)',
};
