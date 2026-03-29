import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text, uniqueIndex, index } from 'drizzle-orm/sqlite-core';

export const youtubeHotHourlyBatches = sqliteTable(
  'youtube_hot_hourly_batches',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    snapshotHour: text('snapshot_hour').notNull(),
    batchStatus: text('batch_status').notNull().default('pending'),
    sourceName: text('source_name').notNull().default('youtube-mostPopular'),
    generatedAt: text('generated_at'),
    regionCount: integer('region_count').notNull().default(0),
    successRegionCount: integer('success_region_count').notNull().default(0),
    failedRegionCount: integer('failed_region_count').notNull().default(0),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
    updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    snapshotHourUnique: uniqueIndex('idx_youtube_hot_hourly_batches_snapshot_hour').on(table.snapshotHour),
    statusHourIdx: index('idx_youtube_hot_hourly_batches_status_hour').on(table.batchStatus, table.snapshotHour),
  }),
);

export const youtubeHotHourlySnapshots = sqliteTable(
  'youtube_hot_hourly_snapshots',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    batchId: integer('batch_id')
      .notNull()
      .references(() => youtubeHotHourlyBatches.id, { onDelete: 'cascade' }),
    regionCode: text('region_code').notNull(),
    regionName: text('region_name').notNull(),
    fetchedAt: text('fetched_at').notNull().default(sql`(datetime('now'))`),
    status: text('status').notNull(),
    sourceUrl: text('source_url').notNull(),
    itemCount: integer('item_count').notNull().default(0),
    errorText: text('error_text'),
    rawPayload: text('raw_payload'),
  },
  (table) => ({
    batchRegionUnique: uniqueIndex('idx_youtube_hot_hourly_snapshots_batch_region_unique').on(
      table.batchId,
      table.regionCode,
    ),
    batchRegionIdx: index('idx_youtube_hot_hourly_snapshots_batch_region').on(table.batchId, table.regionCode),
    batchStatusIdx: index('idx_youtube_hot_hourly_snapshots_batch_status').on(table.batchId, table.status),
  }),
);

export const youtubeHotHourlyItems = sqliteTable(
  'youtube_hot_hourly_items',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    snapshotId: integer('snapshot_id')
      .notNull()
      .references(() => youtubeHotHourlySnapshots.id, { onDelete: 'cascade' }),
    rank: integer('rank').notNull(),
    videoId: text('video_id').notNull(),
    videoUrl: text('video_url').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    thumbnailUrl: text('thumbnail_url'),
    categoryId: text('category_id'),
    categoryTitle: text('category_title'),
    publishedAt: text('published_at'),
    durationIso: text('duration_iso'),
    viewCount: integer('view_count'),
    likeCount: integer('like_count'),
    commentCount: integer('comment_count'),
    channelId: text('channel_id').notNull(),
    channelTitle: text('channel_title').notNull(),
    channelUrl: text('channel_url').notNull(),
    channelAvatarUrl: text('channel_avatar_url'),
    subscriberCount: integer('subscriber_count'),
    hiddenSubscriberCount: integer('hidden_subscriber_count').notNull().default(0),
    metadataJson: text('metadata_json'),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    snapshotRankUnique: uniqueIndex('idx_youtube_hot_hourly_items_snapshot_rank').on(table.snapshotId, table.rank),
    snapshotVideoUnique: uniqueIndex('idx_youtube_hot_hourly_items_snapshot_video').on(table.snapshotId, table.videoId),
    snapshotIdx: index('idx_youtube_hot_hourly_items_snapshot').on(table.snapshotId),
    categoryIdx: index('idx_youtube_hot_hourly_items_category').on(table.categoryId),
    videoIdx: index('idx_youtube_hot_hourly_items_video').on(table.videoId),
  }),
);

