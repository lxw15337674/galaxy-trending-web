import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { parsePositiveNumber } from './_shared/cli-parsers';
import { loadScriptEnv } from './_shared/load-env';
import {
  AppleMusicGlobalPlaylistError,
  fetchAppleMusicGlobalPlaylistSnapshot,
} from '../src/lib/apple-music/global-playlist';

loadScriptEnv();

interface CliOptions {
  dryRun: boolean;
  headless: boolean;
  timeoutMs: number;
  waitAfterLoadMs: number;
  browserExecutablePath?: string;
  diagnosticsFile?: string;
}

function parseCliArgs(): CliOptions {
  const args = process.argv.slice(2);
  const browserExecutablePath =
    args.find((arg) => arg.startsWith('--browser-executable-path='))?.split('=')[1]?.trim() || undefined;
  const diagnosticsFileArg = args.find((arg) => arg.startsWith('--diagnostics-file='))?.split('=')[1];

  return {
    dryRun: args.includes('--dry-run'),
    headless: !args.includes('--headed'),
    timeoutMs: parsePositiveNumber(args.find((arg) => arg.startsWith('--timeout-ms='))?.split('=')[1], 45_000, 5_000, 180_000),
    waitAfterLoadMs: parsePositiveNumber(
      args.find((arg) => arg.startsWith('--wait-after-load-ms='))?.split('=')[1],
      1_500,
      0,
      30_000,
    ),
    browserExecutablePath,
    diagnosticsFile: diagnosticsFileArg ? path.resolve(diagnosticsFileArg) : undefined,
  };
}

async function writeDiagnosticsFile(filePath: string | undefined, value: unknown) {
  if (!filePath) return;
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function main() {
  const options = parseCliArgs();
  const tursoUrl = process.env.TURSO_DATABASE_URL?.trim();
  if (!options.dryRun && !tursoUrl) {
    throw new Error('TURSO_DATABASE_URL is missing. Set it before writing snapshots.');
  }

  const { snapshot, diagnostics } = await fetchAppleMusicGlobalPlaylistSnapshot({
    headless: options.headless,
    timeoutMs: options.timeoutMs,
    waitAfterLoadMs: options.waitAfterLoadMs,
    browserExecutablePath: options.browserExecutablePath ?? process.env.APPLE_MUSIC_BROWSER_EXECUTABLE_PATH?.trim(),
  });

  console.log(
    [
      `country=${snapshot.countryCode}`,
      `chartEndDate=${snapshot.chartEndDate}`,
      `fetchedAt=${snapshot.fetchedAt}`,
      `itemCount=${snapshot.items.length}`,
      `top=${snapshot.items[0]?.trackName ?? 'N/A'}`,
      `method=${diagnostics.extraction.selectedMethod}`,
      `finalUrl=${diagnostics.finalUrl}`,
    ].join(' '),
  );

  await writeDiagnosticsFile(options.diagnosticsFile, diagnostics);

  if (options.dryRun) {
    console.log('dry-run complete, no database writes');
    return;
  }

  const { saveAppleMusicTopSongsSnapshot } = await import('../src/lib/apple-music/db');
  const snapshotId = await saveAppleMusicTopSongsSnapshot(snapshot);
  console.log(`stored snapshot id=${snapshotId} country=${snapshot.countryCode} chartEndDate=${snapshot.chartEndDate}`);
}

main().catch(async (error) => {
  if (error instanceof AppleMusicGlobalPlaylistError && error.diagnostics) {
    console.error(JSON.stringify(error.diagnostics, null, 2));
  }

  console.error('crawl-apple-music-top-songs-global failed:', error);
  process.exit(1);
});
