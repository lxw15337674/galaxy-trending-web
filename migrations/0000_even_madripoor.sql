CREATE TABLE `x_trend_hourly_batches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`snapshot_hour` text NOT NULL,
	`batch_status` text DEFAULT 'pending' NOT NULL,
	`source_name` text DEFAULT 'x-trends' NOT NULL,
	`generated_at` text,
	`target_region_count` integer DEFAULT 0 NOT NULL,
	`success_region_count` integer DEFAULT 0 NOT NULL,
	`failed_region_count` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_x_trend_hourly_batches_snapshot_hour` ON `x_trend_hourly_batches` (`snapshot_hour`);--> statement-breakpoint
CREATE INDEX `idx_x_trend_hourly_batches_status_hour` ON `x_trend_hourly_batches` (`batch_status`,`snapshot_hour`);--> statement-breakpoint
CREATE TABLE `x_trend_hourly_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`snapshot_id` integer NOT NULL,
	`rank` integer NOT NULL,
	`trend_name` text NOT NULL,
	`normalized_key` text NOT NULL,
	`query_text` text,
	`trend_url` text,
	`meta_text` text,
	`tweet_volume` integer,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`snapshot_id`) REFERENCES `x_trend_hourly_snapshots`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_x_trend_hourly_items_snapshot_rank` ON `x_trend_hourly_items` (`snapshot_id`,`rank`);--> statement-breakpoint
CREATE INDEX `idx_x_trend_hourly_items_snapshot_key` ON `x_trend_hourly_items` (`snapshot_id`,`normalized_key`);--> statement-breakpoint
CREATE INDEX `idx_x_trend_hourly_items_snapshot` ON `x_trend_hourly_items` (`snapshot_id`);--> statement-breakpoint
CREATE INDEX `idx_x_trend_hourly_items_key` ON `x_trend_hourly_items` (`normalized_key`);--> statement-breakpoint
CREATE TABLE `x_trend_hourly_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`batch_id` integer NOT NULL,
	`region_key` text NOT NULL,
	`region_label` text NOT NULL,
	`fetched_at` text DEFAULT (datetime('now')) NOT NULL,
	`status` text NOT NULL,
	`source_url` text NOT NULL,
	`extraction_source` text DEFAULT 'network' NOT NULL,
	`logged_in` integer DEFAULT 0 NOT NULL,
	`item_count` integer DEFAULT 0 NOT NULL,
	`error_text` text,
	`raw_payload` text,
	FOREIGN KEY (`batch_id`) REFERENCES `x_trend_hourly_batches`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_x_trend_hourly_snapshots_batch_region_unique` ON `x_trend_hourly_snapshots` (`batch_id`,`region_key`);--> statement-breakpoint
CREATE INDEX `idx_x_trend_hourly_snapshots_batch_region` ON `x_trend_hourly_snapshots` (`batch_id`,`region_key`);--> statement-breakpoint
CREATE INDEX `idx_x_trend_hourly_snapshots_batch_status` ON `x_trend_hourly_snapshots` (`batch_id`,`status`);--> statement-breakpoint
CREATE TABLE `youtube_hot_hourly_batches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`snapshot_hour` text NOT NULL,
	`batch_status` text DEFAULT 'pending' NOT NULL,
	`source_name` text DEFAULT 'youtube-mostPopular' NOT NULL,
	`generated_at` text,
	`region_count` integer DEFAULT 0 NOT NULL,
	`success_region_count` integer DEFAULT 0 NOT NULL,
	`failed_region_count` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_youtube_hot_hourly_batches_snapshot_hour` ON `youtube_hot_hourly_batches` (`snapshot_hour`);--> statement-breakpoint