export const youtubeLiveSnapshots = sqliteTable(
  'youtube_live_snapshots',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    crawledAt: text('crawled_at').notNull(),
    status: text('status').notNull(),
    sourceUrl: text('source_url').notNull(),
    detailSourceUrl: text('detail_source_url'),
    itemCount: integer('item_count').notNull().default(0),
    errorText: text('error_text'),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    crawledAtIdx: index('idx_youtube_live_snapshots_crawled_at').on(table.crawledAt),
  }),
);

export const youtubeMusicChartSnapshots = sqliteTable(
  'youtube_music_chart_snapshots',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    chartType: text('chart_type').notNull(),
    periodType: text('period_type').notNull(),
    countryCode: text('country_code').notNull(),
    countryName: text('country_name').notNull(),
    chartEndDate: text('chart_end_date').notNull(),
    fetchedAt: text('fetched_at').notNull(),
    sourceUrl: text('source_url').notNull(),
    status: text('status').notNull().default('success'),
    itemCount: integer('item_count').notNull().default(0),
    errorText: text('error_text'),
    rawPayload: text('raw_payload'),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
    updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    chartSnapshotUnique: uniqueIndex('idx_youtube_music_chart_snapshots_unique').on(
      table.chartType,
      table.periodType,
      table.countryCode,
      table.chartEndDate,
    ),
    chartLatestIdx: index('idx_youtube_music_chart_snapshots_latest').on(
      table.chartType,
      table.periodType,
      table.countryCode,
      table.chartEndDate,
    ),
    statusIdx: index('idx_youtube_music_chart_snapshots_status').on(table.status, table.chartEndDate),
  }),
);

export const youtubeMusicChartItems = sqliteTable(
  'youtube_music_chart_items',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    snapshotId: integer('snapshot_id')
      .notNull()
      .references(() => youtubeMusicChartSnapshots.id, { onDelete: 'cascade' }),
    rank: integer('rank').notNull(),
    previousRank: integer('previous_rank'),
    trackName: text('track_name').notNull(),
    artistNames: text('artist_names').notNull(),
    views: integer('views'),
    periodsOnChart: integer('periods_on_chart'),
    youtubeVideoId: text('youtube_video_id'),
    youtubeUrl: text('youtube_url'),
    thumbnailUrl: text('thumbnail_url'),
    rawItemJson: text('raw_item_json'),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    snapshotRankUnique: uniqueIndex('idx_youtube_music_chart_items_snapshot_rank').on(table.snapshotId, table.rank),
    snapshotVideoIdx: index('idx_youtube_music_chart_items_snapshot_video').on(table.snapshotId, table.youtubeVideoId),
    snapshotIdx: index('idx_youtube_music_chart_items_snapshot').on(table.snapshotId),
    trackIdx: index('idx_youtube_music_chart_items_track').on(table.trackName),
  }),
);

export const youtubeMusicVideoDailySnapshots = sqliteTable(
  'youtube_music_video_daily_snapshots',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    countryCode: text('country_code').notNull(),
    countryName: text('country_name').notNull(),
    chartEndDate: text('chart_end_date').notNull(),
    fetchedAt: text('fetched_at').notNull(),
    sourceUrl: text('source_url').notNull(),
    status: text('status').notNull().default('success'),
    itemCount: integer('item_count').notNull().default(0),
    errorText: text('error_text'),
    rawPayload: text('raw_payload'),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
    updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    chartSnapshotUnique: uniqueIndex('idx_youtube_music_video_daily_snapshots_unique').on(
      table.countryCode,
      table.chartEndDate,
    ),
    chartLatestIdx: index('idx_youtube_music_video_daily_snapshots_latest').on(table.countryCode, table.chartEndDate),
    statusIdx: index('idx_youtube_music_video_daily_snapshots_status').on(table.status, table.chartEndDate),
  }),
);

