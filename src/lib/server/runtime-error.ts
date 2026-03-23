export function getRuntimeErrorText(error: unknown) {
  const message = String((error as { message?: unknown })?.message ?? '');
  const causeMessage = String(
    (error as { cause?: { message?: unknown; proto?: { message?: unknown } } })?.cause?.message ??
      (error as { cause?: { message?: unknown; proto?: { message?: unknown } } })?.cause?.proto?.message ??
      '',
  );
  return `${message} ${causeMessage}`.toLowerCase();
}

export type RuntimeErrorCategory =
  | 'missing_db_env'
  | 'missing_table'
  | 'query_failed'
  | 'network'
  | 'auth'
  | 'unknown';

export function classifyRuntimeError(error: unknown): RuntimeErrorCategory {
  const text = getRuntimeErrorText(error);

  if (text.includes('db_env_missing') || text.includes('database env missing')) return 'missing_db_env';
  if (text.includes('no such table')) return 'missing_table';
  if (text.includes('failed query')) return 'query_failed';
  if (text.includes('auth') || text.includes('unauthorized') || text.includes('forbidden')) return 'auth';
  if (
    text.includes('econnreset') ||
    text.includes('fetch failed') ||
    text.includes('timeout') ||
    text.includes('network') ||
    text.includes('tls')
  ) {
    return 'network';
  }
  return 'unknown';
}

export function logServerError(scope: string, error: unknown, extra?: Record<string, unknown>) {
  console.error(`[${scope}]`, {
    category: classifyRuntimeError(error),
    message: (error as { message?: unknown })?.message ?? String(error),
    extra: extra ?? null,
  });
}
