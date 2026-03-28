import path from 'node:path';
import { resolveXTrendRegionLabel, resolveXTrendRegionLocationConfig } from './regions';
import { XTrendTarget } from './types';

const DEFAULT_TARGET_REGIONS = [
  { regionKey: 'us' },
  { regionKey: 'jp' },
  { regionKey: 'id' },
  { regionKey: 'in' },
  { regionKey: 'gb' },
  { regionKey: 'de' },
  { regionKey: 'tr' },
  { regionKey: 'mx' },
  { regionKey: 'br' },
  { regionKey: 'hk' },
] as const;
const DEFAULT_TARGET_URL = 'https://x.com/explore/tabs/trending';
const DEFAULT_COOKIE_SOURCE = 'admin_api';
const DEFAULT_ADMIN_API_BASE_URL = 'https://dev-api.bhwa233.com';

function normalizeCookieSource(value: unknown) {
  return String(value ?? DEFAULT_COOKIE_SOURCE).trim().toLowerCase() === 'admin_api' ? 'admin_api' : 'storage_state_file';
}

function buildTarget(input: {
  regionKey: string;
  regionLabel?: string | null;
  locationSearchQuery?: string | null;
  locationSelectText?: string | null;
  cookieSource?: string | null;
  storageStatePath?: string | null;
  adminApiBaseUrl?: string | null;
  adminApiKey?: string | null;
  targetUrl?: string | null;
  browserExecutablePath?: string | null;
  locale?: string | null;
}): XTrendTarget {
  const regionKey = input.regionKey.trim().toLowerCase();
  const explicitRegionLabel = input.regionLabel?.trim() || null;
  const explicitLocationSearchQuery = input.locationSearchQuery?.trim() || null;
  const explicitLocationSelectText = input.locationSelectText?.trim() || null;
  const cookieSource = normalizeCookieSource(input.cookieSource);
  const storageStatePath = input.storageStatePath?.trim() || null;
  const adminApiBaseUrl = input.adminApiBaseUrl?.trim() || DEFAULT_ADMIN_API_BASE_URL;
  const adminApiKey = input.adminApiKey?.trim() || null;
  const targetUrl = input.targetUrl?.trim() || DEFAULT_TARGET_URL;
  const browserExecutablePath = input.browserExecutablePath?.trim() || null;
  const locale = input.locale?.trim() || null;

  if (!regionKey) {
    throw new Error('X Trends target is missing regionKey.');
  }

  const resolvedLocationConfig =
    explicitLocationSearchQuery && explicitLocationSelectText
      ? {
          locationSearchQuery: explicitLocationSearchQuery,
          locationSelectText: explicitLocationSelectText,
        }
      : resolveXTrendRegionLocationConfig(regionKey);

  if (cookieSource === 'storage_state_file' && !storageStatePath) {
    throw new Error(
      `X Trends target region=${regionKey} is missing storageStatePath for storage_state_file source.`,
    );
  }

  if (cookieSource === 'admin_api' && !adminApiKey) {
    throw new Error(`X Trends target region=${regionKey} is missing adminApiKey for admin_api source.`);
  }

  return {
    regionKey,
    regionLabel: resolveXTrendRegionLabel(regionKey, explicitRegionLabel),
    locationSearchQuery: resolvedLocationConfig.locationSearchQuery,
    locationSelectText: resolvedLocationConfig.locationSelectText,
    cookieSource,
    storageStatePath: storageStatePath ? path.resolve(storageStatePath) : null,
    adminApiBaseUrl,
    adminApiKey,
    targetUrl,
    browserExecutablePath,
    locale,
  } satisfies XTrendTarget;
}

function parseJsonTargets(raw: string): XTrendTarget[] {
  const parsed = JSON.parse(raw) as unknown;
  const rows = Array.isArray(parsed) ? parsed : [parsed];

  return rows.map((row, index) => {
    if (!row || typeof row !== 'object') {
      throw new Error(`X_TREND_TARGETS_JSON item ${index} must be an object`);
    }

    const record = row as Record<string, unknown>;
    return buildTarget({
      regionKey: String(record.regionKey ?? ''),
      regionLabel: String(record.regionLabel ?? '').trim() || null,
      locationSearchQuery: String(record.locationSearchQuery ?? '').trim() || null,
      locationSelectText: String(record.locationSelectText ?? '').trim() || null,
      cookieSource: String(record.cookieSource ?? DEFAULT_COOKIE_SOURCE),
      storageStatePath: String(record.storageStatePath ?? '').trim() || null,
      adminApiBaseUrl: String(record.adminApiBaseUrl ?? DEFAULT_ADMIN_API_BASE_URL).trim() || null,
      adminApiKey: String(record.adminApiKey ?? '').trim() || null,
      targetUrl: String(record.targetUrl ?? DEFAULT_TARGET_URL),
      browserExecutablePath: String(record.browserExecutablePath ?? '').trim() || null,
      locale: String(record.locale ?? '').trim() || null,
    });
  });
}

function loadDefaultTargetsFromCode(): XTrendTarget[] {
  const cookieSource = normalizeCookieSource(process.env.X_TREND_COOKIE_SOURCE);
  const storageStatePath = process.env.X_TREND_STORAGE_STATE_PATH?.trim() || null;
  const adminApiBaseUrl = process.env.X_TREND_ADMIN_API_BASE_URL?.trim() || DEFAULT_ADMIN_API_BASE_URL;
  const adminApiKey = process.env.X_TREND_ADMIN_API_KEY?.trim() || null;
  const targetUrl = process.env.X_TREND_TARGET_URL?.trim() || DEFAULT_TARGET_URL;
  const browserExecutablePath = process.env.X_TREND_BROWSER_EXECUTABLE_PATH?.trim() || null;
  const locale = process.env.X_TREND_LOCALE?.trim() || null;

  return DEFAULT_TARGET_REGIONS.map((target) =>
    buildTarget({
      regionKey: target.regionKey,
      cookieSource,
      storageStatePath,
      adminApiBaseUrl,
      adminApiKey,
      targetUrl,
      browserExecutablePath,
      locale,
    }),
  );
}

export function loadXTrendTargetsFromEnv(): XTrendTarget[] {
  const jsonTargets = process.env.X_TREND_TARGETS_JSON?.trim();
  if (jsonTargets) {
    return parseJsonTargets(jsonTargets);
  }

  return loadDefaultTargetsFromCode();
}