export const youtubeMusicVideoDailyItems = sqliteTable(
  'youtube_music_video_daily_items',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    snapshotId: integer('snapshot_id')
      .notNull()
      .references(() => youtubeMusicVideoDailySnapshots.id, { onDelete: 'cascade' }),
    rank: integer('rank').notNull(),
    previousRank: integer('previous_rank'),
    videoTitle: text('video_title').notNull(),
    artistNames: text('artist_names').notNull(),
    views: integer('views'),
    periodsOnChart: integer('periods_on_chart'),
    youtubeVideoId: text('youtube_video_id'),
    youtubeUrl: text('youtube_url'),
    thumbnailUrl: text('thumbnail_url'),
    channelName: text('channel_name'),
    channelId: text('channel_id'),
    durationSeconds: integer('duration_seconds'),
    rawItemJson: text('raw_item_json'),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    snapshotRankUnique: uniqueIndex('idx_youtube_music_video_daily_items_snapshot_rank').on(table.snapshotId, table.rank),
    snapshotVideoIdx: index('idx_youtube_music_video_daily_items_snapshot_video').on(
      table.snapshotId,
      table.youtubeVideoId,
    ),
    snapshotIdx: index('idx_youtube_music_video_daily_items_snapshot').on(table.snapshotId),
    titleIdx: index('idx_youtube_music_video_daily_items_title').on(table.videoTitle),
  }),
);

export const youtubeMusicShortsSongDailySnapshots = sqliteTable(
  'youtube_music_shorts_song_daily_snapshots',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    countryCode: text('country_code').notNull(),
    countryName: text('country_name').notNull(),
    chartEndDate: text('chart_end_date').notNull(),
    fetchedAt: text('fetched_at').notNull(),
    sourceUrl: text('source_url').notNull(),
    status: text('status').notNull().default('success'),
    itemCount: integer('item_count').notNull().default(0),
    errorText: text('error_text'),
    rawPayload: text('raw_payload'),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
    updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    chartSnapshotUnique: uniqueIndex('idx_youtube_music_shorts_song_daily_snapshots_unique').on(
      table.countryCode,
      table.chartEndDate,
    ),
    chartLatestIdx: index('idx_youtube_music_shorts_song_daily_snapshots_latest').on(
      table.countryCode,
      table.chartEndDate,
    ),
    statusIdx: index('idx_youtube_music_shorts_song_daily_snapshots_status').on(table.status, table.chartEndDate),
  }),
);

export const youtubeMusicShortsSongDailyItems = sqliteTable(
  'youtube_music_shorts_song_daily_items',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    snapshotId: integer('snapshot_id')
      .notNull()
      .references(() => youtubeMusicShortsSongDailySnapshots.id, { onDelete: 'cascade' }),
    rank: integer('rank').notNull(),
    previousRank: integer('previous_rank'),
    trackName: text('track_name').notNull(),
    artistNames: text('artist_names').notNull(),
    views: integer('views'),
    periodsOnChart: integer('periods_on_chart'),
    youtubeVideoId: text('youtube_video_id'),
    youtubeUrl: text('youtube_url'),
    thumbnailUrl: text('thumbnail_url'),
    rawItemJson: text('raw_item_json'),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    snapshotRankUnique: uniqueIndex('idx_youtube_music_shorts_song_daily_items_snapshot_rank').on(
      table.snapshotId,
      table.rank,
    ),
    snapshotVideoIdx: index('idx_youtube_music_shorts_song_daily_items_snapshot_video').on(
      table.snapshotId,
      table.youtubeVideoId,
    ),
    snapshotIdx: index('idx_youtube_music_shorts_song_daily_items_snapshot').on(table.snapshotId),
    trackIdx: index('idx_youtube_music_shorts_song_daily_items_track').on(table.trackName),
  }),
);

