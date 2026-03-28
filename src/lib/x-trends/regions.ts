const X_TREND_REGION_LABELS = {
  hk: 'Hong Kong',
  tw: 'Taiwan',
  jp: 'Japan',
  kr: 'South Korea',
  sg: 'Singapore',
  us: 'United States',
  gb: 'United Kingdom',
  au: 'Australia',
  ca: 'Canada',
  de: 'Germany',
  fr: 'France',
  br: 'Brazil',
  in: 'India',
  id: 'Indonesia',
  th: 'Thailand',
  my: 'Malaysia',
  ph: 'Philippines',
  vn: 'Vietnam',
  tr: 'Turkey',
  global: 'Global',
} as const satisfies Record<string, string>;

export function resolveXTrendRegionLabel(regionKey: string, explicitLabel?: string | null) {
  const normalizedRegionKey = regionKey.trim().toLowerCase();
  const normalizedExplicitLabel = explicitLabel?.trim() || null;

  if (normalizedExplicitLabel) {
    return normalizedExplicitLabel;
  }

  const mappedLabel = X_TREND_REGION_LABELS[normalizedRegionKey as keyof typeof X_TREND_REGION_LABELS];
  if (mappedLabel) {
    return mappedLabel;
  }

  throw new Error(
    `Unsupported X trend region key: ${normalizedRegionKey}. Add it to src/lib/x-trends/regions.ts or provide regionLabel in X_TREND_TARGETS_JSON.`,
  );
}

export function listSupportedXTrendRegionKeys() {
  return Object.keys(X_TREND_REGION_LABELS).sort();
}
