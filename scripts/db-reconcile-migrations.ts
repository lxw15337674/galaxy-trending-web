import { createClient } from '@libsql/client/http';

interface ReconcileTarget {
  tag: string;
  hash: string;
  probeTables: string[];
}

const reconcileTargets: ReconcileTarget[] = [
  {
    tag: '0002_worthless_wind_dancer',
    hash: '1ae6826dfe1e9395b7467b5a3d4a93a6db6d232f1c84fffe5d16b131129ef238',
    probeTables: [
      'youtube_music_shorts_song_daily_snapshots',
      'youtube_music_shorts_song_daily_items',
      'youtube_music_video_daily_snapshots',
      'youtube_music_video_daily_items',
    ],
  },
  {
    tag: '0003_spotty_electro',
    hash: '32712ec6bbbe946368c26a83ffeacb28520cbfa8525a27bdf6eddce7f0992868',
    probeTables: [
      'tiktok_hashtag_hourly_batches',
      'tiktok_hashtag_hourly_snapshots',
      'tiktok_hashtag_hourly_items',
      'tiktok_video_hourly_batches',
      'tiktok_video_hourly_snapshots',
      'tiktok_video_hourly_items',
    ],
  },
];

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

async function main() {
  const client = createClient({
    url: normalizeTursoUrl(requireEnv('TURSO_DATABASE_URL')),
    authToken: process.env.TURSO_AUTH_TOKEN?.replace(/^\uFEFF+/, '').trim() || undefined,
  });

  const existingRows = await client.execute('select hash from __drizzle_migrations');
  const existingHashes = new Set(
    (existingRows.rows ?? [])
      .map((row) => (typeof row.hash === 'string' ? row.hash : String(row.hash ?? '')))
      .filter((value) => value.length > 0),
  );

  for (const target of reconcileTargets) {
    if (existingHashes.has(target.hash)) {
      console.log(`skip ${target.tag}: migration hash already recorded`);
      continue;
    }

    const placeholders = target.probeTables.map(() => '?').join(', ');
    const tableCheck = await client.execute({
      sql: `select name from sqlite_master where type = 'table' and name in (${placeholders})`,
      args: target.probeTables,
    });

    const existingTables = new Set(
      (tableCheck.rows ?? [])
        .map((row) => (typeof row.name === 'string' ? row.name : String(row.name ?? '')))
        .filter((value) => value.length > 0),
    );

    const missingTables = target.probeTables.filter((name) => !existingTables.has(name));
    if (missingTables.length > 0) {
      console.log(`skip ${target.tag}: missing probe tables ${missingTables.join(', ')}`);
      continue;
    }

    await client.execute({
      sql: 'insert into __drizzle_migrations (hash, created_at) values (?, ?)',
      args: [target.hash, Date.now()],
    });

    existingHashes.add(target.hash);
    console.log(`applied ${target.tag}: inserted missing migration record`);
  }

  const finalRows = await client.execute('select hash, created_at from __drizzle_migrations order by created_at');
  console.log(JSON.stringify(finalRows.rows ?? [], null, 2));

  await client.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
