export interface TwitchPagination {
  cursor?: string;
}

export interface TwitchApiResponse<TData> {
  data: TData[];
  pagination?: TwitchPagination;
}

export interface TwitchAccessTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

export interface TwitchStream {
  id: string;
  user_id: string;
  user_login: string;
  user_name: string;
  game_id: string;
  game_name: string;
  type: string;
  title: string;
  viewer_count: number;
  started_at: string;
  language: string;
  thumbnail_url: string;
  tag_ids?: string[];
  tags?: string[];
  is_mature: boolean;
}

export interface TwitchUser {
  id: string;
  login: string;
  display_name: string;
  profile_image_url: string;
}

export interface TwitchGame {
  id: string;
  name: string;
  box_art_url: string;
  igdb_id?: string;
}

export interface TwitchTopStreamItem {
  streamId: string;
  userId: string;
  userLogin: string;
  userName: string;
  gameId: string;
  gameName: string;
  streamType: string;
  title: string;
  viewerCount: number;
  startedAt: string;
  language: string;
  thumbnailUrl: string | null;
  channelAvatarUrl: string | null;
  tags: string[];
  isMature: boolean;
  streamUrl: string;
}

export interface TwitchTopCategoryItem {
  gameId: string;
  name: string;
  boxArtUrl: string | null;
  directoryUrl: string;
}

export interface ListTopStreamsOptions {
  pageSize?: number;
  pages?: number;
  language?: string;
  gameIds?: string[];
}

export interface ListTopStreamsResult {
  fetchedAt: string;
  itemCount: number;
  items: TwitchTopStreamItem[];
}

export interface ListTopCategoriesOptions {
  pageSize?: number;
  pages?: number;
}

export interface ListTopCategoriesResult {
  fetchedAt: string;
  itemCount: number;
  items: TwitchTopCategoryItem[];
}
