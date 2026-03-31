import type {
  ListTopCategoriesOptions,
  ListTopCategoriesResult,
  ListTopStreamsOptions,
  ListTopStreamsResult,
  TwitchAccessTokenResponse,
  TwitchApiResponse,
  TwitchGame,
  TwitchStream,
  TwitchTopCategoryItem,
  TwitchTopStreamItem,
  TwitchUser,
} from './types';

const TWITCH_OAUTH_TOKEN_URL = 'https://id.twitch.tv/oauth2/token';
const TWITCH_HELIX_BASE_URL = 'https://api.twitch.tv/helix';
const DEFAULT_PAGE_SIZE = 100;
const DEFAULT_PAGES = 1;
const MAX_PAGE_SIZE = 100;
const MAX_PAGES = 20;
const REQUEST_TIMEOUT_MS = 15000;

function parsePositiveInt(value: number | undefined, fallback: number, min: number, max: number) {
  const normalized = Number.isFinite(value) ? Math.floor(Number(value)) : fallback;
  if (normalized < min) return min;
  if (normalized > max) return max;
  return normalized;
}

function normalizeLanguage(value: string | undefined) {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized || undefined;
}

function normalizeGameIds(values: string[] | undefined) {
  if (!values?.length) return [];
  return Array.from(
    new Set(
      values
        .map((value) => String(value).trim())
        .filter(Boolean),
    ),
  );
}

function normalizeTwitchThumbnailUrl(url: string | null | undefined, width = 640, height = 360) {
  const normalizedUrl = String(url ?? '').trim();
  if (!normalizedUrl) return null;
  return normalizedUrl.replace('{width}', String(width)).replace('{height}', String(height));
}

function normalizeTwitchBoxArtUrl(url: string | null | undefined, width = 560, height = 746) {
  const normalizedUrl = String(url ?? '').trim();
  if (!normalizedUrl) return null;
  return normalizedUrl.replace('{width}', String(width)).replace('{height}', String(height));
}

function toDirectoryUrl(gameName: string) {
  return `https://www.twitch.tv/directory/category/${encodeURIComponent(gameName)}`;
}

export class TwitchHelixClient {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private tokenCache:
    | {
        accessToken: string;
        expiresAt: number;
      }
    | null = null;

  constructor(clientId: string, clientSecret: string) {
    this.clientId = clientId.trim();
    this.clientSecret = clientSecret.trim();

    if (!this.clientId) {
      throw new Error('TWITCH_CLIENT_ID is missing');
    }

    if (!this.clientSecret) {
      throw new Error('TWITCH_CLIENT_SECRET is missing');
    }
  }