export const youtubeLiveItems = sqliteTable(
  'youtube_live_items',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    snapshotId: integer('snapshot_id')
      .notNull()
      .references(() => youtubeLiveSnapshots.id, { onDelete: 'cascade' }),
    rank: integer('rank').notNull(),
    videoId: text('video_id').notNull(),
    videoUrl: text('video_url').notNull(),
    title: text('title').notNull(),
    thumbnailUrl: text('thumbnail_url'),
    categoryId: text('category_id'),
    categoryTitle: text('category_title'),
    defaultLanguage: text('default_language'),
    defaultAudioLanguage: text('default_audio_language'),
    channelId: text('channel_id').notNull(),
    channelTitle: text('channel_title').notNull(),
    channelUrl: text('channel_url').notNull(),
    channelAvatarUrl: text('channel_avatar_url'),
    subscriberCount: integer('subscriber_count'),
    hiddenSubscriberCount: integer('hidden_subscriber_count').notNull().default(0),
    concurrentViewers: integer('concurrent_viewers'),
    viewCount: integer('view_count'),
    likeCount: integer('like_count'),
    commentCount: integer('comment_count'),
    startedAt: text('started_at'),
    scheduledStartTime: text('scheduled_start_time'),
    fetchedAt: text('fetched_at').notNull(),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    snapshotRankUnique: uniqueIndex('idx_youtube_live_items_snapshot_rank').on(table.snapshotId, table.rank),
    snapshotVideoUnique: uniqueIndex('idx_youtube_live_items_snapshot_video').on(table.snapshotId, table.videoId),
    snapshotIdx: index('idx_youtube_live_items_snapshot').on(table.snapshotId),
    videoIdx: index('idx_youtube_live_items_video').on(table.videoId),
  }),
);

export const tiktokVideoHourlyBatches = sqliteTable(
  'tiktok_video_hourly_batches',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    snapshotHour: text('snapshot_hour').notNull(),
    batchStatus: text('batch_status').notNull().default('pending'),
    sourceName: text('source_name').notNull().default('tiktok-creative-center-videos'),
    generatedAt: text('generated_at'),
    targetScopeCount: integer('target_scope_count').notNull().default(0),
    successScopeCount: integer('success_scope_count').notNull().default(0),
    failedScopeCount: integer('failed_scope_count').notNull().default(0),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
    updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    snapshotHourUnique: uniqueIndex('idx_tiktok_video_hourly_batches_snapshot_hour').on(table.snapshotHour),
    statusHourIdx: index('idx_tiktok_video_hourly_batches_status_hour').on(table.batchStatus, table.snapshotHour),
  }),
);

export const tiktokVideoHourlySnapshots = sqliteTable(
  'tiktok_video_hourly_snapshots',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    batchId: integer('batch_id')
      .notNull()
      .references(() => tiktokVideoHourlyBatches.id, { onDelete: 'cascade' }),
    countryCode: text('country_code').notNull(),
    countryName: text('country_name').notNull(),
    period: integer('period').notNull(),
    orderBy: text('order_by').notNull(),
    fetchedAt: text('fetched_at').notNull().default(sql`(datetime('now'))`),
    status: text('status').notNull(),
    sourceUrl: text('source_url').notNull(),
    listApiUrl: text('list_api_url'),
    pageCount: integer('page_count').notNull().default(0),
    itemCount: integer('item_count').notNull().default(0),
    totalCount: integer('total_count').notNull().default(0),
    errorText: text('error_text'),
    warningsJson: text('warnings_json'),
    timingsJson: text('timings_json'),
    rawPayload: text('raw_payload'),
  },
  (table) => ({
    batchScopeUnique: uniqueIndex('idx_tiktok_video_hourly_snapshots_batch_scope_unique').on(
      table.batchId,
      table.countryCode,
      table.period,
      table.orderBy,
    ),
    batchScopeIdx: index('idx_tiktok_video_hourly_snapshots_batch_scope').on(
      table.batchId,
      table.countryCode,
      table.period,
      table.orderBy,
    ),
    batchStatusIdx: index('idx_tiktok_video_hourly_snapshots_batch_status').on(table.batchId, table.status),
  }),
);

