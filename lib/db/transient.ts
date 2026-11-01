// Errors that go away when the same unit of work is tried again (docs/gaps/prov-race2.md). A sandbox build is made of
// steps that overlap by design; when one of them meets a unique violation raced by another step, a deadlock, a
// serialization failure or a dropped connection, ending the whole build FAILED (final for the student) is the wrong
// answer. The caller retries a bounded number of times and only then reports the error.

const CODES = new Set([
  'P2002', // Prisma: unique constraint failed (the other step created the row first)
  'P2024', // timed out fetching a connection from the pool
  'P2028', // transaction API error (closed, timed out)
  'P2034', // write conflict or deadlock
  'P1001',
  'P1002',
  'P1008',
  'P1017', // server (has )?closed the connection
  '23505', // unique_violation
  '40001', // serialization_failure
  '40P01', // deadlock_detected
  '57P01', // admin_shutdown
  'ECONNRESET',
  'EPIPE',
]);

const MESSAGE =
  /unique constraint|deadlock detected|could not serialize|write conflict|connection (terminated|reset|closed|refused)|ECONNRESET|server (has )?closed the connection|can't reach database|timed out fetching a new connection|unable to start a transaction|transaction already closed|transaction not found/i;

/** True for an error that a retry of the same work is expected to get past. */
export function isTransientError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: unknown; message?: unknown; meta?: { code?: unknown } };
  if (typeof e.code === 'string' && CODES.has(e.code)) return true;
  if (typeof e.meta?.code === 'string' && CODES.has(e.meta.code)) return true;
  return typeof e.message === 'string' && MESSAGE.test(e.message);
}

export const TRANSIENT_ATTEMPTS = 4;

/** Runs `fn`, retrying a transient error up to `attempts` times in all, with a short growing pause. */
export async function withTransientRetry<T>(
  fn: () => Promise<T>,
  opts: {
    attempts?: number;
    baseMs?: number;
    onRetry?: (err: unknown, attempt: number) => void;
  } = {},
): Promise<T> {
  const attempts = opts.attempts ?? TRANSIENT_ATTEMPTS;
  const baseMs = opts.baseMs ?? 120;
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= attempts || !isTransientError(err)) throw err;
      opts.onRetry?.(err, attempt);
      await new Promise((r) =>
        setTimeout(r, baseMs * attempt + Math.floor(Math.random() * baseMs)),
      );
    }
  }
}
