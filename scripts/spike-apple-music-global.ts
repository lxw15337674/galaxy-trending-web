import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { parsePositiveNumber } from './_shared/cli-parsers';
import { loadScriptEnv } from './_shared/load-env';
import { collectAppleMusicGlobalPlaylistDiagnostics } from '../src/lib/apple-music/global-playlist';

loadScriptEnv();

interface CliOptions {
  headless: boolean;
  timeoutMs: number;
  waitAfterLoadMs: number;
  outFile: string;
  browserExecutablePath?: string;
}

function parseCliArgs(): CliOptions {
  const args = process.argv.slice(2);
  const browserExecutablePath =
    args.find((arg) => arg.startsWith('--browser-executable-path='))?.split('=')[1]?.trim() || undefined;
  const outFileArg = args.find((arg) => arg.startsWith('--out-file='))?.split('=')[1];

  return {
    headless: !args.includes('--headed'),
    timeoutMs: parsePositiveNumber(args.find((arg) => arg.startsWith('--timeout-ms='))?.split('=')[1], 45_000, 5_000, 180_000),
    waitAfterLoadMs: parsePositiveNumber(
      args.find((arg) => arg.startsWith('--wait-after-load-ms='))?.split('=')[1],
      1_500,
      0,
      30_000,
    ),
    outFile: path.resolve(outFileArg || '.tmp/apple-music-global-spike.json'),
    browserExecutablePath,
  };
}

async function main() {
  const options = parseCliArgs();
  const diagnostics = await collectAppleMusicGlobalPlaylistDiagnostics({
    headless: options.headless,
    timeoutMs: options.timeoutMs,
    waitAfterLoadMs: options.waitAfterLoadMs,
    browserExecutablePath: options.browserExecutablePath ?? process.env.APPLE_MUSIC_BROWSER_EXECUTABLE_PATH?.trim(),
  });

  await mkdir(path.dirname(options.outFile), { recursive: true });
  await writeFile(options.outFile, `${JSON.stringify(diagnostics, null, 2)}\n`, 'utf8');

  console.log(JSON.stringify(diagnostics, null, 2));
  console.log(`saved diagnostic report to ${options.outFile}`);
}

main().catch((error) => {
  console.error('spike-apple-music-global failed:', error);
  process.exit(1);
});
