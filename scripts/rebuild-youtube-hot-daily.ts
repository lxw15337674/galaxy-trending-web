import { config as loadEnv } from 'dotenv';
import { listYouTubeHotDailySnapshotDatesFromHourly, rebuildYouTubeHotDailySnapshot } from '../src/lib/youtube-hot/db';
import { parseUtcSnapshotDate } from '../src/lib/youtube-hot/time';

loadEnv({ path: '.env' });
loadEnv({ path: '.env.local', override: true });
loadEnv({ path: '.dev.vars', override: true });

interface CliOptions {
  dryRun: boolean;
  date: string | null;
  from: string | null;
  to: string | null;
}

function parseDateArg(name: string, value: string | undefined) {
  if (!value) return null;

  const parsed = parseUtcSnapshotDate(value);
  if (!parsed) {
    throw new Error(`Invalid --${name} value: ${value}. Expected YYYY-MM-DD in UTC.`);
  }

  return parsed;
}

function parseCliArgs(): CliOptions {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  const parseOption = (name: string) => args.find((arg) => arg.startsWith(`--${name}=`))?.split('=')[1];

  const date = parseDateArg('date', parseOption('date'));
  const from = parseDateArg('from', parseOption('from'));
  const to = parseDateArg('to', parseOption('to'));

  if (date && (from || to)) {
    throw new Error('Use either --date or --from/--to, not both.');
  }

  if (from && to && from > to) {
    throw new Error(`Invalid date range: from=${from} must be earlier than or equal to to=${to}.`);
  }

  return {
    dryRun,
    date,
    from,
    to,
  };
}

function matchDate(options: CliOptions, snapshotDate: string) {
  if (options.date) {
    return snapshotDate === options.date;
  }

  if (options.from && snapshotDate < options.from) {
    return false;
  }

  if (options.to && snapshotDate > options.to) {
    return false;
  }

  return true;
}

async function main() {
  const options = parseCliArgs();
  const snapshotDates = (await listYouTubeHotDailySnapshotDatesFromHourly()).filter((snapshotDate) =>
    matchDate(options, snapshotDate),
  );

  console.log(
    `rebuild youtube hot daily dryRun=${options.dryRun} date=${options.date ?? '-'} from=${options.from ?? '-'} to=${options.to ?? '-'} matchedDates=${snapshotDates.length}`,
  );

  if (!snapshotDates.length) {
    console.log('no matching snapshot dates found');
    return;
  }

  if (options.dryRun) {
    for (const snapshotDate of snapshotDates) {
      console.log(`  [dry-run] ${snapshotDate}`);
    }
    return;
  }

  for (const snapshotDate of snapshotDates) {
    const result = await rebuildYouTubeHotDailySnapshot(snapshotDate);
    console.log(
      `  [rebuilt] snapshotDate=${result.snapshotDate} regions=${result.regionCount} items=${result.itemCount} generatedAt=${result.generatedAt}`,
    );
  }
}

main().catch((error) => {
  console.error('rebuild-youtube-hot-daily failed:', error);
  process.exit(1);
});
