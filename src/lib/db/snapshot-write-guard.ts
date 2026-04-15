export function toComparableJson(value: unknown) {
  return JSON.stringify(value ?? null);
}

export function areComparableValuesEqual(left: unknown, right: unknown) {
  return toComparableJson(left) === toComparableJson(right);
}

/**
 * Compare stored snapshot content with freshly crawled content while ignoring
 * volatile fields like fetched timestamps and raw payloads.
 */
export function areSnapshotContentsEqual<TExistingItem, TNextItem>(params: {
  existingMeta: unknown;
  nextMeta: unknown;
  existingItems: TExistingItem[];
  nextItems: TNextItem[];
  mapExistingItem: (item: TExistingItem) => unknown;
  mapNextItem: (item: TNextItem) => unknown;
}) {
  if (toComparableJson(params.existingMeta) !== toComparableJson(params.nextMeta)) {
    return false;
  }

  return (
    toComparableJson(params.existingItems.map(params.mapExistingItem)) ===
    toComparableJson(params.nextItems.map(params.mapNextItem))
  );
}
