// Request helpers of the tick endpoint, kept out of route.ts because a Next route file may export only handlers.
import { timingSafeEqual } from 'node:crypto';

function same(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

/** `Authorization: Bearer $CRON_SECRET` (Vercel Cron) or `x-cron-secret` (GitHub Actions). RC-027. */
export function isAuthorised(headers: Headers, secret: string | undefined): boolean {
  if (!secret) return false;
  const auth = headers.get('authorization') ?? '';
  if (auth.startsWith('Bearer ') && same(auth.slice(7), secret)) return true;
  const custom = headers.get('x-cron-secret');
  return custom !== null && same(custom, secret);
}

export const DEFAULT_BUDGET_MS = 45_000;
/** Hobby allows 60 s; keep 5 s for the response and the window tick. */
export const MAX_BUDGET_MS = 55_000;

/** Time budget of one call in ms: `?budgetMs=` clamped to 1 s .. 55 s, default 45 s. */
export function budgetFrom(searchParams: URLSearchParams): number {
  const raw = Number(searchParams.get('budgetMs'));
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_BUDGET_MS;
  return Math.min(MAX_BUDGET_MS, Math.max(1_000, Math.round(raw)));
}