export const tiktokVideoHourlyItems = sqliteTable(
  'tiktok_video_hourly_items',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    snapshotId: integer('snapshot_id')
      .notNull()
      .references(() => tiktokVideoHourlySnapshots.id, { onDelete: 'cascade' }),
    rank: integer('rank').notNull(),
    videoId: text('video_id').notNull(),
    itemId: text('item_id').notNull(),
    itemUrl: text('item_url').notNull(),
    title: text('title').notNull(),
    coverUrl: text('cover_url'),
    durationSeconds: integer('duration_seconds'),
    regionName: text('region_name'),
    rawItemJson: text('raw_item_json'),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    snapshotRankUnique: uniqueIndex('idx_tiktok_video_hourly_items_snapshot_rank').on(table.snapshotId, table.rank),
    snapshotVideoUnique: uniqueIndex('idx_tiktok_video_hourly_items_snapshot_video').on(table.snapshotId, table.videoId),
    snapshotIdx: index('idx_tiktok_video_hourly_items_snapshot').on(table.snapshotId),
    videoIdx: index('idx_tiktok_video_hourly_items_video').on(table.videoId),
  }),
);

export const xTrendHourlyBatches = sqliteTable(
  'x_trend_hourly_batches',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    snapshotHour: text('snapshot_hour').notNull(),
    batchStatus: text('batch_status').notNull().default('pending'),
    sourceName: text('source_name').notNull().default('x-trends'),
    generatedAt: text('generated_at'),
    targetRegionCount: integer('target_region_count').notNull().default(0),
    successRegionCount: integer('success_region_count').notNull().default(0),
    failedRegionCount: integer('failed_region_count').notNull().default(0),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
    updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    snapshotHourUnique: uniqueIndex('idx_x_trend_hourly_batches_snapshot_hour').on(table.snapshotHour),
    statusHourIdx: index('idx_x_trend_hourly_batches_status_hour').on(table.batchStatus, table.snapshotHour),
  }),
);

export const xTrendHourlySnapshots = sqliteTable(
  'x_trend_hourly_snapshots',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    batchId: integer('batch_id')
      .notNull()
      .references(() => xTrendHourlyBatches.id, { onDelete: 'cascade' }),
    regionKey: text('region_key').notNull(),
    regionLabel: text('region_label').notNull(),
    fetchedAt: text('fetched_at').notNull().default(sql`(datetime('now'))`),
    status: text('status').notNull(),
    sourceUrl: text('source_url').notNull(),
    extractionSource: text('extraction_source').notNull().default('network'),
    loggedIn: integer('logged_in').notNull().default(0),
    itemCount: integer('item_count').notNull().default(0),
    errorText: text('error_text'),
    rawPayload: text('raw_payload'),
  },
  (table) => ({
    batchRegionUnique: uniqueIndex('idx_x_trend_hourly_snapshots_batch_region_unique').on(
      table.batchId,
      table.regionKey,
    ),
    batchRegionIdx: index('idx_x_trend_hourly_snapshots_batch_region').on(table.batchId, table.regionKey),
    batchStatusIdx: index('idx_x_trend_hourly_snapshots_batch_status').on(table.batchId, table.status),
  }),
);

export const xTrendHourlyItems = sqliteTable(
  'x_trend_hourly_items',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    snapshotId: integer('snapshot_id')
      .notNull()
      .references(() => xTrendHourlySnapshots.id, { onDelete: 'cascade' }),
    rank: integer('rank').notNull(),
    trendName: text('trend_name').notNull(),
    normalizedKey: text('normalized_key').notNull(),
    queryText: text('query_text'),
    trendUrl: text('trend_url'),
    metaText: text('meta_text'),
    tweetVolume: integer('tweet_volume'),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    snapshotRankUnique: uniqueIndex('idx_x_trend_hourly_items_snapshot_rank').on(table.snapshotId, table.rank),
    snapshotKeyIdx: index('idx_x_trend_hourly_items_snapshot_key').on(table.snapshotId, table.normalizedKey),
    snapshotIdx: index('idx_x_trend_hourly_items_snapshot').on(table.snapshotId),
    trendKeyIdx: index('idx_x_trend_hourly_items_key').on(table.normalizedKey),
  }),
);

