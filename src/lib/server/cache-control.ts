export const HOT_API_CACHE_CONTROL = 'public, s-maxage=60, stale-while-revalidate=300';

export function withCacheControlHeaders(init?: HeadersInit) {
  return {
    ...init,
    'Cache-Control': HOT_API_CACHE_CONTROL,
  };
}
