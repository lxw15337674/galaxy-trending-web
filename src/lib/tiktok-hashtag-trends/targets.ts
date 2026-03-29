import { TikTokHashtagTarget } from './types';

const DEFAULT_TARGET_COUNTRIES = [
  { countryCode: 'US', countryName: 'United States' },
  { countryCode: 'GB', countryName: 'United Kingdom' },
  { countryCode: 'JP', countryName: 'Japan' },
  { countryCode: 'ID', countryName: 'Indonesia' },
] as const;

function buildTarget(input: {
  countryCode: string;
  countryName: string;
  locale?: string | null;
  period?: number | null;
  industryIds?: string | null;
  keyword?: string | null;
  filterBy?: string | null;
  browserExecutablePath?: string | null;
}) {
  const countryCode = input.countryCode.trim().toUpperCase();
  const countryName = input.countryName.trim();
  if (!countryCode) {
    throw new Error('TikTok hashtag target is missing countryCode.');
  }
  if (!countryName) {
    throw new Error(`TikTok hashtag target country=${countryCode} is missing countryName.`);
  }

  return {
    countryCode,
    countryName,
    locale: input.locale?.trim() || 'en',
    period: Math.max(1, Math.min(365, Math.floor(input.period ?? 7))),
    industryIds: input.industryIds?.trim() || '',
    keyword: input.keyword?.trim() || '',
    filterBy: input.filterBy?.trim() || '',
    browserExecutablePath: input.browserExecutablePath?.trim() || null,
  } satisfies TikTokHashtagTarget;
}

function parseJsonTargets(raw: string) {
  const parsed = JSON.parse(raw) as unknown;
  const rows = Array.isArray(parsed) ? parsed : [parsed];

  return rows.map((row, index) => {
    if (!row || typeof row !== 'object') {
      throw new Error(`TIKTOK_TREND_TARGETS_JSON item ${index} must be an object.`);
    }

    const record = row as Record<string, unknown>;
    return buildTarget({
      countryCode: String(record.countryCode ?? ''),
      countryName: String(record.countryName ?? ''),
      locale: String(record.locale ?? '').trim() || null,
      period: Number(record.period ?? 7),
      industryIds: String(record.industryIds ?? '').trim() || null,
      keyword: String(record.keyword ?? '').trim() || null,
      filterBy: String(record.filterBy ?? '').trim() || null,
      browserExecutablePath: String(record.browserExecutablePath ?? '').trim() || null,
    });
  });
}

function loadDefaultTargetsFromCode() {
  const locale = process.env.TIKTOK_TREND_LOCALE?.trim() || 'en';
  const period = Number(process.env.TIKTOK_TREND_PERIOD ?? 7);
  const industryIds = process.env.TIKTOK_TREND_INDUSTRY_IDS?.trim() || '';
  const keyword = process.env.TIKTOK_TREND_KEYWORD?.trim() || '';
  const filterBy = process.env.TIKTOK_TREND_FILTER_BY?.trim() || '';
  const browserExecutablePath = process.env.TIKTOK_TREND_BROWSER_EXECUTABLE_PATH?.trim() || null;

  return DEFAULT_TARGET_COUNTRIES.map((target) =>
    buildTarget({
      countryCode: target.countryCode,
      countryName: target.countryName,
      locale,
      period,
      industryIds,
      keyword,
      filterBy,
      browserExecutablePath,
    }),
  );
}

export function loadTikTokHashtagTargetsFromEnv() {
  const jsonTargets = process.env.TIKTOK_TREND_TARGETS_JSON?.trim();
  if (jsonTargets) {
    return parseJsonTargets(jsonTargets);
  }

  return loadDefaultTargetsFromCode();
}
