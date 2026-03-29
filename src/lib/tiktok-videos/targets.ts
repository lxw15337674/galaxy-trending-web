import {
  TIKTOK_VIDEO_ORDER_OPTIONS,
  TIKTOK_VIDEO_PERIOD_OPTIONS,
  type TikTokVideoOrderBy,
  type TikTokVideoTarget,
} from './types';

const DEFAULT_TARGET_COUNTRIES = [
  { countryCode: 'US', countryName: 'United States' },
  { countryCode: 'CA', countryName: 'Canada' },
  { countryCode: 'GB', countryName: 'United Kingdom' },
  { countryCode: 'DE', countryName: 'Germany' },
  { countryCode: 'FR', countryName: 'France' },
  { countryCode: 'ES', countryName: 'Spain' },
  { countryCode: 'JP', countryName: 'Japan' },
  { countryCode: 'KR', countryName: 'South Korea' },
  { countryCode: 'ID', countryName: 'Indonesia' },
  { countryCode: 'BR', countryName: 'Brazil' },
  { countryCode: 'MX', countryName: 'Mexico' },
  { countryCode: 'AU', countryName: 'Australia' },
] as const;

function normalizePeriods(periods: number[] | null | undefined) {
  const values = Array.from(
    new Set(
      (periods ?? [])
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value))
        .map((value) => Math.floor(value))
        .filter((value) => value > 0 && value <= 365),
    ),
  );

  return values.length ? values : [...TIKTOK_VIDEO_PERIOD_OPTIONS];
}

function normalizeOrderByList(orderByList: string[] | null | undefined) {
  const allowed = new Set<TikTokVideoOrderBy>(TIKTOK_VIDEO_ORDER_OPTIONS);
  const values = Array.from(
    new Set(
      (orderByList ?? [])
        .map((value) => value.trim().toLowerCase())
        .filter((value): value is TikTokVideoOrderBy => allowed.has(value as TikTokVideoOrderBy)),
    ),
  );

  return values.length ? values : [...TIKTOK_VIDEO_ORDER_OPTIONS];
}

function buildTarget(input: {
  countryCode: string;
  countryName: string;
  locale?: string | null;
  periods?: number[] | null;
  orderByList?: string[] | null;
  browserExecutablePath?: string | null;
}) {
  const countryCode = input.countryCode.trim().toUpperCase();
  const countryName = input.countryName.trim();
  if (!countryCode) {
    throw new Error('TikTok videos target is missing countryCode.');
  }
  if (!countryName) {
    throw new Error(`TikTok videos target country=${countryCode} is missing countryName.`);
  }

  return {
    countryCode,
    countryName,
    locale: input.locale?.trim() || 'en',
    periods: normalizePeriods(input.periods),
    orderByList: normalizeOrderByList(input.orderByList),
    browserExecutablePath: input.browserExecutablePath?.trim() || null,
  } satisfies TikTokVideoTarget;
}

function parseNumberList(rawValue: string | undefined) {
  if (!rawValue) return null;
  return rawValue
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value));
}

function parseStringList(rawValue: string | undefined) {
  if (!rawValue) return null;
  return rawValue
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function parseJsonTargets(raw: string) {
  const parsed = JSON.parse(raw) as unknown;
  const rows = Array.isArray(parsed) ? parsed : [parsed];

  return rows.map((row, index) => {
    if (!row || typeof row !== 'object') {
      throw new Error(`TIKTOK_VIDEO_TARGETS_JSON item ${index} must be an object.`);
    }

    const record = row as Record<string, unknown>;
    return buildTarget({
      countryCode: String(record.countryCode ?? ''),
      countryName: String(record.countryName ?? ''),
      locale: String(record.locale ?? '').trim() || null,
      periods: Array.isArray(record.periods) ? record.periods.map((value) => Number(value)) : null,
      orderByList: Array.isArray(record.orderByList) ? record.orderByList.map((value) => String(value)) : null,
      browserExecutablePath: String(record.browserExecutablePath ?? '').trim() || null,
    });
  });
}

function loadDefaultTargetsFromCode() {
  const locale = process.env.TIKTOK_VIDEO_LOCALE?.trim() || 'en';
  const periods = parseNumberList(process.env.TIKTOK_VIDEO_PERIODS) ?? [...TIKTOK_VIDEO_PERIOD_OPTIONS];
  const orderByList = parseStringList(process.env.TIKTOK_VIDEO_SORTS) ?? [...TIKTOK_VIDEO_ORDER_OPTIONS];
  const browserExecutablePath = process.env.TIKTOK_VIDEO_BROWSER_EXECUTABLE_PATH?.trim() || null;

  return DEFAULT_TARGET_COUNTRIES.map((target) =>
    buildTarget({
      countryCode: target.countryCode,
      countryName: target.countryName,
      locale,
      periods,
      orderByList,
      browserExecutablePath,
    }),
  );
}

export function loadTikTokVideoTargetsFromEnv() {
  const jsonTargets = process.env.TIKTOK_VIDEO_TARGETS_JSON?.trim();
  if (jsonTargets) {
    return parseJsonTargets(jsonTargets);
  }

  return loadDefaultTargetsFromCode();
}
