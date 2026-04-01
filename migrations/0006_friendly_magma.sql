CREATE TABLE `steam_chart_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`snapshot_id` integer NOT NULL,
	`rank` integer NOT NULL,
	`steam_item_id` text NOT NULL,
	`steam_app_id` integer,
	`game_name` text NOT NULL,
	`steam_url` text NOT NULL,
	`thumbnail_url` text,
	`current_players` integer,
	`peak_today` integer,
	`price_text` text,
	`original_price_text` text,
	`discount_percent` integer,
	`release_date_text` text,
	`tag_summary` text,
	`raw_item_json` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`snapshot_id`) REFERENCES `steam_chart_snapshots`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_steam_chart_items_snapshot_rank` ON `steam_chart_items` (`snapshot_id`,`rank`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_steam_chart_items_snapshot_item` ON `steam_chart_items` (`snapshot_id`,`steam_item_id`);--> statement-breakpoint
CREATE INDEX `idx_steam_chart_items_snapshot` ON `steam_chart_items` (`snapshot_id`);--> statement-breakpoint
CREATE INDEX `idx_steam_chart_items_app` ON `steam_chart_items` (`steam_app_id`);--> statement-breakpoint
CREATE INDEX `idx_steam_chart_items_game` ON `steam_chart_items` (`game_name`);--> statement-breakpoint
CREATE TABLE `steam_chart_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`chart_type` text NOT NULL,
	`scope_code` text NOT NULL,
	`scope_name` text NOT NULL,
	`snapshot_hour` text NOT NULL,
	`fetched_at` text NOT NULL,
	`source_url` text NOT NULL,
	`chart_label` text NOT NULL,
	`status` text DEFAULT 'success' NOT NULL,
	`item_count` integer DEFAULT 0 NOT NULL,
	`error_text` text,
	`raw_payload` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_steam_chart_snapshots_unique` ON `steam_chart_snapshots` (`chart_type`,`scope_code`,`snapshot_hour`);--> statement-breakpoint
CREATE INDEX `idx_steam_chart_snapshots_latest` ON `steam_chart_snapshots` (`chart_type`,`scope_code`,`snapshot_hour`);--> statement-breakpoint
CREATE INDEX `idx_steam_chart_snapshots_status` ON `steam_chart_snapshots` (`status`,`snapshot_hour`);