import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client/http';

function normalizeTursoUrl(raw: string) {
  const value = raw.replace(/^\uFEFF+/, '').trim();
  if (value.startsWith('libsql://')) {
    return `https://${value.slice('libsql://'.length)}`;
  }
  return value;
}

function sanitizeEnv(raw: string) {
  return raw.replace(/^\uFEFF+/, '').trim();
}

interface RequestLike {
  url?: string;
  method?: string;
  headers?: HeadersInit;
  arrayBuffer?: () => Promise<ArrayBuffer>;
  signal?: AbortSignal | null;
  redirect?: RequestRedirect;
}

async function runtimeFetch(input: RequestInfo | URL | RequestLike, init?: RequestInit): Promise<Response> {
  if (init || typeof input === 'string' || input instanceof URL || input instanceof Request) {
    return fetch(input as RequestInfo | URL, init);
  }

  const requestLike = input as RequestLike;
  if (!requestLike || typeof requestLike.url !== 'string') {
    return fetch(input as RequestInfo | URL, init);
  }

  const method = (requestLike.method ?? 'GET').toUpperCase();
  const headers = requestLike.headers ? new Headers(requestLike.headers) : undefined;
  const body =
    method === 'GET' || method === 'HEAD' || !requestLike.arrayBuffer ? undefined : await requestLike.arrayBuffer();

  return fetch(requestLike.url, {
    method,
    headers,
    body,
    signal: requestLike.signal ?? undefined,
    redirect: requestLike.redirect,
  });
}

function toErrorWithCode(message: string, code: string) {
  const error = new Error(message) as Error & { code?: string };
  error.code = code;
  return error;
}

function parseUrlHost(value: string) {
  if (!value) return '';
  try {
    return new URL(value).host;
  } catch {
    return '';
  }
}

function readDbConfig() {
  const tursoUrlRaw = process.env.TURSO_DATABASE_URL ? sanitizeEnv(process.env.TURSO_DATABASE_URL) : '';
  const tursoUrl = tursoUrlRaw ? normalizeTursoUrl(tursoUrlRaw) : '';
  const tursoAuthToken = process.env.TURSO_AUTH_TOKEN ? sanitizeEnv(process.env.TURSO_AUTH_TOKEN) : '';

  return {
    tursoUrlRaw,
    tursoUrl,
    tursoAuthToken,
    isDbConfigured: Boolean(tursoUrl),
  };
}

export function getDbRuntimeInfo() {
  const { isDbConfigured, tursoUrlRaw, tursoUrl, tursoAuthToken } = readDbConfig();
  return {
    configured: isDbConfigured,
    hasUrl: Boolean(tursoUrlRaw),
    hasAuthToken: Boolean(tursoAuthToken),
    urlHost: parseUrlHost(tursoUrl),
  };
}

function createMissingDbConfigError() {
  return toErrorWithCode(
    'Database env missing: TURSO_DATABASE_URL is required to initialize database client.',
    'DB_ENV_MISSING',
  );
}

let dbInstance: ReturnType<typeof drizzle> | null | undefined;

function getDbInstance() {
  if (dbInstance !== undefined) {
    return dbInstance;
  }

  const { isDbConfigured, tursoUrl, tursoAuthToken } = readDbConfig();
  dbInstance = isDbConfigured
    ? drizzle(
        createClient({
          url: tursoUrl,
          authToken: tursoAuthToken || undefined,
          fetch: runtimeFetch,
        }),
      )
    : null;

  return dbInstance;
}

const missingDbProxy = new Proxy(
  {},
  {
    get(_target, property, receiver) {
      const instance = getDbInstance();
      if (!instance) {
        throw createMissingDbConfigError();
      }

      const value = Reflect.get(instance as object, property, receiver);
      return typeof value === 'function' ? value.bind(instance) : value;
    },
  },
) as ReturnType<typeof drizzle>;

export const db = missingDbProxy;
export default db;
