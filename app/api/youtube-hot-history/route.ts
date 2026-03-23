import { NextRequest, NextResponse } from 'next/server';
import { queryLatestYouTubeHot } from '@/lib/youtube-hot/db';

function parsePositiveInt(value: string | null, fallback: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), max);
}

function normalizeFilterValue(value: string | null) {
  const normalized = value?.trim() ?? '';
  if (!normalized || normalized.toLowerCase() === 'all') return null;
  return normalized;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const region = normalizeFilterValue(searchParams.get('region'))?.toUpperCase() ?? null;
    const category = normalizeFilterValue(searchParams.get('category'));
    const page = parsePositiveInt(searchParams.get('page'), 1, 100000);
    const pageSize = parsePositiveInt(searchParams.get('pageSize'), 20, 100);

    const result = await queryLatestYouTubeHot({
      region,
      category,
      page,
      pageSize,
    });

    return NextResponse.json({
      query: {
        region,
        category,
        page,
        pageSize,
      },
      batch: result.batch,
      pagination: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: result.totalPages,
      },
      data: result.data,
    });
  } catch (error) {
    console.error('youtube hot history api error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
