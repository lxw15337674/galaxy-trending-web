import { execFile } from 'node:child_process';
import axios from 'axios';
import type { SteamChartItem, SteamChartSnapshot, SteamChartType } from './types';
import {
  STEAM_CHART_SOURCES,
  STEAM_CHART_TYPE_TOP_SELLERS,
  STEAM_CHART_TYPE_TRENDING,
  STEAM_SCOPE_CODE_GLOBAL,
  STEAM_SCOPE_NAME_GLOBAL,
} from './types';

const DEFAULT_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

function isNonNull<T>(value: T | null): value is T {
  return value !== null;
}

async function fetchSteamHtmlViaPowerShell(url: string) {
  return await new Promise<string>((resolve, reject) => {
    const command = [
      '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8',
      `$resp = Invoke-WebRequest -Uri '${url}' -Headers @{ 'User-Agent'='${DEFAULT_HEADERS['User-Agent']}' } -UseBasicParsing`,
      '[Console]::Write($resp.Content)',
    ].join('; ');

    execFile('powershell.exe', ['-NoProfile', '-Command', command], { timeout: 60000 }, (error, stdout) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(stdout);
    });
  });
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}

function stripTags(value: string) {
  return value.replace(/<[^>]+>/g, ' ');
}

function normalizeText(value: string | null | undefined) {
  if (!value) return null;
  const normalized = stripTags(decodeHtmlEntities(value)).replace(/\s+/g, ' ').trim();
  return normalized || null;
}

function extractFirstMatch(text: string, pattern: RegExp) {
  const match = text.match(pattern);
  return match?.[1] ?? null;
}

function extractAllMatches(text: string, pattern: RegExp) {
  return Array.from(text.matchAll(pattern), (match) => match[1] ?? '').filter(Boolean);
}

function parseInteger(value: string | null | undefined) {
  if (!value) return null;
  const parsed = Number.parseInt(value.replace(/[^\d-]+/g, ''), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function getDefaultThumbnailUrl(appId: number | null) {
  if (!appId) return null;
  return `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/capsule_231x87.jpg`;
}

function parseSteamIdentity(block: string) {
  const itemKey = extractFirstMatch(block, /data-ds-itemkey="([^"]+)"/i);
  const dsAppId = extractFirstMatch(block, /data-ds-appid="([^"]+)"/i);
  const href = extractFirstMatch(block, /href="([^"]+)"/i) ?? '';
  const urlMatch = href.match(/\/(app|sub|bundle)\/(\d+)/i);

  if (itemKey) {
    const appKeyMatch = itemKey.match(/^App_(\d+)$/i);
    if (appKeyMatch) {
      const appId = Number.parseInt(appKeyMatch[1], 10);
      return {
        steamItemId: itemKey,
        steamAppId: Number.isFinite(appId) ? appId : null,
      };
    }

    return {
      steamItemId: itemKey,
      steamAppId: null,
    };
  }

  if (urlMatch) {
    const appId = urlMatch[1].toLowerCase() === 'app' ? Number.parseInt(urlMatch[2], 10) : null;
    return {
      steamItemId: `${urlMatch[1].toLowerCase()}_${urlMatch[2]}`,
      steamAppId: Number.isFinite(appId ?? Number.NaN) ? appId : null,
    };
  }

  const firstAppId = dsAppId?.split(',')[0]?.trim() || null;
  const parsedAppId = firstAppId ? Number.parseInt(firstAppId, 10) : null;
  return {
    steamItemId: firstAppId ? `app_${firstAppId}` : href || `unknown_${Date.now()}`,
    steamAppId: Number.isFinite(parsedAppId ?? Number.NaN) ? parsedAppId : null,
  };
}

