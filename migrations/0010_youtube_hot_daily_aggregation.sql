DROP TABLE IF EXISTS `youtube_hot_daily_items`;--> statement-breakpoint
DROP TABLE IF EXISTS `youtube_hot_daily_snapshots`;--> statement-breakpoint
CREATE TABLE `youtube_hot_daily_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`snapshot_date` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`source_name` text DEFAULT 'youtube-mostPopular-daily' NOT NULL,
	`generated_at` text,
	`region_count` integer DEFAULT 0 NOT NULL,
	`item_count` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_youtube_hot_daily_snapshots_date_unique` ON `youtube_hot_daily_snapshots` (`snapshot_date`);--> statement-breakpoint
CREATE INDEX `idx_youtube_hot_daily_snapshots_status_date` ON `youtube_hot_daily_snapshots` (`status`,`snapshot_date`);--> statement-breakpoint
CREATE TABLE `youtube_hot_daily_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`snapshot_id` integer NOT NULL,
	`region_code` text NOT NULL,
	`region_name` text NOT NULL,
	`video_id` text NOT NULL,
	`video_url` text NOT NULL,
	`title` text NOT NULL,
	`thumbnail_url` text,
	`category_id` text,
	`category_title` text,
	`published_at` text,
	`duration_iso` text,
	`channel_id` text NOT NULL,
	`channel_title` text NOT NULL,
	`channel_url` text NOT NULL,
	`channel_avatar_url` text,
	`subscriber_count` integer,
	`hidden_subscriber_count` integer DEFAULT 0 NOT NULL,
	`max_view_count` integer,
	`max_like_count` integer,
	`max_comment_count` integer,
	`last_rank` integer NOT NULL,
	`best_rank` integer NOT NULL,
	`appearances` integer DEFAULT 0 NOT NULL,
	`first_seen_at` text NOT NULL,
	`last_seen_at` text NOT NULL,
	`metadata_json` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`snapshot_id`) REFERENCES `youtube_hot_daily_snapshots`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_youtube_hot_daily_items_snapshot_region_video` ON `youtube_hot_daily_items` (`snapshot_id`,`region_code`,`video_id`);--> statement-breakpoint
CREATE INDEX `idx_youtube_hot_daily_items_snapshot_region_rank` ON `youtube_hot_daily_items` (`snapshot_id`,`region_code`,`last_rank`);--> statement-breakpoint
CREATE INDEX `idx_youtube_hot_daily_items_snapshot_video` ON `youtube_hot_daily_items` (`snapshot_id`,`video_id`);--> statement-breakpoint
CREATE INDEX `idx_youtube_hot_daily_items_snapshot_category` ON `youtube_hot_daily_items` (`snapshot_id`,`category_id`);--> statement-breakpoint
CREATE INDEX `idx_youtube_hot_daily_items_region_snapshot` ON `youtube_hot_daily_items` (`region_code`,`snapshot_id`);
