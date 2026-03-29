import { sql } from 'drizzle-orm';
import { db } from '@/db/index';

let ensureSchemaPromise: Promise<void> | null = null;

async function ensureTikTokHashtagTrendSchemaInternal() {
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS tiktok_hashtag_hourly_batches (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      snapshot_hour text NOT NULL,
      batch_status text DEFAULT 'pending' NOT NULL,
      source_name text DEFAULT 'tiktok-creative-center-hashtag' NOT NULL,
      generated_at text,
      target_country_count integer DEFAULT 0 NOT NULL,
      success_country_count integer DEFAULT 0 NOT NULL,
      failed_country_count integer DEFAULT 0 NOT NULL,
      created_at text DEFAULT (datetime('now')) NOT NULL,
      updated_at text DEFAULT (datetime('now')) NOT NULL
    )
  `);
  await db.run(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_tiktok_hashtag_hourly_batches_snapshot_hour
    ON tiktok_hashtag_hourly_batches (snapshot_hour)
  `);
  await db.run(sql`
    CREATE INDEX IF NOT EXISTS idx_tiktok_hashtag_hourly_batches_status_hour
    ON tiktok_hashtag_hourly_batches (batch_status, snapshot_hour)
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS tiktok_hashtag_hourly_snapshots (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      batch_id integer NOT NULL,
      country_code text NOT NULL,
      country_name text NOT NULL,
      fetched_at text DEFAULT (datetime('now')) NOT NULL,
      status text NOT NULL,
      source_url text NOT NULL,
      list_api_url text,
      item_count integer DEFAULT 0 NOT NULL,
      error_text text,
      warnings_json text,
      timings_json text,
      raw_payload text,
      FOREIGN KEY (batch_id) REFERENCES tiktok_hashtag_hourly_batches(id) ON DELETE cascade
    )
  `);
  await db.run(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_tiktok_hashtag_hourly_snapshots_batch_country_unique
    ON tiktok_hashtag_hourly_snapshots (batch_id, country_code)
  `);
  await db.run(sql`
    CREATE INDEX IF NOT EXISTS idx_tiktok_hashtag_hourly_snapshots_batch_country
    ON tiktok_hashtag_hourly_snapshots (batch_id, country_code)
  `);
  await db.run(sql`
    CREATE INDEX IF NOT EXISTS idx_tiktok_hashtag_hourly_snapshots_batch_status
    ON tiktok_hashtag_hourly_snapshots (batch_id, status)
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS tiktok_hashtag_hourly_items (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      snapshot_id integer NOT NULL,
      rank integer NOT NULL,
      hashtag_id text NOT NULL,
      hashtag_name text NOT NULL,
      publish_count integer,
      video_views integer,
      rank_diff integer,
      rank_diff_type integer,
      industry_name text,
      detail_page_url text NOT NULL,
      trend_points_json text,
      creator_preview_json text,
      detail_json text,
      created_at text DEFAULT (datetime('now')) NOT NULL,
      FOREIGN KEY (snapshot_id) REFERENCES tiktok_hashtag_hourly_snapshots(id) ON DELETE cascade
    )
  `);
  await db.run(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_tiktok_hashtag_hourly_items_snapshot_rank
    ON tiktok_hashtag_hourly_items (snapshot_id, rank)
  `);
  await db.run(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_tiktok_hashtag_hourly_items_snapshot_hashtag
    ON tiktok_hashtag_hourly_items (snapshot_id, hashtag_id)
  `);
  await db.run(sql`
    CREATE INDEX IF NOT EXISTS idx_tiktok_hashtag_hourly_items_snapshot
    ON tiktok_hashtag_hourly_items (snapshot_id)
  `);
  await db.run(sql`
    CREATE INDEX IF NOT EXISTS idx_tiktok_hashtag_hourly_items_hashtag
    ON tiktok_hashtag_hourly_items (hashtag_name)
  `);
}

export async function ensureTikTokHashtagTrendSchema() {
  if (!ensureSchemaPromise) {
    ensureSchemaPromise = ensureTikTokHashtagTrendSchemaInternal().catch((error) => {
      ensureSchemaPromise = null;
      throw error;
    });
  }

  await ensureSchemaPromise;
}
