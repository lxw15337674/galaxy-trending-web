import path from 'node:path';
import { resolveXTrendRegionLabel } from './regions';
import { XTrendTarget } from './types';

const DEFAULT_TARGET_URL = 'https://x.com/explore/tabs/trending';
const DEFAULT_COOKIE_SOURCE = 'storage_state_file';
const DEFAULT_ADMIN_API_BASE_URL = 'https://downloader-api.bhwa233.com';

function parseJsonTargets(raw: string): XTrendTarget[] {
  const parsed = JSON.parse(raw) as unknown;
  const rows = Array.isArray(parsed) ? parsed : [parsed];

  return rows.map((row, index) => {
    if (!row || typeof row !== 'object') {
      throw new Error(`X_TREND_TARGETS_JSON item ${index} must be an object`);
    }

    const record = row as Record<string, unknown>;
    const regionKey = String(record.regionKey ?? '').trim().toLowerCase();
    const explicitRegionLabel = String(record.regionLabel ?? '').trim() || null;
    const cookieSource = String(record.cookieSource ?? DEFAULT_COOKIE_SOURCE).trim().toLowerCase();
    const storageStatePath = String(record.storageStatePath ?? '').trim() || null;
    const adminApiBaseUrl = String(record.adminApiBaseUrl ?? DEFAULT_ADMIN_API_BASE_URL).trim() || null;
    const adminApiKey = String(record.adminApiKey ?? '').trim() || null;
    const targetUrl = String(record.targetUrl ?? DEFAULT_TARGET_URL).trim() || DEFAULT_TARGET_URL;
    const browserExecutablePath = String(record.browserExecutablePath ?? '').trim() || null;
    const locale = String(record.locale ?? '').trim() || null;

    if (!regionKey) {
      throw new Error(`X_TREND_TARGETS_JSON item ${index} is missing regionKey`);
    }

    if (cookieSource === 'storage_state_file' && !storageStatePath) {
      throw new Error(`X_TREND_TARGETS_JSON item ${index} is missing storageStatePath for storage_state_file source`);
    }

    if (cookieSource === 'admin_api' && !adminApiKey) {
      throw new Error(`X_TREND_TARGETS_JSON item ${index} is missing adminApiKey for admin_api source`);
    }

    return {
      regionKey,
      regionLabel: resolveXTrendRegionLabel(regionKey, explicitRegionLabel),
      cookieSource: cookieSource === 'admin_api' ? 'admin_api' : 'storage_state_file',
      storageStatePath: storageStatePath ? path.resolve(storageStatePath) : null,
      adminApiBaseUrl,
      adminApiKey,
      targetUrl,
      browserExecutablePath,
      locale,
    } satisfies XTrendTarget;
  });
}

export function loadXTrendTargetsFromEnv(): XTrendTarget[] {
  const jsonTargets = process.env.X_TREND_TARGETS_JSON?.trim();
  if (jsonTargets) {
    return parseJsonTargets(jsonTargets);
  }

  const regionKey = process.env.X_TREND_REGION_KEY?.trim().toLowerCase();
  const cookieSource = process.env.X_TREND_COOKIE_SOURCE?.trim().toLowerCase() || DEFAULT_COOKIE_SOURCE;
  const storageStatePath = process.env.X_TREND_STORAGE_STATE_PATH?.trim() || null;
  const adminApiBaseUrl = process.env.X_TREND_ADMIN_API_BASE_URL?.trim() || DEFAULT_ADMIN_API_BASE_URL;
  const adminApiKey = process.env.X_TREND_ADMIN_API_KEY?.trim() || null;
  const targetUrl = process.env.X_TREND_TARGET_URL?.trim() || DEFAULT_TARGET_URL;
  const browserExecutablePath = process.env.X_TREND_BROWSER_EXECUTABLE_PATH?.trim() || null;
  const locale = process.env.X_TREND_LOCALE?.trim() || null;

  if (!regionKey) {
    throw new Error('Missing X Trends target config. Set X_TREND_REGION_KEY.');
  }

  if (cookieSource === 'storage_state_file' && !storageStatePath) {
    throw new Error(
      'Missing X Trends cookie config. Set X_TREND_STORAGE_STATE_PATH or switch X_TREND_COOKIE_SOURCE to admin_api.',
    );
  }

  if (cookieSource === 'admin_api' && !adminApiKey) {
    throw new Error('Missing X Trends admin cookie config. Set X_TREND_ADMIN_API_KEY for admin_api source.');
  }

  return [
    {
      regionKey,
      regionLabel: resolveXTrendRegionLabel(regionKey),
      cookieSource: cookieSource === 'admin_api' ? 'admin_api' : 'storage_state_file',
      storageStatePath: storageStatePath ? path.resolve(storageStatePath) : null,
      adminApiBaseUrl,
      adminApiKey,
      targetUrl,
      browserExecutablePath,
      locale,
    },
  ];
}
