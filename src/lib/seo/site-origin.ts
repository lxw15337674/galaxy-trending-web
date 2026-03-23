const FALLBACK_SITE_URL = 'http://localhost:3003';

function resolveRawSiteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : FALLBACK_SITE_URL);
}

export function getSiteOrigin(): URL {
  const normalized = resolveRawSiteUrl()
    .trim()
    .replace(/^['"]+|['"]+$/g, '');

  try {
    return new URL(normalized);
  } catch {
    return new URL(FALLBACK_SITE_URL);
  }
}

export function toAbsoluteUrl(pathname: string): string {
  return new URL(pathname, getSiteOrigin()).toString();
}
