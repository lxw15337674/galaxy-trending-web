import { NextResponse } from 'next/server';
import { getLatestPublishedBatch, listLatestYouTubeHotFilters } from '@/lib/youtube-hot/db';

export async function GET() {
  try {
    const [batch, filters] = await Promise.all([getLatestPublishedBatch(), listLatestYouTubeHotFilters()]);

    return NextResponse.json({
      batch,
      data: filters,
    });
  } catch (error) {
    console.error('youtube hot filters api error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
