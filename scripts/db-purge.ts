import { config as loadEnv } from 'dotenv';
import { sql } from 'drizzle-orm';
import { toSnapshotDate, toSnapshotHour } from '../src/lib/youtube-hot/time';

loadEnv({ path: '.env' });
loadEnv({ path: '.env.local', override: true });
loadEnv({ path: '.dev.vars', override: true });

interface CliOptions {
  scrubDays: number;
  deleteDays: number;
  dryRun: boolean;
  datasetNames: string[] | null;
}

interface QueryExecutor {
  all: <T = unknown>(query: ReturnType<typeof sql.raw>) => Promise<T[]>;
  run: (query: ReturnType<typeof sql.raw>) => Promise<unknown>;
  transaction?: <T>(callback: (tx: QueryExecutor) => Promise<T>) => Promise<T>;
}

interface RetentionSummary {
  name: string;
  scrubbedSnapshots: number;
  scrubbedItems: number;
  deletedBatches: number;
  deletedSnapshots: number;
  deletedItems: number;
}

interface BatchDatasetSpec {
  name: string;
  batchTable: string;
  batchDateColumn: string;
  snapshotTable: string;
  snapshotBatchIdColumn: string;
  scrubDays?: number;
  deleteDays?: number;
  itemTable?: string;
  itemSnapshotIdColumn?: string;
  scrubSnapshotColumns?: string[];
  scrubItemColumns?: string[];
}

interface SnapshotDatasetSpec {
  name: string;
  snapshotTable: string;
  snapshotDateColumn: string;
  scrubDays?: number;
  deleteDays?: number;
  itemTable?: string;
  itemSnapshotIdColumn?: string;
  scrubSnapshotColumns?: string[];
  scrubItemColumns?: string[];
}

interface RetentionCutoffs {
  scrubIso: string;
  deleteIso: string;
  scrubHour: string;
  deleteHour: string;
  scrubDate: string;
  deleteDate: string;
}

const APPLY_BATCH_SIZE = 1000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableDbError(error: unknown) {
  const patterns = [/fetch failed/i, /headers timeout/i, /UND_ERR_HEADERS_TIMEOUT/i, /ECONNRESET/i, /socket hang up/i];

  let current: unknown = error;
  for (let i = 0; i < 8 && current; i += 1) {
    const value = current as {
      message?: unknown;
      code?: unknown;
      stack?: unknown;
      cause?: unknown;
    };

    const text = [value.message, value.code, value.stack, String(current)].filter(Boolean).join(' | ');
    if (patterns.some((pattern) => pattern.test(text))) {
      return true;
    }

    current = value.cause;
  }

  return false;
}

async function withDbRetry<T>(operationName: string, fn: () => Promise<T>) {
  const maxAttempts = 4;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      if (!isRetryableDbError(error) || attempt === maxAttempts) {
        throw error;
      }

      const delayMs = attempt * 1000;
      console.warn(
        `Transient DB error during ${operationName}, retrying attempt ${attempt + 1}/${maxAttempts} after ${delayMs}ms`,
      );
      await sleep(delayMs);
    }
  }

  throw new Error(`Unexpected retry flow for operation ${operationName}`);
}

function parsePositiveInt(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const normalized = Math.floor(parsed);
  if (normalized < min) return min;
  if (normalized > max) return max;
  return normalized;
}

function parseCliArgs(): CliOptions {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  const parseOption = (name: string) => {
    const eqArg = args.find((arg) => arg.startsWith(`--${name}=`))?.split('=')[1];
    const spacedArgIndex = args.findIndex((arg) => arg === `--${name}`);
    return spacedArgIndex >= 0 ? args[spacedArgIndex + 1] ?? eqArg : eqArg;
  };

  const deleteDays = parsePositiveInt(parseOption('delete-days') ?? parseOption('days'), 7, 1, 3650);
  const scrubDays = parsePositiveInt(parseOption('scrub-days'), 1, 1, 3650);
  const datasetsArg = parseOption('datasets');

  if (scrubDays >= deleteDays) {
    throw new Error(`Invalid retention window: scrubDays=${scrubDays} must be smaller than deleteDays=${deleteDays}.`);
  }

  const datasetNames = datasetsArg
    ? Array.from(
        new Set(
          datasetsArg
            .split(',')
            .map((item) => item.trim())
            .filter((item) => item.length > 0),
        ),
      )
    : null;

  return { scrubDays, deleteDays, dryRun, datasetNames };
}

