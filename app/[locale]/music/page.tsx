import type { Metadata } from 'next';
import {
  generateMusicRouteMetadata,
  renderMusicRoute,
  type MusicPageProps,
} from './shared';

export const revalidate = 600;

export async function generateMetadata({ params, searchParams }: MusicPageProps): Promise<Metadata> {
  return generateMusicRouteMetadata({ params, searchParams });
}

export default async function MusicPage({ params, searchParams }: MusicPageProps) {
  return renderMusicRoute({ params, searchParams });
}
