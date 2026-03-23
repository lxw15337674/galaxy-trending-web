import createMiddleware from 'next-intl/middleware';
import { hasLocale } from 'next-intl';
import { NextRequest, NextResponse } from 'next/server';
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
    redirectUrl.pathname = `/en${pathname}`;
    return NextResponse.redirect(redirectUrl, 301);
  }

  return handleI18nRouting(request);
}

export default proxy;

export const config = {
  matcher: '/((?!api|trpc|_next|_vercel|.*\\..*).*)',
};

