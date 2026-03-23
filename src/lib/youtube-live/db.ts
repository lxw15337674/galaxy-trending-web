import { sql } from 'drizzle-orm';
import { db } from '@/db/index';
import { YouTubeLiveItem } from '@/lib/youtube-hot/types';

interface SnapshotIdRow {
  id: number;
}

interface SnapshotRow {
  id: number;
  crawledAt: string;
  status: 'success' | 'failed';
  sourceUrl: string;
  detailSourceUrl: string | null;
  itemCount: number;
  errorText: string | null;
}

interface ItemRow {
  rank: number;
  videoId: string;
  videoUrl: string;
  title: string;
  thumbnailUrl: string | null;
  categoryId: string | null;
  categoryTitle: string | null;
  defaultLanguage: string | null;
  defaultAudioLanguage: string | null;
  channelId: string;
  channelTitle: string;
  channelUrl: string;
  channelAvatarUrl: string | null;
  subscriberCount: number | null;
  hiddenSubscriberCount: number;
  concurrentViewers: number | null;
  viewCount: number | null;
  likeCount: number | null;
  commentCount: number | null;
  startedAt: string | null;
  scheduledStartTime: string | null;
  fetchedAt: string;
}

interface PurgeCountRow {
  total: number;
}

export interface YouTubeLiveSnapshotWithItems {
  id: number;
  crawledAt: string;
  status: 'success' | 'failed';
  sourceUrl: string;
  detailSourceUrl: string;
  itemCount: number;
  errorText: string | null;
  items: YouTubeLiveItem[];
}

const LIVE_CACHE_TTL_MS = 60 * 1000;
const SQLITE_MAX_VARIABLE_NUMBER = 32766;
const YOUTUBE_LIVE_ITEM_INSERT_COLUMNS = 24;
const YOUTUBE_LIVE_ITEM_MAX_ROWS_PER_CHUNK = Math.max(
  1,
  Math.floor((SQLITE_MAX_VARIABLE_NUMBER - 100) / YOUTUBE_LIVE_ITEM_INSERT_COLUMNS),
);
let latestSnapshotCache:
  | {
      expiresAt: number;
      data: YouTubeLiveSnapshotWithItems | null;
    }
  | null = null;

