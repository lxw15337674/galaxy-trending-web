interface RankedItem {
  rank: number;
}

export function dedupeYouTubeMusicItemsByRank<TItem extends RankedItem>(items: TItem[]) {
  const seen = new Set<number>();
  const deduped: TItem[] = [];
  let duplicateCount = 0;

  for (const item of items) {
    if (seen.has(item.rank)) {
      duplicateCount += 1;
      continue;
    }

    seen.add(item.rank);
    deduped.push(item);
  }

  return {
    items: deduped,
    duplicateCount,
  };
}
