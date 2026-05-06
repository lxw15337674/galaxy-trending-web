import assert from 'node:assert/strict';
import test from 'node:test';
import { dedupeSteamChartItems } from './crawler';
import type { SteamChartItem } from './types';

function createItem(overrides: Partial<SteamChartItem>): SteamChartItem {
  return {
    rank: 1,
    steamItemId: 'App_1',
    steamAppId: 1,
    gameName: 'Example Game',
    steamUrl: 'https://store.steampowered.com/app/1/example/',
    thumbnailUrl: null,
    currentPlayers: null,
    peakToday: null,
    priceText: null,
    originalPriceText: null,
    discountPercent: null,
    releaseDateText: null,
    tagSummary: null,
    rawItem: {},
    ...overrides,
  };
}

test('dedupeSteamChartItems removes duplicate steamItemId values and reassigns ranks', () => {
  const items = [
    createItem({ rank: 1, steamItemId: 'App_100', steamAppId: 100, gameName: 'First Entry' }),
    createItem({ rank: 2, steamItemId: 'App_200', steamAppId: 200, gameName: 'Second Entry' }),
    createItem({ rank: 3, steamItemId: 'App_100', steamAppId: 100, gameName: 'Duplicate Entry' }),
  ];

  const deduped = dedupeSteamChartItems(items);

  assert.equal(deduped.length, 2);
  assert.deepEqual(
    deduped.map((item) => ({ rank: item.rank, steamItemId: item.steamItemId, gameName: item.gameName })),
    [
      { rank: 1, steamItemId: 'App_100', gameName: 'First Entry' },
      { rank: 2, steamItemId: 'App_200', gameName: 'Second Entry' },
    ],
  );
});
