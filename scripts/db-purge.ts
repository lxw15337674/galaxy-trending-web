import { config as loadEnv } from 'dotenv';
import { sql } from 'drizzle-orm';

loadEnv({ path: '.env' });
loadEnv({ path: '.env.local', override: true });
loadEnv({ path: '.dev.vars', override: true });

interface CliOptions {
  days: number;
  dryRun: boolean;
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

  const eqArg = args.find((arg) => arg.startsWith('--days='))?.split('=')[1];
  const spacedArgIndex = args.findIndex((arg) => arg === '--days');
  const spacedArg = spacedArgIndex >= 0 ? args[spacedArgIndex + 1] : undefined;
  const days = parsePositiveInt(eqArg ?? spacedArg, 30, 1, 3650);

  return { days, dryRun };
}

async function main() {
  const { db } = await import('../src/db/index');
  const { purgeYouTubeLiveSnapshotsBefore } = await import('../src/lib/youtube-live/db');

  const options = parseCliArgs();
  const now = Date.now();
  const cutoffMs = now - options.days * 24 * 60 * 60 * 1000;
  const cutoffIso = new Date(cutoffMs).toISOString();

  console.log(`days=${options.days}, dryRun=${options.dryRun}, cutoffIso=${cutoffIso}`);

  if (options.dryRun) {
    const liveRows = await db.all<{ total: number }>(sql`
      SELECT COUNT(*) as total
      FROM youtube_live_snapshots
      WHERE crawled_at < ${cutoffIso}
    `);
    console.log(`dry-run liveSnapshots=${Number(liveRows[0]?.total ?? 0)}`);
    return;
  }

  const liveSummary = await purgeYouTubeLiveSnapshotsBefore(cutoffIso);
  console.log(`purged liveSnapshots=${liveSummary.deletedSnapshots} liveItems=${liveSummary.deletedItems}`);
}

main().catch((error) => {
  console.error('db-purge failed:', error);
  process.exit(1);
});