function parseTopSellers(html: string): SteamChartItem[] {
  const blocks = html.match(/<a\b[^>]*class="search_result_row[^"]*"[^>]*>[\s\S]*?<\/a>/gi) ?? [];

  return blocks
    .map<SteamChartItem | null>((block, index) => {
      const { steamItemId, steamAppId } = parseSteamIdentity(block);
      const steamUrl = decodeHtmlEntities(extractFirstMatch(block, /href="([^"]+)"/i) ?? '');
      const gameName = normalizeText(extractFirstMatch(block, /<span class="title">([\s\S]*?)<\/span>/i));
      if (!steamUrl || !gameName) return null;

      const thumbnailUrl =
        decodeHtmlEntities(extractFirstMatch(block, /<div class="search_capsule"><img src="([^"]+)"/i) ?? '') ||
        getDefaultThumbnailUrl(steamAppId);
      const priceText = normalizeText(extractFirstMatch(block, /<div class="discount_final_price[^"]*">([\s\S]*?)<\/div>/i));
      const originalPriceText = normalizeText(
        extractFirstMatch(block, /<div class="discount_original_price">([\s\S]*?)<\/div>/i),
      );
      const releaseDateText = normalizeText(
        extractFirstMatch(block, /<div class="search_released[^"]*">([\s\S]*?)<\/div>/i),
      );

      return {
        rank: index + 1,
        steamItemId,
        steamAppId,
        gameName,
        steamUrl,
        thumbnailUrl,
        currentPlayers: null,
        peakToday: null,
        priceText,
        originalPriceText,
        discountPercent: parseInteger(extractFirstMatch(block, /<div class="discount_pct">([\s\S]*?)<\/div>/i)),
        releaseDateText,
        tagSummary: null,
        rawItem: {
          steamItemId,
          steamAppId,
          steamUrl,
          priceText,
          originalPriceText,
          releaseDateText,
        },
      } satisfies SteamChartItem;
    })
    .filter(isNonNull);
}

function parseMostPlayed(html: string): SteamChartItem[] {
  const blocks = html.match(/<tr class="player_count_row"[\s\S]*?<\/tr>/gi) ?? [];

  return blocks
    .map<SteamChartItem | null>((block, index) => {
      const counts = extractAllMatches(block, /<span[^>]*class="currentServers"[^>]*>([\s\S]*?)<\/span>/gi).map((value) =>
        parseInteger(normalizeText(value)),
      );
      const steamUrl = decodeHtmlEntities(extractFirstMatch(block, /href="([^"]+)"/i) ?? '');
      const gameName = normalizeText(extractFirstMatch(block, /<a class="gameLink"[\s\S]*?>([\s\S]*?)<\/a>/i));
      const identity = parseSteamIdentity(block);

      if (!steamUrl || !gameName) return null;

      return {
        rank: index + 1,
        steamItemId: identity.steamItemId,
        steamAppId: identity.steamAppId,
        gameName,
        steamUrl,
        thumbnailUrl: getDefaultThumbnailUrl(identity.steamAppId),
        currentPlayers: counts[0] ?? null,
        peakToday: counts[1] ?? null,
        priceText: null,
        originalPriceText: null,
        discountPercent: null,
        releaseDateText: null,
        tagSummary: null,
        rawItem: {
          steamItemId: identity.steamItemId,
          steamAppId: identity.steamAppId,
          steamUrl,
          currentPlayers: counts[0] ?? null,
          peakToday: counts[1] ?? null,
        },
      } satisfies SteamChartItem;
    })
    .filter(isNonNull);
}

function getTrendingSectionHtml(html: string) {
  const sectionStart = html.indexOf('id="tab_newreleases_content"');
  if (sectionStart < 0) {
    throw new Error('Steam Popular New Releases section not found');
  }

  const nextSection = html.indexOf('id="tab_allnewreleases_content"', sectionStart);
  return nextSection > sectionStart ? html.slice(sectionStart, nextSection) : html.slice(sectionStart);
}

function parseTrending(html: string): SteamChartItem[] {
  const sectionHtml = getTrendingSectionHtml(html);
  const blocks = sectionHtml.match(/<a\b[^>]*class="tab_item[^"]*"[^>]*>[\s\S]*?<\/a>/gi) ?? [];

  return blocks
    .map<SteamChartItem | null>((block, index) => {
      const { steamItemId, steamAppId } = parseSteamIdentity(block);
      const steamUrl = decodeHtmlEntities(extractFirstMatch(block, /href="([^"]+)"/i) ?? '');
      const gameName = normalizeText(extractFirstMatch(block, /<div class="tab_item_name">([\s\S]*?)<\/div>/i));
      if (!steamUrl || !gameName) return null;

      const tags = extractAllMatches(block, /<span class="top_tag">([\s\S]*?)<\/span>/gi)
        .map((value) => normalizeText(value))
        .filter((value): value is string => Boolean(value))
        .map((value) => value.replace(/^,\s*/, ''));

      const thumbnailUrl =
        decodeHtmlEntities(extractFirstMatch(block, /<img class="tab_item_cap_img" src="([^"]+)"/i) ?? '') ||
        getDefaultThumbnailUrl(steamAppId);
      const priceText = normalizeText(extractFirstMatch(block, /<div class="discount_final_price">([\s\S]*?)<\/div>/i));
      const originalPriceText = normalizeText(
        extractFirstMatch(block, /<div class="discount_original_price">([\s\S]*?)<\/div>/i),
      );

      return {
        rank: index + 1,
        steamItemId,
        steamAppId,
        gameName,
        steamUrl,
        thumbnailUrl,
        currentPlayers: null,
        peakToday: null,
        priceText,
        originalPriceText,
        discountPercent: parseInteger(extractFirstMatch(block, /<div class="discount_pct">([\s\S]*?)<\/div>/i)),
        releaseDateText: null,
        tagSummary: tags.length ? tags.join(', ') : null,
        rawItem: {
          steamItemId,
          steamAppId,
          steamUrl,
          priceText,
          originalPriceText,
          tags,
        },
      } satisfies SteamChartItem;
    })
    .filter(isNonNull);
}

function parseChartItems(chartType: SteamChartType, html: string) {
  if (chartType === STEAM_CHART_TYPE_TOP_SELLERS) return parseTopSellers(html);
  if (chartType === STEAM_CHART_TYPE_TRENDING) return parseTrending(html);
  return parseMostPlayed(html);
}

export function dedupeSteamChartItems(items: SteamChartItem[]): SteamChartItem[] {
  const seen = new Set<string>();
  const dedupedItems: SteamChartItem[] = [];

  for (const item of items) {
    if (seen.has(item.steamItemId)) {
      continue;
    }

    seen.add(item.steamItemId);
    dedupedItems.push({
      ...item,
      rank: dedupedItems.length + 1,
    });
  }

  return dedupedItems;
}

export class SteamChartsCrawler {
  async fetchChart(chartType: SteamChartType, snapshotHour: string): Promise<SteamChartSnapshot> {
    const source = STEAM_CHART_SOURCES[chartType];
    let html = '';

    try {
      const response = await axios.get<string>(source.sourceUrl, {
        headers: DEFAULT_HEADERS,
        responseType: 'text',
        timeout: 30000,
        transformResponse: [(value) => value],
      });
      html = typeof response.data === 'string' ? response.data : String(response.data ?? '');
    } catch (error) {
      if (process.platform !== 'win32') {
        throw error;
      }

      html = await fetchSteamHtmlViaPowerShell(source.sourceUrl);
    }

    const parsedItems = parseChartItems(chartType, html);
    const items = dedupeSteamChartItems(parsedItems);
    const fetchedAt = new Date().toISOString();

    if (!items.length) {
      throw new Error(`Steam ${chartType} parser returned 0 items`);
    }

    return {
      chartType,
      scopeCode: STEAM_SCOPE_CODE_GLOBAL,
      scopeName: STEAM_SCOPE_NAME_GLOBAL,
      snapshotHour,
      fetchedAt,
      sourceUrl: source.sourceUrl,
      chartLabel: source.chartLabel,
      items,
      rawPayload: {
        chartType,
        scopeCode: STEAM_SCOPE_CODE_GLOBAL,
        sourceUrl: source.sourceUrl,
        chartLabel: source.chartLabel,
        itemCount: items.length,
      },
    } satisfies SteamChartSnapshot;
  }
}
