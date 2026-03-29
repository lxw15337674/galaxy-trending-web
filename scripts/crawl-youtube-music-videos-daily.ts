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

  const { saveYouTubeMusicDailyVideosSnapshot } = await import('../src/lib/youtube-music/daily-videos-db');
  await runYouTubeMusicSerialCrawl({
    scriptName: 'crawl-youtube-music-videos-daily',
    client,
    cliOptions: options,
    envCountries: process.env.YOUTUBE_MUSIC_DAILY_COUNTRY_CODES,
    discoverCountries: async () =>
      (await client.listAvailableDailyTopVideosCountries()).map((entry) => entry.countryCode),
    fetchSnapshot: (countryCode) => client.fetchDailyTopVideos(countryCode),
    saveSnapshot: saveYouTubeMusicDailyVideosSnapshot,
    topLabel: (snapshot) => snapshot.items[0]?.videoTitle ?? 'N/A',
  });
}

main().catch((error) => {
  console.error('crawl-youtube-music-videos-daily failed:', error);
  process.exit(1);
});
