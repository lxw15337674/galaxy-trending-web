import type { BrowserContextOptions } from 'playwright-core';
import type { XTrendTarget } from './types';

type ResolvedStorageState = Exclude<BrowserContextOptions['storageState'], undefined>;
type InMemoryStorageState = Exclude<ResolvedStorageState, string>;
type StorageStateCookie = InMemoryStorageState['cookies'][number];

const FIXED_X_COOKIE_WEBSITE = 'x.com';

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

async function fetchAdminApiCookieConfig(target: XTrendTarget) {
  const baseUrl = target.adminApiBaseUrl?.trim();
  const apiKey = target.adminApiKey?.trim();

  if (!baseUrl || !apiKey) {
    throw new Error(
      `Admin API cookie source requires adminApiBaseUrl and adminApiKey for region=${target.regionKey}`,
    );
  }

  const url = new URL('/api/admin/gist-cookie', baseUrl);
  url.searchParams.set('website', FIXED_X_COOKIE_WEBSITE);

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'x-api-key': apiKey,
    },
  });

  let payload: AdminApiSuccessPayload | null = null;
  try {
    payload = (await response.json()) as AdminApiSuccessPayload;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const detail = getString(payload?.error) || getString(payload?.message);
    throw new Error(`Admin API cookie fetch failed status=${response.status}${detail ? ` detail=${detail}` : ''}`);
  }

  if (!payload?.success || !payload.data) {
    throw new Error(`Admin API cookie fetch returned unexpected payload for region=${target.regionKey}`);
  }

  return payload.data;
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
  const matchedWebsite = getString(payload.matchedWebsite) ?? getString(payload.normalizedWebsite) ?? FIXED_X_COOKIE_WEBSITE;
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