function nowUtcIso() {
  return new Date().toISOString();
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toNullableNumber(value: unknown) {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toBooleanInt(value: unknown) {
  return toNumber(value, 0) === 1;
}

function clearYouTubeLiveCache() {
  latestSnapshotCache = null;
}

function getYouTubeLiveCacheHit() {
  if (!latestSnapshotCache) return null;
  if (Date.now() > latestSnapshotCache.expiresAt) return null;
  return latestSnapshotCache.data;
}

type SqlExecutor = Pick<typeof db, 'run'>;

async function replaceLiveItems(executor: SqlExecutor, snapshotId: number, items: YouTubeLiveItem[]) {
  await executor.run(sql`DELETE FROM youtube_live_items WHERE snapshot_id = ${snapshotId}`);
  if (!items.length) return;

  const createdAt = nowUtcIso();
  for (let start = 0; start < items.length; start += YOUTUBE_LIVE_ITEM_MAX_ROWS_PER_CHUNK) {
    const chunk = items.slice(start, start + YOUTUBE_LIVE_ITEM_MAX_ROWS_PER_CHUNK);
    const valueRows = chunk.map((item) => sql`
      (
        ${snapshotId},
        ${item.rank},
        ${item.videoId},
        ${item.videoUrl},
        ${item.title},
        ${item.thumbnailUrl},
        ${item.categoryId},
        ${item.categoryTitle},
        ${item.defaultLanguage},
        ${item.defaultAudioLanguage},
        ${item.channelId},
        ${item.channelTitle},
        ${item.channelUrl},
        ${item.channelAvatarUrl},
        ${item.subscriberCount},
        ${item.hiddenSubscriberCount ? 1 : 0},
        ${item.concurrentViewers},
        ${item.viewCount},
        ${item.likeCount},
        ${item.commentCount},
        ${item.startedAt},
        ${item.scheduledStartTime},
        ${item.fetchedAt},
        ${createdAt}
      )
    `);

    await executor.run(sql`
      INSERT INTO youtube_live_items (
        snapshot_id,
        rank,
        video_id,
        video_url,
        title,
        thumbnail_url,
        category_id,
        category_title,
        default_language,
        default_audio_language,
        channel_id,
        channel_title,
        channel_url,
        channel_avatar_url,
        subscriber_count,
        hidden_subscriber_count,
        concurrent_viewers,
        view_count,
        like_count,
        comment_count,
        started_at,
        scheduled_start_time,
        fetched_at,
        created_at
      )
      VALUES ${sql.join(valueRows, sql`, `)}
    `);
  }
}

export async function saveYouTubeLiveSnapshot(params: {
  crawledAt: string;
  sourceUrl: string;
  detailSourceUrl: string | null;
  status: 'success' | 'failed';
  items: YouTubeLiveItem[];
  errorText: string | null;
}) {
  const snapshotId = await db.transaction(async (tx) => {
    const rows = await tx.all<SnapshotIdRow>(sql`
      INSERT INTO youtube_live_snapshots (
        crawled_at,
        status,
        source_url,
        detail_source_url,
        item_count,
        error_text
      )
      VALUES (
        ${params.crawledAt},
        ${params.status},
        ${params.sourceUrl},
        ${params.detailSourceUrl},
        ${params.items.length},
        ${params.errorText}
      )
      RETURNING id
    `);

    const newSnapshotId = rows[0]?.id;
    if (!newSnapshotId) {
      throw new Error('Failed to create youtube live snapshot');
    }

    if (params.status === 'success' && params.items.length) {
      await replaceLiveItems(tx, newSnapshotId, params.items);
    }

    return newSnapshotId;
  });

  clearYouTubeLiveCache();
  return snapshotId;
}

export async function getLatestYouTubeLiveSnapshot(): Promise<YouTubeLiveSnapshotWithItems | null> {
  const cached = getYouTubeLiveCacheHit();
  if (cached !== null) return cached;

  const snapshots = await db.all<SnapshotRow>(sql`
    SELECT
      id,
      crawled_at as crawledAt,
      status,
      source_url as sourceUrl,
      detail_source_url as detailSourceUrl,
      item_count as itemCount,
      error_text as errorText
    FROM youtube_live_snapshots
    ORDER BY crawled_at DESC, id DESC
    LIMIT 1
  `);

  const snapshot = snapshots[0];
  if (!snapshot) {
    latestSnapshotCache = { data: null, expiresAt: Date.now() + LIVE_CACHE_TTL_MS };
    return null;
  }

  const snapshotId = toNumber(snapshot.id, 0);
  const itemRows = await db.all<ItemRow>(sql`
    SELECT
      rank,
      video_id as videoId,
      video_url as videoUrl,
      title,
      thumbnail_url as thumbnailUrl,
      category_id as categoryId,
      category_title as categoryTitle,
      default_language as defaultLanguage,
      default_audio_language as defaultAudioLanguage,
      channel_id as channelId,
      channel_title as channelTitle,
      channel_url as channelUrl,
      channel_avatar_url as channelAvatarUrl,
      subscriber_count as subscriberCount,
      hidden_subscriber_count as hiddenSubscriberCount,
      concurrent_viewers as concurrentViewers,
      view_count as viewCount,
      like_count as likeCount,
      comment_count as commentCount,
      started_at as startedAt,
      scheduled_start_time as scheduledStartTime,
      fetched_at as fetchedAt
    FROM youtube_live_items
    WHERE snapshot_id = ${snapshotId}
    ORDER BY rank ASC
  `);

  const items: YouTubeLiveItem[] = itemRows.map((item) => ({
    rank: toNumber(item.rank, 0),
    videoId: item.videoId,
    videoUrl: item.videoUrl,
    title: item.title,
    thumbnailUrl: item.thumbnailUrl,
    categoryId: item.categoryId,
    categoryTitle: item.categoryTitle,
    defaultLanguage: item.defaultLanguage,
    defaultAudioLanguage: item.defaultAudioLanguage,
    channelId: item.channelId,
    channelTitle: item.channelTitle,
    channelUrl: item.channelUrl,
    channelAvatarUrl: item.channelAvatarUrl,
    subscriberCount: toNullableNumber(item.subscriberCount),
    hiddenSubscriberCount: toBooleanInt(item.hiddenSubscriberCount),
    concurrentViewers: toNullableNumber(item.concurrentViewers),
    viewCount: toNullableNumber(item.viewCount),
    likeCount: toNullableNumber(item.likeCount),
    commentCount: toNullableNumber(item.commentCount),
    startedAt: item.startedAt,
    scheduledStartTime: item.scheduledStartTime,
    fetchedAt: item.fetchedAt,
  }));

  const data: YouTubeLiveSnapshotWithItems = {
    id: snapshotId,
    crawledAt: snapshot.crawledAt,
    status: snapshot.status,
    sourceUrl: snapshot.sourceUrl,
    detailSourceUrl: snapshot.detailSourceUrl ?? '',
    itemCount: toNumber(snapshot.itemCount, 0),
    errorText: snapshot.errorText,
    items,
  };

  latestSnapshotCache = { data, expiresAt: Date.now() + LIVE_CACHE_TTL_MS };
  return data;
}

export async function purgeYouTubeLiveSnapshotsBefore(cutoffIso: string) {
  const summary = await db.transaction(async (tx) => {
    const toDelete = await tx.all<SnapshotIdRow>(sql`
      SELECT id
      FROM youtube_live_snapshots
      WHERE crawled_at < ${cutoffIso}
    `);

    if (!toDelete.length) {
      return {
        deletedSnapshots: 0,
        deletedItems: 0,
      };
    }

    let deletedItems = 0;
    for (const row of toDelete) {
      const itemRows = await tx.all<PurgeCountRow>(sql`
        SELECT COUNT(*) as total
        FROM youtube_live_items
        WHERE snapshot_id = ${row.id}
      `);
      deletedItems += Number(itemRows[0]?.total ?? 0);
      await tx.run(sql`DELETE FROM youtube_live_items WHERE snapshot_id = ${row.id}`);
      await tx.run(sql`DELETE FROM youtube_live_snapshots WHERE id = ${row.id}`);
    }

    return {
      deletedSnapshots: toDelete.length,
      deletedItems,
    };
  });

  clearYouTubeLiveCache();
  return summary;
}
