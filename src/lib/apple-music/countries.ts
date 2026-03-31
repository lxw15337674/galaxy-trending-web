const APPLE_MUSIC_COUNTRY_SLUG_TO_CANONICAL_CODE: Record<string, string> = {
  argentina: 'AR',
  australia: 'AU',
  austria: 'AT',
  belgium: 'BE',
  brazil: 'BR',
  canada: 'CA',
  chile: 'CL',
  colombia: 'CO',
  czechia: 'CZ',
  denmark: 'DK',
  egypt: 'EG',
  finland: 'FI',
  france: 'FR',
  germany: 'DE',
  greece: 'GR',
  hongkong: 'HK',
  hungary: 'HU',
  india: 'IN',
  indonesia: 'ID',
  ireland: 'IE',
  israel: 'IL',
  italy: 'IT',
  japan: 'JP',
  malaysia: 'MY',
  mexico: 'MX',
  netherlands: 'NL',
  newzealand: 'NZ',
  norway: 'NO',
  philippines: 'PH',
  poland: 'PL',
  portugal: 'PT',
  romania: 'RO',
  saudiarabia: 'SA',
  singapore: 'SG',
  southafrica: 'ZA',
  southkorea: 'KR',
  spain: 'ES',
  sweden: 'SE',
  switzerland: 'CH',
  taiwan: 'TW',
  thailand: 'TH',
  turkey: 'TR',
  uk: 'GB',
  usa: 'US',
  vietnam: 'VN',
};

const APPLE_MUSIC_CANONICAL_CODE_TO_COUNTRY_SLUG = Object.fromEntries(
  Object.entries(APPLE_MUSIC_COUNTRY_SLUG_TO_CANONICAL_CODE).map(([slug, code]) => [code, slug]),
) as Record<string, string>;

export const APPLE_MUSIC_KNOWN_COUNTRY_CODES = Object.freeze(
  Array.from(new Set(Object.values(APPLE_MUSIC_COUNTRY_SLUG_TO_CANONICAL_CODE))).sort(),
);

export function normalizeAppleMusicCountryCode(value: string | null | undefined) {
  const rawValue = String(value ?? '').trim();
  if (!rawValue) return 'global';
  if (rawValue.toLowerCase() === 'global') return 'global';

  const lowerValue = rawValue.toLowerCase();
  const canonicalFromSlug = APPLE_MUSIC_COUNTRY_SLUG_TO_CANONICAL_CODE[lowerValue];
  if (canonicalFromSlug) {
    return canonicalFromSlug;
  }

  if (/^[A-Za-z]{2}$/.test(rawValue)) {
    return rawValue.toUpperCase();
  }

  return lowerValue;
}

export function getAppleMusicCountrySlug(value: string | null | undefined) {
  const normalizedCountryCode = normalizeAppleMusicCountryCode(value);
  if (normalizedCountryCode === 'global') {
    return 'global';
  }

  return APPLE_MUSIC_CANONICAL_CODE_TO_COUNTRY_SLUG[normalizedCountryCode] ?? null;
}

export function getAppleMusicCountryRegionCode(value: string | null | undefined) {
  const normalizedCountryCode = normalizeAppleMusicCountryCode(value);
  if (normalizedCountryCode === 'global') {
    return null;
  }

  return /^[A-Z]{2}$/.test(normalizedCountryCode) ? normalizedCountryCode : null;
}

export function getAppleMusicCountryCodeAliases(value: string | null | undefined) {
  const normalizedCountryCode = normalizeAppleMusicCountryCode(value);
  if (normalizedCountryCode === 'global') {
    return ['global'];
  }

  const aliases = new Set<string>([normalizedCountryCode]);
  const slug = getAppleMusicCountrySlug(normalizedCountryCode);
  if (slug) {
    aliases.add(slug);
  }

  return Array.from(aliases);
}

export function getAppleMusicCountryName(value: string | null | undefined, locale = 'en') {
  const regionCode = getAppleMusicCountryRegionCode(value);
  if (!regionCode) return null;

  try {
    const displayNames = new Intl.DisplayNames([locale], { type: 'region' });
    return displayNames.of(regionCode) ?? regionCode;
  } catch {
    return regionCode;
  }
}