  private async requestJson<TResponse>(url: string, init?: RequestInit) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
      });
      const text = await response.text();
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}: ${text.slice(0, 300)}`);
      }

      return JSON.parse(text) as TResponse;
    } finally {
      clearTimeout(timer);
    }
  }

  private async getAppAccessToken() {
    const now = Date.now();
    if (this.tokenCache && now < this.tokenCache.expiresAt) {
      return this.tokenCache.accessToken;
    }

    const body = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      grant_type: 'client_credentials',
    });

    const response = await this.requestJson<TwitchAccessTokenResponse>(TWITCH_OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    const accessToken = String(response.access_token ?? '').trim();
    const expiresIn = Number(response.expires_in ?? 0);
    const tokenType = String(response.token_type ?? '').trim().toLowerCase();

    if (!accessToken || !expiresIn || tokenType !== 'bearer') {
      throw new Error('Failed to obtain Twitch app access token');
    }

    this.tokenCache = {
      accessToken,
      expiresAt: now + Math.max(60, expiresIn - 60) * 1000,
    };

    return accessToken;
  }

  private async helixGet<TResponse>(path: string, searchParams?: URLSearchParams) {
    const accessToken = await this.getAppAccessToken();
    const url = new URL(`${TWITCH_HELIX_BASE_URL}${path}`);
    if (searchParams) {
      url.search = searchParams.toString();
    }

    return this.requestJson<TResponse>(url.toString(), {
      method: 'GET',
      headers: {
        'Client-Id': this.clientId,
        Authorization: `Bearer ${accessToken}`,
      },
    });
  }

  private async getUsersByIds(userIds: string[]) {
    const normalizedIds = Array.from(
      new Set(
        userIds
          .map((value) => String(value).trim())
          .filter(Boolean),
      ),
    ).slice(0, 100);

    if (!normalizedIds.length) {
      return new Map<string, TwitchUser>();
    }

    const searchParams = new URLSearchParams();
    for (const userId of normalizedIds) {
      searchParams.append('id', userId);
    }

    const response = await this.helixGet<TwitchApiResponse<TwitchUser>>('/users', searchParams);
    return new Map(response.data.map((user) => [user.id, user]));
  }

  async listTopStreams(options: ListTopStreamsOptions = {}): Promise<ListTopStreamsResult> {
    const pageSize = parsePositiveInt(options.pageSize, DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE);
    const pages = parsePositiveInt(options.pages, DEFAULT_PAGES, 1, MAX_PAGES);
    const language = normalizeLanguage(options.language);
    const gameIds = normalizeGameIds(options.gameIds);

    const streams: TwitchStream[] = [];
    let cursor: string | undefined;

    for (let page = 0; page < pages; page += 1) {
      const searchParams = new URLSearchParams();
      searchParams.set('first', String(pageSize));
      if (language) {
        searchParams.set('language', language);
      }
      for (const gameId of gameIds) {
        searchParams.append('game_id', gameId);
      }
      if (cursor) {
        searchParams.set('after', cursor);
      }

      const response = await this.helixGet<TwitchApiResponse<TwitchStream>>('/streams', searchParams);
      streams.push(...response.data);
      cursor = response.pagination?.cursor;
      if (!cursor || response.data.length < pageSize) {
        break;
      }
    }

    const usersById = await this.getUsersByIds(streams.map((stream) => stream.user_id));

    const items: TwitchTopStreamItem[] = streams.map((stream) => ({
      streamId: stream.id,
      userId: stream.user_id,
      userLogin: stream.user_login,
      userName: stream.user_name,
      gameId: stream.game_id,
      gameName: stream.game_name,
      streamType: stream.type,
      title: stream.title,
      viewerCount: stream.viewer_count,
      startedAt: stream.started_at,
      language: stream.language,
      thumbnailUrl: normalizeTwitchThumbnailUrl(stream.thumbnail_url),
      channelAvatarUrl: usersById.get(stream.user_id)?.profile_image_url ?? null,
      tags: stream.tags ?? [],
      isMature: Boolean(stream.is_mature),
      streamUrl: `https://www.twitch.tv/${stream.user_login}`,
    }));

    return {
      fetchedAt: new Date().toISOString(),
      itemCount: items.length,
      items,
    };
  }

  async listTopCategories(options: ListTopCategoriesOptions = {}): Promise<ListTopCategoriesResult> {
    const pageSize = parsePositiveInt(options.pageSize, DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE);
    const pages = parsePositiveInt(options.pages, DEFAULT_PAGES, 1, MAX_PAGES);

    const items: TwitchTopCategoryItem[] = [];
    let cursor: string | undefined;

    for (let page = 0; page < pages; page += 1) {
      const searchParams = new URLSearchParams();
      searchParams.set('first', String(pageSize));
      if (cursor) {
        searchParams.set('after', cursor);
      }

      const response = await this.helixGet<TwitchApiResponse<TwitchGame>>('/games/top', searchParams);
      items.push(
        ...response.data.map((game) => ({
          gameId: game.id,
          name: game.name,
          boxArtUrl: normalizeTwitchBoxArtUrl(game.box_art_url),
          directoryUrl: toDirectoryUrl(game.name),
        })),
      );

      cursor = response.pagination?.cursor;
      if (!cursor || response.data.length < pageSize) {
        break;
      }
    }

    return {
      fetchedAt: new Date().toISOString(),
      itemCount: items.length,
      items,
    };
  }
}
