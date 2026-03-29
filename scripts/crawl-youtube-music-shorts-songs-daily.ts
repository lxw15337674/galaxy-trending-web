import { config as loadEnv } from 'dotenv';
import { YouTubeMusicChartsClient } from '../src/lib/youtube-music/client';
import { parseMusicCrawlerCliArgs, runYouTubeMusicSerialCrawl } from './crawl-youtube-music-shared';

loadEnv({ path: '.env' });
loadEnv({ path: '.env.local', override: true });
loadEnv({ path: '.dev.vars', override: true });

async function main() {
  const options = parseMusicCrawlerCliArgs(process.argv.slice(2));
  const client = new YouTubeMusicChartsClient();

  const tursoUrl = process.env.TURSO_DATABASE_URL?.trim();
  if (!tursoUrl) {
    throw new Error('TURSO_DATABASE_URL is missing. Set it before writing snapshots.');
  }

  const { saveYouTubeMusicDailyShortsSongsSnapshot } = await import('../src/lib/youtube-music/daily-shorts-db');
  await runYouTubeMusicSerialCrawl({
    scriptName: 'crawl-youtube-music-shorts-songs-daily',
    client,
    cliOptions: options,
    envCountries: process.env.YOUTUBE_MUSIC_DAILY_COUNTRY_CODES,
    discoverCountries: async () =>
      (await client.listAvailableDailyShortsSongsCountries()).map((entry) => entry.countryCode),
    fetchSnapshot: (countryCode) => client.fetchDailyShortsSongs(countryCode),
    saveSnapshot: saveYouTubeMusicDailyShortsSongsSnapshot,
    topLabel: (snapshot) => snapshot.items[0]?.trackName ?? 'N/A',
  });
}

main().catch((error) => {
  console.error('crawl-youtube-music-shorts-songs-daily failed:', error);
  process.exit(1);
});
