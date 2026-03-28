import { sql } from 'drizzle-orm';
import { db } from '@/db/index';

let ensureSchemaPromise: Promise<void> | null = null;

async function ensureXTrendSchemaInternal() {
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS x_trend_hourly_batches (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      snapshot_hour text NOT NULL,
      batch_status text DEFAULT 'pending' NOT NULL,
      source_name text DEFAULT 'x-trends' NOT NULL,
      generated_at text,
      target_region_count integer DEFAULT 0 NOT NULL,
      success_region_count integer DEFAULT 0 NOT NULL,
      failed_region_count integer DEFAULT 0 NOT NULL,
      created_at text DEFAULT (datetime('now')) NOT NULL,
      updated_at text DEFAULT (datetime('now')) NOT NULL
    )
  `);
  await db.run(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_x_trend_hourly_batches_snapshot_hour
    ON x_trend_hourly_batches (snapshot_hour)
  `);
  await db.run(sql`
    CREATE INDEX IF NOT EXISTS idx_x_trend_hourly_batches_status_hour
    ON x_trend_hourly_batches (batch_status, snapshot_hour)
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS x_trend_hourly_snapshots (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      batch_id integer NOT NULL,
      region_key text NOT NULL,
      region_label text NOT NULL,
      fetched_at text DEFAULT (datetime('now')) NOT NULL,
      status text NOT NULL,
      source_url text NOT NULL,
      extraction_source text DEFAULT 'network' NOT NULL,
      logged_in integer DEFAULT 0 NOT NULL,
      item_count integer DEFAULT 0 NOT NULL,
      error_text text,
      raw_payload text,
      FOREIGN KEY (batch_id) REFERENCES x_trend_hourly_batches(id) ON DELETE cascade
    )
  `);
  await db.run(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_x_trend_hourly_snapshots_batch_region_unique
    ON x_trend_hourly_snapshots (batch_id, region_key)
  `);
  await db.run(sql`
    CREATE INDEX IF NOT EXISTS idx_x_trend_hourly_snapshots_batch_region
    ON x_trend_hourly_snapshots (batch_id, region_key)
  `);
  await db.run(sql`
    CREATE INDEX IF NOT EXISTS idx_x_trend_hourly_snapshots_batch_status
    ON x_trend_hourly_snapshots (batch_id, status)
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS x_trend_hourly_items (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      snapshot_id integer NOT NULL,
      rank integer NOT NULL,
      trend_name text NOT NULL,
      normalized_key text NOT NULL,
      query_text text,
      trend_url text,
      meta_text text,
      tweet_volume integer,
      created_at text DEFAULT (datetime('now')) NOT NULL,
      FOREIGN KEY (snapshot_id) REFERENCES x_trend_hourly_snapshots(id) ON DELETE cascade
    )
  `);
  await db.run(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_x_trend_hourly_items_snapshot_rank
    ON x_trend_hourly_items (snapshot_id, rank)
  `);
  await db.run(sql`
    CREATE INDEX IF NOT EXISTS idx_x_trend_hourly_items_snapshot_key
    ON x_trend_hourly_items (snapshot_id, normalized_key)
  `);
  await db.run(sql`
    CREATE INDEX IF NOT EXISTS idx_x_trend_hourly_items_snapshot
    ON x_trend_hourly_items (snapshot_id)
  `);
  await db.run(sql`
    CREATE INDEX IF NOT EXISTS idx_x_trend_hourly_items_key
    ON x_trend_hourly_items (normalized_key)
  `);
}

export async function ensureXTrendSchema() {
  if (!ensureSchemaPromise) {
    ensureSchemaPromise = ensureXTrendSchemaInternal().catch((error) => {
      ensureSchemaPromise = null;
      throw error;
    });
  }

  await ensureSchemaPromise;
}
