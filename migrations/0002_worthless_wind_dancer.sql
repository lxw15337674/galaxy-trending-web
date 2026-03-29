CREATE TABLE `youtube_music_shorts_song_daily_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`snapshot_id` integer NOT NULL,
	`rank` integer NOT NULL,
	`previous_rank` integer,
	`track_name` text NOT NULL,
	`artist_names` text NOT NULL,
	`views` integer,
	`periods_on_chart` integer,
	`youtube_video_id` text,
	`youtube_url` text,
	`thumbnail_url` text,
	`raw_item_json` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`snapshot_id`) REFERENCES `youtube_music_shorts_song_daily_snapshots`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_youtube_music_shorts_song_daily_items_snapshot_rank` ON `youtube_music_shorts_song_daily_items` (`snapshot_id`,`rank`);--> statement-breakpoint
CREATE INDEX `idx_youtube_music_shorts_song_daily_items_snapshot_video` ON `youtube_music_shorts_song_daily_items` (`snapshot_id`,`youtube_video_id`);--> statement-breakpoint
CREATE INDEX `idx_youtube_music_shorts_song_daily_items_snapshot` ON `youtube_music_shorts_song_daily_items` (`snapshot_id`);--> statement-breakpoint
CREATE INDEX `idx_youtube_music_shorts_song_daily_items_track` ON `youtube_music_shorts_song_daily_items` (`track_name`);--> statement-breakpoint
CREATE TABLE `youtube_music_shorts_song_daily_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`country_code` text NOT NULL,
	`country_name` text NOT NULL,
	`chart_end_date` text NOT NULL,
	`fetched_at` text NOT NULL,
	`source_url` text NOT NULL,
	`status` text DEFAULT 'success' NOT NULL,
	`item_count` integer DEFAULT 0 NOT NULL,
	`error_text` text,
	`raw_payload` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_youtube_music_shorts_song_daily_snapshots_unique` ON `youtube_music_shorts_song_daily_snapshots` (`country_code`,`chart_end_date`);--> statement-breakpoint
CREATE INDEX `idx_youtube_music_shorts_song_daily_snapshots_latest` ON `youtube_music_shorts_song_daily_snapshots` (`country_code`,`chart_end_date`);--> statement-breakpoint
CREATE INDEX `idx_youtube_music_shorts_song_daily_snapshots_status` ON `youtube_music_shorts_song_daily_snapshots` (`status`,`chart_end_date`);--> statement-breakpoint
CREATE TABLE `youtube_music_video_daily_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`snapshot_id` integer NOT NULL,
	`rank` integer NOT NULL,
	`previous_rank` integer,
	`video_title` text NOT NULL,
	`artist_names` text NOT NULL,
	`views` integer,
	`periods_on_chart` integer,
	`youtube_video_id` text,
	`youtube_url` text,
	`thumbnail_url` text,
	`channel_name` text,
	`channel_id` text,
	`duration_seconds` integer,
	`raw_item_json` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`snapshot_id`) REFERENCES `youtube_music_video_daily_snapshots`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_youtube_music_video_daily_items_snapshot_rank` ON `youtube_music_video_daily_items` (`snapshot_id`,`rank`);--> statement-breakpoint
CREATE INDEX `idx_youtube_music_video_daily_items_snapshot_video` ON `youtube_music_video_daily_items` (`snapshot_id`,`youtube_video_id`);--> statement-breakpoint
CREATE INDEX `idx_youtube_music_video_daily_items_snapshot` ON `youtube_music_video_daily_items` (`snapshot_id`);--> statement-breakpoint
CREATE INDEX `idx_youtube_music_video_daily_items_title` ON `youtube_music_video_daily_items` (`video_title`);--> statement-breakpoint
CREATE TABLE `youtube_music_video_daily_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`country_code` text NOT NULL,
	`country_name` text NOT NULL,
	`chart_end_date` text NOT NULL,
	`fetched_at` text NOT NULL,
	`source_url` text NOT NULL,
	`status` text DEFAULT 'success' NOT NULL,
	`item_count` integer DEFAULT 0 NOT NULL,
	`error_text` text,
	`raw_payload` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_youtube_music_video_daily_snapshots_unique` ON `youtube_music_video_daily_snapshots` (`country_code`,`chart_end_date`);--> statement-breakpoint
CREATE INDEX `idx_youtube_music_video_daily_snapshots_latest` ON `youtube_music_video_daily_snapshots` (`country_code`,`chart_end_date`);--> statement-breakpoint
CREATE INDEX `idx_youtube_music_video_daily_snapshots_status` ON `youtube_music_video_daily_snapshots` (`status`,`chart_end_date`);