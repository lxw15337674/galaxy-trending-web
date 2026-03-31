import { config as loadEnv } from 'dotenv';
import { TwitchHelixClient } from '../src/lib/twitch/client';

loadEnv({ path: '.env' });
loadEnv({ path: '.env.local', override: true });
loadEnv({ path: '.dev.vars', override: true });

interface CliOptions {
  dryRun: boolean;
  pageSize: number;
  pages: number;
  language?: string;
  gameIds: string[];
}

function parsePositiveInt(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const normalized = Math.floor(parsed);
  if (normalized < min) return min;
  if (normalized > max) return max;
  return normalized;
}

function parseListArg(value: string | undefined) {
  if (!value) return [];
  return Array.from(
    new Set(
      value
        .split(/[,\s]+/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function parseCliArgs(argv: string[]): CliOptions {
  const dryRun = argv.includes('--dry-run');
  const pageSize = parsePositiveInt(
    argv.find((arg) => arg.startsWith('--page-size='))?.split('=')[1],
    100,
    1,
    100,
  );
  const pages = parsePositiveInt(
    argv.find((arg) => arg.startsWith('--pages='))?.split('=')[1],
    1,
    1,
    20,
  );
  const language = argv.find((arg) => arg.startsWith('--language='))?.split('=')[1]?.trim() || undefined;
  const gameIds = parseListArg(argv.find((arg) => arg.startsWith('--game-ids='))?.split('=')[1]);

  return {
    dryRun,
    pageSize,
    pages,
    language,
    gameIds,
  };
}

async function main() {
  const options = parseCliArgs(process.argv.slice(2));
  const clientId = process.env.TWITCH_CLIENT_ID?.trim();
  const clientSecret = process.env.TWITCH_CLIENT_SECRET?.trim();

  if (!clientId) {
    throw new Error('TWITCH_CLIENT_ID is missing');
  }

  if (!clientSecret) {
    throw new Error('TWITCH_CLIENT_SECRET is missing');
  }

  const client = new TwitchHelixClient(clientId, clientSecret);
  console.log(
    `dryRun=${options.dryRun}, pageSize=${options.pageSize}, pages=${options.pages}, language=${options.language ?? 'all'}, gameIds=${options.gameIds.join(',') || 'all'}`,
  );

  const result = await client.listTopStreams({
    pageSize: options.pageSize,
    pages: options.pages,
    language: options.language,
    gameIds: options.gameIds,
  });

  console.log(
    `fetchedAt=${result.fetchedAt}, itemCount=${result.itemCount}, top=${result.items[0]?.userName ?? 'N/A'} :: ${result.items[0]?.title ?? 'N/A'}`,
  );

  result.items.slice(0, Math.min(10, result.items.length)).forEach((item, index) => {
    console.log(
      `rank=${index + 1}, user=${item.userName}, viewers=${item.viewerCount}, game=${item.gameName || 'N/A'}, language=${item.language || 'N/A'}, title=${item.title}`,
    );
  });

  if (options.dryRun) {
    console.log('dry-run complete, no database writes');
    return;
  }

  console.log('fetch complete; persistence is not implemented yet for Twitch streams');
}

main().catch((error) => {
  console.error('crawl-twitch-top-streams failed:', error);
  process.exit(1);
});
