import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db, getDbRuntimeInfo } from '@/db/index';

function getErrorText(error: unknown) {
  const message = String((error as { message?: unknown })?.message ?? '');
  const causeMessage = String(
    (error as { cause?: { message?: unknown; proto?: { message?: unknown } } })?.cause?.message ??
      (error as { cause?: { message?: unknown; proto?: { message?: unknown } } })?.cause?.proto?.message ??
      '',
  );

  return `${message} ${causeMessage}`.toLowerCase();
}

function classifyError(error: unknown) {
  const text = getErrorText(error);

  if (text.includes('db_env_missing') || text.includes('database env missing')) return 'missing_db_env';
  if (text.includes('no such table')) return 'missing_table';
  if (text.includes('auth') || text.includes('unauthorized') || text.includes('forbidden')) return 'auth_error';
  if (
    text.includes('econnreset') ||
    text.includes('fetch failed') ||
    text.includes('timeout') ||
    text.includes('network') ||
    text.includes('tls')
  ) {
    return 'network_error';
  }
  if (text.includes('failed query')) return 'query_error';
  return 'unknown_error';
}

function toSafeString(value: unknown) {
  return typeof value === 'string' ? value : String(value ?? '');
}

function trimBom(value: string) {
  return value.replace(/^\uFEFF+/, '').trim();
}

function serializeError(error: unknown) {
  const err = error as {
    name?: unknown;
    message?: unknown;
    stack?: unknown;
    code?: unknown;
    cause?: {
      name?: unknown;
      message?: unknown;
      stack?: unknown;
      code?: unknown;
      proto?: { message?: unknown; stack?: unknown };
    };
  };

  return {
    name: toSafeString(err?.name),
    message: toSafeString(err?.message),
    stack: toSafeString(err?.stack),
    code: toSafeString(err?.code),
    cause: {
      name: toSafeString(err?.cause?.name),
      message: toSafeString(err?.cause?.message ?? err?.cause?.proto?.message),
      stack: toSafeString(err?.cause?.stack ?? err?.cause?.proto?.stack),
      code: toSafeString(err?.cause?.code),
    },
  };
}

export const dynamic = 'force-dynamic';

async function runDirectProbe(urlHost: string, authToken: string) {
  if (!urlHost) {
    return {
      status: 0,
      body: 'missing host',
    };
  }

  try {
    const response = await fetch(`https://${urlHost}/v2/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    const body = (await response.text()).slice(0, 240);

    return {
      status: response.status,
      body,
    };
  } catch (error) {
    return {
      status: 0,
      body: error instanceof Error ? error.message : 'probe fetch failed',
    };
  }
}

export async function GET() {
  const startedAt = Date.now();
  const runtimeInfo = getDbRuntimeInfo();
  const tursoUrl = process.env.TURSO_DATABASE_URL ? trimBom(process.env.TURSO_DATABASE_URL) : '';
  const authToken = process.env.TURSO_AUTH_TOKEN ? trimBom(process.env.TURSO_AUTH_TOKEN) : '';
  const urlHost = runtimeInfo.urlHost;
  const urlProtocol = tursoUrl ? (() => {
    try {
      return new URL(tursoUrl).protocol;
    } catch {
      return 'invalid';
    }
  })() : '';

  try {
    if (!runtimeInfo.configured) {
      return NextResponse.json(
        {
          ok: false,
          latencyMs: Date.now() - startedAt,
          category: 'missing_db_env',
          message: 'Database env missing: TURSO_DATABASE_URL is required.',
          env: {
            configured: runtimeInfo.configured,
            hasUrl: runtimeInfo.hasUrl,
            hasAuthToken: runtimeInfo.hasAuthToken,
            urlProtocol,
            urlHost,
            tokenLength: authToken.length,
          },
        },
        { status: 503 },
      );
    }

    const pingRows = await db.all<{ ok: number }>(sql`SELECT 1 as ok`);
    const youtubeTrendingBatchRows = await db.all<{ total: number }>(sql`
      SELECT COUNT(*) as total
      FROM youtube_hot_hourly_batches
      LIMIT 1
    `);
    const youtubeTrendingSnapshotRows = await db.all<{ total: number }>(sql`
      SELECT COUNT(*) as total
      FROM youtube_hot_hourly_snapshots
      LIMIT 1
    `);
    const youtubeTrendingItemRows = await db.all<{ total: number }>(sql`
      SELECT COUNT(*) as total
      FROM youtube_hot_hourly_items
      LIMIT 1
    `);
    const youtubeLiveRows = await db.all<{ total: number }>(sql`
      SELECT COUNT(*) as total
      FROM youtube_live_snapshots
      LIMIT 1
    `);
    const youtubeLiveItemsRows = await db.all<{ total: number }>(sql`
      SELECT COUNT(*) as total
      FROM youtube_live_items
      LIMIT 1
    `);

    return NextResponse.json(
      {
        ok: true,
        latencyMs: Date.now() - startedAt,
        env: {
          configured: runtimeInfo.configured,
          hasUrl: runtimeInfo.hasUrl,
          hasAuthToken: runtimeInfo.hasAuthToken,
          urlProtocol,
          urlHost,
          tokenLength: authToken.length,
        },
        checks: {
          ping: Number(pingRows[0]?.ok ?? 0) === 1,
          youtubeTrendingBatchesCount: Number(youtubeTrendingBatchRows[0]?.total ?? 0),
          youtubeTrendingSnapshotsCount: Number(youtubeTrendingSnapshotRows[0]?.total ?? 0),
          youtubeTrendingItemsCount: Number(youtubeTrendingItemRows[0]?.total ?? 0),
          youtubeLiveSnapshotsCount: Number(youtubeLiveRows[0]?.total ?? 0),
          youtubeLiveItemsCount: Number(youtubeLiveItemsRows[0]?.total ?? 0),
        },
      },
      { status: 200 },
    );
  } catch (error) {
    const diagnostics = serializeError(error);
    const directProbe = await runDirectProbe(urlHost, authToken);

    return NextResponse.json(
      {
        ok: false,
        latencyMs: Date.now() - startedAt,
        category: classifyError(error),
        message: diagnostics.message || 'unknown error',
        env: {
          configured: runtimeInfo.configured,
          hasUrl: runtimeInfo.hasUrl,
          hasAuthToken: runtimeInfo.hasAuthToken,
          urlProtocol,
          urlHost,
          tokenLength: authToken.length,
        },
        error: diagnostics,
        directProbe,
      },
      { status: 503 },
    );
  }
}
