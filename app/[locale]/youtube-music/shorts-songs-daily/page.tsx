import type { Metadata } from 'next';
import {
  generateMusicRouteMetadata,
  renderMusicRoute,
  type MusicPageProps,
} from '../../music/shared';

export const revalidate = 600;

export async function generateMetadata({ params, searchParams }: MusicPageProps): Promise<Metadata> {
  return generateMusicRouteMetadata({ params, searchParams }, 'youtube-music-shorts-songs-daily');
}

export default async function YouTubeMusicShortsSongsDailyPage({
  params,
  searchParams,
}: MusicPageProps) {
  return renderMusicRoute({ params, searchParams }, 'youtube-music-shorts-songs-daily');
}
