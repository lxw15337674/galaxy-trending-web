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
export type XTrendHourlyBatch = typeof xTrendHourlyBatches.$inferSelect;
export type NewXTrendHourlyBatch = typeof xTrendHourlyBatches.$inferInsert;
export type XTrendHourlySnapshot = typeof xTrendHourlySnapshots.$inferSelect;
export type NewXTrendHourlySnapshot = typeof xTrendHourlySnapshots.$inferInsert;
export type XTrendHourlyItem = typeof xTrendHourlyItems.$inferSelect;
export type NewXTrendHourlyItem = typeof xTrendHourlyItems.$inferInsert;