function buildRetentionCutoffs(now: number, scrubDays: number, deleteDays: number): RetentionCutoffs {
  const scrubDate = new Date(now - scrubDays * 24 * 60 * 60 * 1000);
  const deleteDate = new Date(now - deleteDays * 24 * 60 * 60 * 1000);

  return {
    scrubIso: scrubDate.toISOString(),
    deleteIso: deleteDate.toISOString(),
    scrubHour: toSnapshotHour(scrubDate),
    deleteHour: toSnapshotHour(deleteDate),
    scrubDate: toSnapshotDate(scrubDate),
    deleteDate: toSnapshotDate(deleteDate),
  };
}

function resolveRetentionDays(
  spec: Pick<BatchDatasetSpec | SnapshotDatasetSpec, 'name' | 'scrubDays' | 'deleteDays'>,
  defaults: Pick<CliOptions, 'scrubDays' | 'deleteDays'>,
) {
  const scrubDays = spec.scrubDays ?? defaults.scrubDays;
  const deleteDays = spec.deleteDays ?? defaults.deleteDays;

  if (scrubDays >= deleteDays) {
    throw new Error(`Invalid retention window for ${spec.name}: scrubDays=${scrubDays} must be smaller than deleteDays=${deleteDays}.`);
  }

  return { scrubDays, deleteDays };
}

