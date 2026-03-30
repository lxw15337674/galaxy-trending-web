import axios from 'axios';
import type { BrowserContextOptions } from 'playwright-core';
import type { XTrendTarget } from './types';

type ResolvedStorageState = Exclude<BrowserContextOptions['storageState'], undefined>;
type InMemoryStorageState = Exclude<ResolvedStorageState, string>;
type StorageStateCookie = InMemoryStorageState['cookies'][number];

const FIXED_X_COOKIE_WEBSITES = ['x.com', 'twitter.com'] as const;
const FIXED_ADMIN_API_BASE_URL = 'https://dev-api.bhwa233.com';
const ADMIN_API_MAX_RETRIES = 5;
const ADMIN_API_RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

interface RawCookieRecord {
  name?: unknown;
  value?: unknown;
  domain?: unknown;
  path?: unknown;
  expirationDate?: unknown;
  expires?: unknown;
  expiration?: unknown;
  httpOnly?: unknown;
  secure?: unknown;
  sameSite?: unknown;
}

interface AdminApiSuccessPayload {
  success?: boolean;
  error?: unknown;
  message?: unknown;
  code?: unknown;
  requestId?: unknown;
  data?: {
    website?: unknown;
    normalizedWebsite?: unknown;
    matchedWebsite?: unknown;
    sourceFile?: unknown;
    content?: unknown;
  };
}

