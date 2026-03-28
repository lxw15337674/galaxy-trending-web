interface XTrendRegionConfig {
  label: string;
  locationSearchQuery?: string;
  locationSelectText?: string;
}

const X_TREND_REGION_CONFIGS: Record<string, XTrendRegionConfig> = {
  hk: { label: 'Hong Kong', locationSearchQuery: 'Hong Kong', locationSelectText: 'Hong Kong' },
  tw: { label: 'Taiwan', locationSearchQuery: 'Taiwan', locationSelectText: 'Taiwan' },
  jp: { label: 'Japan', locationSearchQuery: 'Japan', locationSelectText: 'Japan' },
  kr: { label: 'South Korea', locationSearchQuery: 'South Korea', locationSelectText: 'South Korea' },
  sg: { label: 'Singapore', locationSearchQuery: 'Singapore', locationSelectText: 'Singapore' },
  us: { label: 'United States', locationSearchQuery: 'United States', locationSelectText: 'United States' },
  gb: { label: 'United Kingdom', locationSearchQuery: 'United Kingdom', locationSelectText: 'United Kingdom' },
  au: { label: 'Australia', locationSearchQuery: 'Australia', locationSelectText: 'Australia' },
  ca: { label: 'Canada', locationSearchQuery: 'Canada', locationSelectText: 'Canada' },
  de: { label: 'Germany', locationSearchQuery: 'Germany', locationSelectText: 'Germany' },
  fr: { label: 'France', locationSearchQuery: 'France', locationSelectText: 'France' },
  br: { label: 'Brazil', locationSearchQuery: 'Brazil', locationSelectText: 'Brazil' },
  in: { label: 'India', locationSearchQuery: 'India', locationSelectText: 'India' },
  id: { label: 'Indonesia', locationSearchQuery: 'Indonesia', locationSelectText: 'Indonesia' },
  mx: { label: 'Mexico', locationSearchQuery: 'Mexico', locationSelectText: 'Mexico' },
  sa: { label: 'Saudi Arabia', locationSearchQuery: 'Saudi Arabia', locationSelectText: 'Saudi Arabia' },
  th: { label: 'Thailand', locationSearchQuery: 'Thailand', locationSelectText: 'Thailand' },
  my: { label: 'Malaysia', locationSearchQuery: 'Malaysia', locationSelectText: 'Malaysia' },
  ph: { label: 'Philippines', locationSearchQuery: 'Philippines', locationSelectText: 'Philippines' },
  vn: { label: 'Vietnam', locationSearchQuery: 'Vietnam', locationSelectText: 'Vietnam' },
  tr: { label: 'Turkey', locationSearchQuery: 'Turkey', locationSelectText: 'Turkey' },
  global: { label: 'Global' },
};

export function resolveXTrendRegionLabel(regionKey: string, explicitLabel?: string | null) {
  const normalizedRegionKey = regionKey.trim().toLowerCase();
  const normalizedExplicitLabel = explicitLabel?.trim() || null;

  if (normalizedExplicitLabel) {
    return normalizedExplicitLabel;
  }

  const mappedLabel = X_TREND_REGION_CONFIGS[normalizedRegionKey]?.label;
  if (mappedLabel) {
    return mappedLabel;
  }

  throw new Error(
    `Unsupported X trend region key: ${normalizedRegionKey}. Add it to src/lib/x-trends/regions.ts or provide regionLabel in X_TREND_TARGETS_JSON.`,
  );
}

export function resolveXTrendRegionLocationConfig(regionKey: string) {
  const normalizedRegionKey = regionKey.trim().toLowerCase();
  const config = X_TREND_REGION_CONFIGS[normalizedRegionKey];

  if (!config?.locationSearchQuery || !config.locationSelectText) {
    throw new Error(
      `Unsupported X trend location config for region key: ${normalizedRegionKey}. Add it to src/lib/x-trends/regions.ts or provide explicit locationSearchQuery/locationSelectText in X_TREND_TARGETS_JSON.`,
    );
  }

  return {
    locationSearchQuery: config.locationSearchQuery,
    locationSelectText: config.locationSelectText,
  };
}

export function listSupportedXTrendRegionKeys() {
  return Object.keys(X_TREND_REGION_CONFIGS).sort();
}
