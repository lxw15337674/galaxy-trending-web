import { createClient } from '@libsql/client/http';

function requireEnv(name: string) {
  const value = process.env[name]?.replace(/^\uFEFF+/, '').trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function normalizeTursoUrl(raw: string) {
  if (raw.startsWith('libsql://')) {
    return `https://${raw.slice('libsql://'.length)}`;
  }
  return raw;
}

async function queryAndPrint(client: ReturnType<typeof createClient>, label: string, sql: string) {
  console.log(`\n## ${label}`);
  console.log(sql);

  try {
    const result = await client.execute(sql);
    const rows = result.rows ?? [];
    console.log(JSON.stringify(rows, null, 2));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`ERROR: ${message}`);
  }
}

async function main() {
  const url = normalizeTursoUrl(requireEnv('TURSO_DATABASE_URL'));
  const authToken = process.env.TURSO_AUTH_TOKEN?.replace(/^\uFEFF+/, '').trim() || undefined;

  const client = createClient({
    url,
    authToken,
  });

  await queryAndPrint(
    client,
    'Migration Tables',
    "select name, type from sqlite_master where name in ('__drizzle_migrations', '__drizzle_migrations__') order by name",
  );

  await queryAndPrint(client, 'Migration Table Info', "pragma table_info('__drizzle_migrations')");
  await queryAndPrint(client, 'Migration Rows', "select * from __drizzle_migrations order by 1");

  await queryAndPrint(
    client,
    'Key Tables',
    `
select name, type
from sqlite_master
where type in ('table', 'index')
  and (
    name like 'youtube_music_%'
    or name like 'tiktok_%'
    or name like 'x_trend_%'
  )
order by type, name
    `.trim(),
  );

  await queryAndPrint(
    client,
    'Key Table SQL',
    `
select name, sql
from sqlite_master
where type = 'table'
  and name in (
    'youtube_music_shorts_song_daily_snapshots',
    'youtube_music_shorts_song_daily_items',
    'youtube_music_video_daily_snapshots',
    'youtube_music_video_daily_items',
    'tiktok_hashtag_hourly_batches',
    'tiktok_hashtag_hourly_snapshots',
    'tiktok_hashtag_hourly_items',
    'tiktok_video_hourly_batches',
    'tiktok_video_hourly_snapshots',
    'tiktok_video_hourly_items',
    'x_trend_hourly_batches',
    'x_trend_hourly_snapshots',
    'x_trend_hourly_items'
  )
order by name
    `.trim(),
  );

  await client.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