function getString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function truncateText(value: string | null, maxLength = 240) {
  if (!value) return null;
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength)}...`;
}

function normalizeSameSite(value: unknown): StorageStateCookie['sameSite'] {
  const normalized = String(value ?? '').trim().toLowerCase();

  switch (normalized) {
    case 'strict':
      return 'Strict';
    case 'none':
    case 'no_restriction':
      return 'None';
    case 'lax':
    default:
      return 'Lax';
  }
}

function normalizeBoolean(value: unknown) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1';
  }
  return false;
}

function parseJsonString(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function normalizeCookieDomain(domain: string | null) {
  return domain?.trim().replace(/^\./, '').toLowerCase() ?? null;
}

function normalizeCookie(raw: RawCookieRecord): StorageStateCookie | null {
  const name = getString(raw.name);
  const value = typeof raw.value === 'string' ? raw.value : raw.value == null ? '' : String(raw.value);
  const domain = getString(raw.domain);
  const path = getString(raw.path) ?? '/';
  const expirationCandidate = raw.expirationDate ?? raw.expires ?? raw.expiration;
  const expires =
    typeof expirationCandidate === 'number' && Number.isFinite(expirationCandidate) && expirationCandidate > 0
      ? expirationCandidate
      : -1;

  if (!name || !domain) {
    return null;
  }

  return {
    name,
    value,
    domain,
    path,
    expires,
    httpOnly: normalizeBoolean(raw.httpOnly),
    secure: normalizeBoolean(raw.secure),
    sameSite: normalizeSameSite(raw.sameSite),
  } satisfies StorageStateCookie;
}

function extractCookieArrayFromDomainCookieMapEntry(value: unknown) {
  if (Array.isArray(value)) {
    return value;
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.cookies)) {
      return record.cookies;
    }
  }

  return null;
}

function extractCookieArrayFromContent(content: unknown, matchedWebsite: string | null): unknown[] | null {
  if (typeof content === 'string') {
    const parsed = parseJsonString(content);
    if (parsed != null) {
      return extractCookieArrayFromContent(parsed, matchedWebsite);
    }
  }

  if (Array.isArray(content)) {
    return content;
  }

  if (content && typeof content === 'object') {
    const record = content as Record<string, unknown>;

    if (Array.isArray(record.cookies)) {
      return record.cookies;
    }

    if (record.domainCookieMap && typeof record.domainCookieMap === 'object') {
      const map = record.domainCookieMap as Record<string, unknown>;
      const normalizedMatchedWebsite = normalizeCookieDomain(matchedWebsite);

      if (matchedWebsite) {
        const directHit = extractCookieArrayFromDomainCookieMapEntry(map[matchedWebsite]);
        if (directHit) {
          return directHit;
        }
      }

      if (normalizedMatchedWebsite) {
        for (const [domain, entry] of Object.entries(map)) {
          if (normalizeCookieDomain(domain) === normalizedMatchedWebsite) {
            const cookies = extractCookieArrayFromDomainCookieMapEntry(entry);
            if (cookies) {
              return cookies;
            }
          }
        }
      }

      const firstEntry = Object.values(map)
        .map((entry) => extractCookieArrayFromDomainCookieMapEntry(entry))
        .find((entry): entry is unknown[] => Array.isArray(entry) && entry.length > 0);

      if (firstEntry) {
        return firstEntry;
      }
    }
  }

  return null;
}

function buildAdminApiError(params: {
  status: number;
  payload: AdminApiSuccessPayload | null;
  rawText: string | null;
  attempt: number;
  regionKey: string;
  website: string;
}) {
  const detailParts = [
    `website=${params.website}`,
    getString(params.payload?.code) ? `code=${getString(params.payload?.code)}` : null,
    getString(params.payload?.error) ? `error=${getString(params.payload?.error)}` : null,
    getString(params.payload?.message) ? `message=${getString(params.payload?.message)}` : null,
    getString(params.payload?.requestId) ? `requestId=${getString(params.payload?.requestId)}` : null,
  ].filter((part): part is string => Boolean(part));

  const bodySnippet = truncateText(params.rawText);
  if (bodySnippet && !detailParts.some((part) => part.includes(bodySnippet))) {
    detailParts.push(`body=${bodySnippet}`);
  }

  return new Error(
    `Admin API cookie fetch failed status=${params.status} attempt=${params.attempt}/${ADMIN_API_MAX_RETRIES} region=${params.regionKey}${detailParts.length ? ` ${detailParts.join(' ')}` : ''}`,
  );
}

async function fetchAdminApiCookieConfig(target: XTrendTarget) {
  const apiKey = target.adminApiKey?.trim();

  if (!apiKey) {
    throw new Error(`Admin API cookie source requires adminApiKey for region=${target.regionKey}`);
  }

  let lastError: Error | null = null;
  for (const website of FIXED_X_COOKIE_WEBSITES) {
    const url = new URL('/api/admin/gist-cookie', FIXED_ADMIN_API_BASE_URL);
    url.searchParams.set('website', website);

    for (let attempt = 1; attempt <= ADMIN_API_MAX_RETRIES; attempt++) {
      try {
        const response = await axios.get(url.toString(), {
          headers: {
            'x-api-key': apiKey,
          },
          responseType: 'text',
          timeout: 30_000,
          transformResponse: [(value) => value],
          validateStatus: () => true,
        });

        const rawText = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
        const parsedPayload = rawText ? (parseJsonString(rawText) as AdminApiSuccessPayload | null) : null;

        if (response.status < 200 || response.status >= 300) {
          lastError = buildAdminApiError({
            status: response.status,
            payload: parsedPayload,
            rawText,
            attempt,
            regionKey: target.regionKey,
            website,
          });

          if (attempt < ADMIN_API_MAX_RETRIES && ADMIN_API_RETRYABLE_STATUS.has(response.status)) {
            await sleep(attempt * 1_500);
            continue;
          }

          const errorCode = getString(parsedPayload?.code)?.toUpperCase();
          if (response.status === 404 || errorCode === 'NOT_FOUND') {
            break;
          }

          throw lastError;
        }

        if (!parsedPayload?.success || !parsedPayload.data) {
          throw new Error(
            `Admin API cookie fetch returned unexpected payload for region=${target.regionKey} website=${website}${rawText ? ` body=${truncateText(rawText)}` : ''}`,
          );
        }

        return parsedPayload.data;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < ADMIN_API_MAX_RETRIES) {
          await sleep(attempt * 1_500);
          continue;
        }
      }
    }
  }

  throw lastError ?? new Error(`Admin API cookie fetch failed for region=${target.regionKey}`);
}

export async function resolveXTrendStorageState(target: XTrendTarget): Promise<ResolvedStorageState> {
  if (target.cookieSource === 'storage_state_file') {
    const storageStatePath = target.storageStatePath?.trim();
    if (!storageStatePath) {
      throw new Error(`storage_state_file cookie source requires storageStatePath for region=${target.regionKey}`);
    }

    return storageStatePath;
  }

  const payload = await fetchAdminApiCookieConfig(target);
  const matchedWebsite =
    getString(payload.matchedWebsite) ?? getString(payload.normalizedWebsite) ?? FIXED_X_COOKIE_WEBSITES[0];
  const cookieArray = extractCookieArrayFromContent(payload.content, matchedWebsite);

  if (!cookieArray?.length) {
    throw new Error(
      `Admin API cookie payload did not include cookies for region=${target.regionKey} matchedWebsite=${matchedWebsite}`,
    );
  }

  const cookies = cookieArray
    .map((item) => normalizeCookie(item as RawCookieRecord))
    .filter((item): item is StorageStateCookie => item !== null);

  if (!cookies.length) {
    throw new Error(`Admin API cookie payload included no valid cookies for region=${target.regionKey}`);
  }

  return {
    cookies,
    origins: [],
  } satisfies InMemoryStorageState;
}