export type YouTubeHotHourlyBatch = typeof youtubeHotHourlyBatches.$inferSelect;
export type NewYouTubeHotHourlyBatch = typeof youtubeHotHourlyBatches.$inferInsert;
export type YouTubeHotHourlySnapshot = typeof youtubeHotHourlySnapshots.$inferSelect;
export type NewYouTubeHotHourlySnapshot = typeof youtubeHotHourlySnapshots.$inferInsert;
export type YouTubeHotHourlyItem = typeof youtubeHotHourlyItems.$inferSelect;
export type NewYouTubeHotHourlyItem = typeof youtubeHotHourlyItems.$inferInsert;
export type YouTubeLiveSnapshot = typeof youtubeLiveSnapshots.$inferSelect;
export type NewYouTubeLiveSnapshot = typeof youtubeLiveSnapshots.$inferInsert;
export type YouTubeLiveItem = typeof youtubeLiveItems.$inferSelect;
export type NewYouTubeLiveItem = typeof youtubeLiveItems.$inferInsert;
export type YouTubeMusicChartSnapshot = typeof youtubeMusicChartSnapshots.$inferSelect;
export type NewYouTubeMusicChartSnapshot = typeof youtubeMusicChartSnapshots.$inferInsert;
export type YouTubeMusicChartItem = typeof youtubeMusicChartItems.$inferSelect;
export type NewYouTubeMusicChartItem = typeof youtubeMusicChartItems.$inferInsert;
export type YouTubeMusicVideoDailySnapshot = typeof youtubeMusicVideoDailySnapshots.$inferSelect;
export type NewYouTubeMusicVideoDailySnapshot = typeof youtubeMusicVideoDailySnapshots.$inferInsert;
export type YouTubeMusicVideoDailyItem = typeof youtubeMusicVideoDailyItems.$inferSelect;
export type NewYouTubeMusicVideoDailyItem = typeof youtubeMusicVideoDailyItems.$inferInsert;
export type YouTubeMusicShortsSongDailySnapshot = typeof youtubeMusicShortsSongDailySnapshots.$inferSelect;
export type NewYouTubeMusicShortsSongDailySnapshot = typeof youtubeMusicShortsSongDailySnapshots.$inferInsert;
export type YouTubeMusicShortsSongDailyItem = typeof youtubeMusicShortsSongDailyItems.$inferSelect;
export type NewYouTubeMusicShortsSongDailyItem = typeof youtubeMusicShortsSongDailyItems.$inferInsert;
export type TikTokVideoHourlyBatch = typeof tiktokVideoHourlyBatches.$inferSelect;
export type NewTikTokVideoHourlyBatch = typeof tiktokVideoHourlyBatches.$inferInsert;
export type TikTokVideoHourlySnapshot = typeof tiktokVideoHourlySnapshots.$inferSelect;
export type NewTikTokVideoHourlySnapshot = typeof tiktokVideoHourlySnapshots.$inferInsert;
export type TikTokVideoHourlyItem = typeof tiktokVideoHourlyItems.$inferSelect;
export type NewTikTokVideoHourlyItem = typeof tiktokVideoHourlyItems.$inferInsert;
export type XTrendHourlyBatch = typeof xTrendHourlyBatches.$inferSelect;
export type NewXTrendHourlyBatch = typeof xTrendHourlyBatches.$inferInsert;
export type XTrendHourlySnapshot = typeof xTrendHourlySnapshots.$inferSelect;
export type NewXTrendHourlySnapshot = typeof xTrendHourlySnapshots.$inferInsert;
export type XTrendHourlyItem = typeof xTrendHourlyItems.$inferSelect;
export type NewXTrendHourlyItem = typeof xTrendHourlyItems.$inferInsert;