CREATE INDEX `idx_youtube_hot_hourly_batches_status_hour` ON `youtube_hot_hourly_batches` (`batch_status`,`snapshot_hour`);--> statement-breakpoint
CREATE TABLE `youtube_hot_hourly_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`snapshot_id` integer NOT NULL,
	`rank` integer NOT NULL,
	`video_id` text NOT NULL,
	`video_url` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`thumbnail_url` text,
	`category_id` text,
	`category_title` text,
	`published_at` text,
	`duration_iso` text,
	`view_count` integer,
	`like_count` integer,
	`comment_count` integer,
	`channel_id` text NOT NULL,
	`channel_title` text NOT NULL,
	`channel_url` text NOT NULL,
	`channel_avatar_url` text,
	`subscriber_count` integer,
	`hidden_subscriber_count` integer DEFAULT 0 NOT NULL,
	`metadata_json` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`snapshot_id`) REFERENCES `youtube_hot_hourly_snapshots`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_youtube_hot_hourly_items_snapshot_rank` ON `youtube_hot_hourly_items` (`snapshot_id`,`rank`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_youtube_hot_hourly_items_snapshot_video` ON `youtube_hot_hourly_items` (`snapshot_id`,`video_id`);--> statement-breakpoint
CREATE INDEX `idx_youtube_hot_hourly_items_snapshot` ON `youtube_hot_hourly_items` (`snapshot_id`);--> statement-breakpoint
CREATE INDEX `idx_youtube_hot_hourly_items_category` ON `youtube_hot_hourly_items` (`category_id`);--> statement-breakpoint
CREATE INDEX `idx_youtube_hot_hourly_items_video` ON `youtube_hot_hourly_items` (`video_id`);--> statement-breakpoint
CREATE TABLE `youtube_hot_hourly_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`batch_id` integer NOT NULL,
	`region_code` text NOT NULL,
	`region_name` text NOT NULL,
	`fetched_at` text DEFAULT (datetime('now')) NOT NULL,
	`status` text NOT NULL,
	`source_url` text NOT NULL,
	`item_count` integer DEFAULT 0 NOT NULL,
	`error_text` text,
	`raw_payload` text,
	FOREIGN KEY (`batch_id`) REFERENCES `youtube_hot_hourly_batches`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_youtube_hot_hourly_snapshots_batch_region_unique` ON `youtube_hot_hourly_snapshots` (`batch_id`,`region_code`);--> statement-breakpoint
CREATE INDEX `idx_youtube_hot_hourly_snapshots_batch_region` ON `youtube_hot_hourly_snapshots` (`batch_id`,`region_code`);--> statement-breakpoint
CREATE INDEX `idx_youtube_hot_hourly_snapshots_batch_status` ON `youtube_hot_hourly_snapshots` (`batch_id`,`status`);--> statement-breakpoint
CREATE TABLE `youtube_live_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`snapshot_id` integer NOT NULL,
	`rank` integer NOT NULL,
	`video_id` text NOT NULL,
	`video_url` text NOT NULL,
	`title` text NOT NULL,
	`thumbnail_url` text,
	`category_id` text,
	`category_title` text,
	`default_language` text,
	`default_audio_language` text,
	`channel_id` text NOT NULL,
	`channel_title` text NOT NULL,
	`channel_url` text NOT NULL,
	`channel_avatar_url` text,
	`subscriber_count` integer,
	`hidden_subscriber_count` integer DEFAULT 0 NOT NULL,
	`concurrent_viewers` integer,
	`view_count` integer,
	`like_count` integer,
	`comment_count` integer,
	`started_at` text,
	`scheduled_start_time` text,
	`fetched_at` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`snapshot_id`) REFERENCES `youtube_live_snapshots`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_youtube_live_items_snapshot_rank` ON `youtube_live_items` (`snapshot_id`,`rank`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_youtube_live_items_snapshot_video` ON `youtube_live_items` (`snapshot_id`,`video_id`);--> statement-breakpoint
CREATE INDEX `idx_youtube_live_items_snapshot` ON `youtube_live_items` (`snapshot_id`);--> statement-breakpoint
CREATE INDEX `idx_youtube_live_items_video` ON `youtube_live_items` (`video_id`);--> statement-breakpoint
CREATE TABLE `youtube_live_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`crawled_at` text NOT NULL,
	`status` text NOT NULL,
	`source_url` text NOT NULL,
	`detail_source_url` text,
	`item_count` integer DEFAULT 0 NOT NULL,
	`error_text` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_youtube_live_snapshots_crawled_at` ON `youtube_live_snapshots` (`crawled_at`);