function sqlString(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

async function queryCount(executor: QueryExecutor, query: string) {
  const rows = await withDbRetry('queryCount', () => executor.all<{ total: number }>(sql.raw(query)));
  return Number(rows[0]?.total ?? 0);
}

async function execute(executor: QueryExecutor, query: string) {
  await withDbRetry('execute', () => executor.run(sql.raw(query)));
}

async function applyInBatches(
  executor: QueryExecutor,
  countQuery: string,
  applyQueryBuilder: (limit: number) => string,
) {
  while (true) {
    const remaining = await queryCount(executor, countQuery);
    if (remaining <= 0) {
      return;
    }

    await execute(executor, applyQueryBuilder(APPLY_BATCH_SIZE));
  }
}

function buildNullCheck(alias: string, columns: string[]) {
  return columns.map((column) => `${alias}.${column} IS NOT NULL`).join(' OR ');
}

function buildNullAssignments(columns: string[]) {
  return columns.map((column) => `${column} = NULL`).join(', ');
}

async function purgeBatchDataset(
  executor: QueryExecutor,
  spec: BatchDatasetSpec,
  cutoffs: RetentionCutoffs,
  applyChanges: boolean,
) {
  const scrubWindowCondition = [
    `b.${spec.batchDateColumn} < ${sqlString(cutoffs.scrubHour)}`,
    `b.${spec.batchDateColumn} >= ${sqlString(cutoffs.deleteHour)}`,
  ].join(' AND ');
  const deleteCondition = `b.${spec.batchDateColumn} < ${sqlString(cutoffs.deleteHour)}`;

  const scrubbedSnapshots =
    spec.scrubSnapshotColumns?.length
      ? await queryCount(
          executor,
          `
            SELECT COUNT(*) as total
            FROM ${spec.snapshotTable} s
            JOIN ${spec.batchTable} b ON b.id = s.${spec.snapshotBatchIdColumn}
            WHERE ${scrubWindowCondition}
              AND (${buildNullCheck('s', spec.scrubSnapshotColumns)})
          `,
        )
      : 0;

  if (applyChanges && scrubbedSnapshots > 0 && spec.scrubSnapshotColumns?.length) {
    await applyInBatches(
      executor,
      `
        SELECT COUNT(*) as total
        FROM ${spec.snapshotTable} s
        JOIN ${spec.batchTable} b ON b.id = s.${spec.snapshotBatchIdColumn}
        WHERE ${scrubWindowCondition}
          AND (${buildNullCheck('s', spec.scrubSnapshotColumns)})
      `,
      (limit) => `
        UPDATE ${spec.snapshotTable}
        SET ${buildNullAssignments(spec.scrubSnapshotColumns)}
        WHERE id IN (
          SELECT s.id
          FROM ${spec.snapshotTable} s
          JOIN ${spec.batchTable} b ON b.id = s.${spec.snapshotBatchIdColumn}
          WHERE ${scrubWindowCondition}
            AND (${buildNullCheck('s', spec.scrubSnapshotColumns)})
          LIMIT ${limit}
        )
      `,
    );
  }

  const scrubbedItems =
    spec.itemTable && spec.itemSnapshotIdColumn && spec.scrubItemColumns?.length
      ? await queryCount(
          executor,
          `
            SELECT COUNT(*) as total
            FROM ${spec.itemTable} i
            JOIN ${spec.snapshotTable} s ON s.id = i.${spec.itemSnapshotIdColumn}
            JOIN ${spec.batchTable} b ON b.id = s.${spec.snapshotBatchIdColumn}
            WHERE ${scrubWindowCondition}
              AND (${buildNullCheck('i', spec.scrubItemColumns)})
          `,
        )
      : 0;

  if (
    applyChanges &&
    scrubbedItems > 0 &&
    spec.itemTable &&
    spec.itemSnapshotIdColumn &&
    spec.scrubItemColumns?.length
  ) {
    await applyInBatches(
      executor,
      `
        SELECT COUNT(*) as total
        FROM ${spec.itemTable} i
        JOIN ${spec.snapshotTable} s ON s.id = i.${spec.itemSnapshotIdColumn}
        JOIN ${spec.batchTable} b ON b.id = s.${spec.snapshotBatchIdColumn}
        WHERE ${scrubWindowCondition}
          AND (${buildNullCheck('i', spec.scrubItemColumns)})
      `,
      (limit) => `
        UPDATE ${spec.itemTable}
        SET ${buildNullAssignments(spec.scrubItemColumns)}
        WHERE id IN (
          SELECT i.id
          FROM ${spec.itemTable} i
          JOIN ${spec.snapshotTable} s ON s.id = i.${spec.itemSnapshotIdColumn}
          JOIN ${spec.batchTable} b ON b.id = s.${spec.snapshotBatchIdColumn}
          WHERE ${scrubWindowCondition}
            AND (${buildNullCheck('i', spec.scrubItemColumns)})
          LIMIT ${limit}
        )
      `,
    );
  }

  const deletedBatches = await queryCount(
    executor,
    `
      SELECT COUNT(*) as total
      FROM ${spec.batchTable} b
      WHERE ${deleteCondition}
    `,
  );
  const deletedSnapshots = await queryCount(
    executor,
    `
      SELECT COUNT(*) as total
      FROM ${spec.snapshotTable} s
      JOIN ${spec.batchTable} b ON b.id = s.${spec.snapshotBatchIdColumn}
      WHERE ${deleteCondition}
    `,
  );
  const deletedItems =
    spec.itemTable && spec.itemSnapshotIdColumn
      ? await queryCount(
          executor,
          `
            SELECT COUNT(*) as total
            FROM ${spec.itemTable} i
            JOIN ${spec.snapshotTable} s ON s.id = i.${spec.itemSnapshotIdColumn}
            JOIN ${spec.batchTable} b ON b.id = s.${spec.snapshotBatchIdColumn}
            WHERE ${deleteCondition}
          `,
        )
      : 0;

  if (applyChanges && deletedBatches > 0) {
    await applyInBatches(
      executor,
      `
        SELECT COUNT(*) as total
        FROM ${spec.batchTable} b
        WHERE ${deleteCondition}
      `,
      (limit) => `
        DELETE FROM ${spec.batchTable}
        WHERE id IN (
          SELECT b.id
          FROM ${spec.batchTable} b
          WHERE ${deleteCondition}
          LIMIT ${limit}
        )
      `,
    );
  }

  return {
    name: spec.name,
    scrubbedSnapshots,
    scrubbedItems,
    deletedBatches,
    deletedSnapshots,
    deletedItems,
  } satisfies RetentionSummary;
}

async function purgeSnapshotDataset(
  executor: QueryExecutor,
  spec: SnapshotDatasetSpec,
  cutoffs: RetentionCutoffs,
  applyChanges: boolean,
) {
  const isDateOnly = spec.snapshotDateColumn.endsWith('_date');
  const isHourText = spec.snapshotDateColumn.endsWith('_hour');
  const scrubCutoff = isDateOnly ? cutoffs.scrubDate : isHourText ? cutoffs.scrubHour : cutoffs.scrubIso;
  const deleteCutoff = isDateOnly ? cutoffs.deleteDate : isHourText ? cutoffs.deleteHour : cutoffs.deleteIso;
  const scrubWindowCondition = [
    `s.${spec.snapshotDateColumn} < ${sqlString(scrubCutoff)}`,
    `s.${spec.snapshotDateColumn} >= ${sqlString(deleteCutoff)}`,
  ].join(' AND ');
  const deleteCondition = `s.${spec.snapshotDateColumn} < ${sqlString(deleteCutoff)}`;

  const scrubbedSnapshots =
    spec.scrubSnapshotColumns?.length
      ? await queryCount(
          executor,
          `
            SELECT COUNT(*) as total
            FROM ${spec.snapshotTable} s
            WHERE ${scrubWindowCondition}
              AND (${buildNullCheck('s', spec.scrubSnapshotColumns)})
          `,
        )
      : 0;

  if (applyChanges && scrubbedSnapshots > 0 && spec.scrubSnapshotColumns?.length) {
    await applyInBatches(
      executor,
      `
        SELECT COUNT(*) as total
        FROM ${spec.snapshotTable} s
        WHERE ${scrubWindowCondition}
          AND (${buildNullCheck('s', spec.scrubSnapshotColumns)})
      `,
      (limit) => `
        UPDATE ${spec.snapshotTable}
        SET ${buildNullAssignments(spec.scrubSnapshotColumns)}
        WHERE id IN (
          SELECT s.id
          FROM ${spec.snapshotTable} s
          WHERE ${scrubWindowCondition}
            AND (${buildNullCheck('s', spec.scrubSnapshotColumns)})
          LIMIT ${limit}
        )
      `,
    );
  }

  const scrubbedItems =
    spec.itemTable && spec.itemSnapshotIdColumn && spec.scrubItemColumns?.length
      ? await queryCount(
          executor,
          `
            SELECT COUNT(*) as total
            FROM ${spec.itemTable} i
            JOIN ${spec.snapshotTable} s ON s.id = i.${spec.itemSnapshotIdColumn}
            WHERE ${scrubWindowCondition}
              AND (${buildNullCheck('i', spec.scrubItemColumns)})
          `,
        )
      : 0;

  if (
    applyChanges &&
    scrubbedItems > 0 &&
    spec.itemTable &&
    spec.itemSnapshotIdColumn &&
    spec.scrubItemColumns?.length
  ) {
    await applyInBatches(
      executor,
      `
        SELECT COUNT(*) as total
        FROM ${spec.itemTable} i
        JOIN ${spec.snapshotTable} s ON s.id = i.${spec.itemSnapshotIdColumn}
        WHERE ${scrubWindowCondition}
          AND (${buildNullCheck('i', spec.scrubItemColumns)})
      `,
      (limit) => `
        UPDATE ${spec.itemTable}
        SET ${buildNullAssignments(spec.scrubItemColumns)}
        WHERE id IN (
          SELECT i.id
          FROM ${spec.itemTable} i
          JOIN ${spec.snapshotTable} s ON s.id = i.${spec.itemSnapshotIdColumn}
          WHERE ${scrubWindowCondition}
            AND (${buildNullCheck('i', spec.scrubItemColumns)})
          LIMIT ${limit}
        )
      `,
    );
  }

  const deletedSnapshots = await queryCount(
    executor,
    `
      SELECT COUNT(*) as total
      FROM ${spec.snapshotTable} s
      WHERE ${deleteCondition}
    `,
  );
  const deletedItems =
    spec.itemTable && spec.itemSnapshotIdColumn
      ? await queryCount(
          executor,
          `
            SELECT COUNT(*) as total
            FROM ${spec.itemTable} i
            JOIN ${spec.snapshotTable} s ON s.id = i.${spec.itemSnapshotIdColumn}
            WHERE ${deleteCondition}
          `,
        )
      : 0;

  if (applyChanges && deletedSnapshots > 0) {
    await applyInBatches(
      executor,
      `
        SELECT COUNT(*) as total
        FROM ${spec.snapshotTable} s
        WHERE ${deleteCondition}
      `,
      (limit) => `
        DELETE FROM ${spec.snapshotTable}
        WHERE id IN (
          SELECT s.id
          FROM ${spec.snapshotTable} s
          WHERE ${deleteCondition}
          LIMIT ${limit}
        )
      `,
    );
  }

  return {
    name: spec.name,
    scrubbedSnapshots,
    scrubbedItems,
    deletedBatches: 0,
    deletedSnapshots,
    deletedItems,
  } satisfies RetentionSummary;
}

async function main() {
  const { db } = await import('../src/db/index');

  const options = parseCliArgs();
  const now = Date.now();
  const cutoffs = buildRetentionCutoffs(now, options.scrubDays, options.deleteDays);

  console.log(
    `scrubDays=${options.scrubDays}, deleteDays=${options.deleteDays}, dryRun=${options.dryRun}, datasets=${options.datasetNames?.join(',') ?? 'all'}, scrubIso=${cutoffs.scrubIso}, deleteIso=${cutoffs.deleteIso}, scrubHour=${cutoffs.scrubHour}, deleteHour=${cutoffs.deleteHour}, scrubDate=${cutoffs.scrubDate}, deleteDate=${cutoffs.deleteDate}`,
  );

  const batchDatasets: BatchDatasetSpec[] = [
    {
      name: 'youtubeHot',
      batchTable: 'youtube_hot_hourly_batches',
      batchDateColumn: 'snapshot_hour',
      snapshotTable: 'youtube_hot_hourly_snapshots',
      snapshotBatchIdColumn: 'batch_id',
      scrubDays: 3,
      itemTable: 'youtube_hot_hourly_items',
      itemSnapshotIdColumn: 'snapshot_id',
      scrubSnapshotColumns: ['raw_payload'],
      scrubItemColumns: ['description', 'metadata_json'],
    },
    {
      name: 'tiktokVideos',
      batchTable: 'tiktok_video_hourly_batches',
      batchDateColumn: 'snapshot_hour',
      snapshotTable: 'tiktok_video_hourly_snapshots',
      snapshotBatchIdColumn: 'batch_id',
      itemTable: 'tiktok_video_hourly_items',
      itemSnapshotIdColumn: 'snapshot_id',
      scrubSnapshotColumns: ['warnings_json', 'timings_json', 'raw_payload'],
      scrubItemColumns: ['raw_item_json'],
    },
    {
      name: 'tiktokHashtags',
      batchTable: 'tiktok_hashtag_hourly_batches',
      batchDateColumn: 'snapshot_hour',
      snapshotTable: 'tiktok_hashtag_hourly_snapshots',
      snapshotBatchIdColumn: 'batch_id',
      itemTable: 'tiktok_hashtag_hourly_items',
      itemSnapshotIdColumn: 'snapshot_id',
      scrubSnapshotColumns: ['warnings_json', 'timings_json', 'raw_payload'],
      scrubItemColumns: ['trend_points_json', 'creator_preview_json', 'detail_json'],
    },
    {
      name: 'xTrends',
      batchTable: 'x_trend_hourly_batches',
      batchDateColumn: 'snapshot_hour',
      snapshotTable: 'x_trend_hourly_snapshots',
      snapshotBatchIdColumn: 'batch_id',
      itemTable: 'x_trend_hourly_items',
      itemSnapshotIdColumn: 'snapshot_id',
      scrubSnapshotColumns: ['raw_payload'],
    },
  ];

  const snapshotDatasets: SnapshotDatasetSpec[] = [
    {
      name: 'youtubeHotDaily',
      snapshotTable: 'youtube_hot_daily_snapshots',
      snapshotDateColumn: 'snapshot_date',
      deleteDays: 30,
      itemTable: 'youtube_hot_daily_items',
      itemSnapshotIdColumn: 'snapshot_id',
    },
    {
      name: 'youtubeLive',
      snapshotTable: 'youtube_live_snapshots',
      snapshotDateColumn: 'crawled_at',
      itemTable: 'youtube_live_items',
      itemSnapshotIdColumn: 'snapshot_id',
    },
    {
      name: 'youtubeMusicWeekly',
      snapshotTable: 'youtube_music_chart_snapshots',
      snapshotDateColumn: 'chart_end_date',
      itemTable: 'youtube_music_chart_items',
      itemSnapshotIdColumn: 'snapshot_id',
      scrubSnapshotColumns: ['raw_payload'],
      scrubItemColumns: ['raw_item_json'],
    },
    {
      name: 'youtubeMusicVideosDaily',
      snapshotTable: 'youtube_music_video_daily_snapshots',
      snapshotDateColumn: 'chart_end_date',
      itemTable: 'youtube_music_video_daily_items',
      itemSnapshotIdColumn: 'snapshot_id',
      scrubSnapshotColumns: ['raw_payload'],
      scrubItemColumns: ['raw_item_json'],
    },
    {
      name: 'youtubeMusicShortsDaily',
      snapshotTable: 'youtube_music_shorts_song_daily_snapshots',
      snapshotDateColumn: 'chart_end_date',
      itemTable: 'youtube_music_shorts_song_daily_items',
      itemSnapshotIdColumn: 'snapshot_id',
      scrubSnapshotColumns: ['raw_payload'],
      scrubItemColumns: ['raw_item_json'],
    },
    {
      name: 'appleMusic',
      snapshotTable: 'apple_music_chart_snapshots',
      snapshotDateColumn: 'chart_end_date',
      itemTable: 'apple_music_chart_items',
      itemSnapshotIdColumn: 'snapshot_id',
      scrubSnapshotColumns: ['raw_payload'],
      scrubItemColumns: ['raw_item_json'],
    },
    {
      name: 'spotify',
      snapshotTable: 'spotify_chart_snapshots',
      snapshotDateColumn: 'chart_end_date',
      itemTable: 'spotify_chart_items',
      itemSnapshotIdColumn: 'snapshot_id',
      scrubSnapshotColumns: ['raw_payload'],
      scrubItemColumns: ['raw_item_json'],
    },
    {
      name: 'steam',
      snapshotTable: 'steam_chart_snapshots',
      snapshotDateColumn: 'snapshot_hour',
      itemTable: 'steam_chart_items',
      itemSnapshotIdColumn: 'snapshot_id',
      scrubSnapshotColumns: ['raw_payload'],
      scrubItemColumns: ['raw_item_json'],
    },
    {
      name: 'appStoreGames',
      snapshotTable: 'app_store_game_chart_snapshots',
      snapshotDateColumn: 'snapshot_hour',
      itemTable: 'app_store_game_chart_items',
      itemSnapshotIdColumn: 'snapshot_id',
      scrubSnapshotColumns: ['raw_payload'],
      scrubItemColumns: ['raw_item_json'],
    },
    {
      name: 'googlePlayGames',
      snapshotTable: 'google_play_game_chart_snapshots',
      snapshotDateColumn: 'snapshot_hour',
      itemTable: 'google_play_game_chart_items',
      itemSnapshotIdColumn: 'snapshot_id',
      scrubSnapshotColumns: ['raw_payload'],
      scrubItemColumns: ['raw_item_json'],
    },
  ];

  const runPurge = async (executor: QueryExecutor, applyChanges: boolean) => {
    const summaries: RetentionSummary[] = [];
    const datasetFilter = options.datasetNames ? new Set(options.datasetNames) : null;

    for (const dataset of batchDatasets) {
      if (datasetFilter && !datasetFilter.has(dataset.name)) continue;
      const retention = resolveRetentionDays(dataset, options);
      const runOne = (queryExecutor: QueryExecutor) =>
        purgeBatchDataset(
          queryExecutor,
          dataset,
          buildRetentionCutoffs(now, retention.scrubDays, retention.deleteDays),
          applyChanges,
        );
      summaries.push(
        applyChanges && executor.transaction
          ? await executor.transaction((tx) => runOne(tx as QueryExecutor))
          : await runOne(executor),
      );
    }

    for (const dataset of snapshotDatasets) {
      if (datasetFilter && !datasetFilter.has(dataset.name)) continue;
      const retention = resolveRetentionDays(dataset, options);
      const runOne = (queryExecutor: QueryExecutor) =>
        purgeSnapshotDataset(
          queryExecutor,
          dataset,
          buildRetentionCutoffs(now, retention.scrubDays, retention.deleteDays),
          applyChanges,
        );
      summaries.push(
        applyChanges && executor.transaction
          ? await executor.transaction((tx) => runOne(tx as QueryExecutor))
          : await runOne(executor),
      );
    }

    return summaries;
  };

  const summaries = await runPurge(db as QueryExecutor, !options.dryRun);

  for (const summary of summaries) {
    console.log(
      `${options.dryRun ? 'dry-run' : 'applied'} ${summary.name} scrubbedSnapshots=${summary.scrubbedSnapshots} scrubbedItems=${summary.scrubbedItems} deletedBatches=${summary.deletedBatches} deletedSnapshots=${summary.deletedSnapshots} deletedItems=${summary.deletedItems}`,
    );
  }
}

main().catch((error) => {
  console.error('db-purge failed:', error);
  process.exit(1);
});
