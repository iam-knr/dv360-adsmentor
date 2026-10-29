// The tick endpoint: authentication, time budget, and that a wrong secret never reaches the engine.
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { POST, maxDuration } from '@/app/api/sim/engine/tick/route';
import {
  budgetFrom,
  DEFAULT_BUDGET_MS,
  isAuthorised,
  MAX_BUDGET_MS,
} from '@/app/api/sim/engine/tick/auth';

const SECRET = 'test-cron-secret-123';
const call = (headers: Record<string, string>, query = '') =>
  POST(
    new NextRequest(`http://localhost/api/sim/engine/tick${query}`, { method: 'POST', headers }),
  );

describe('tick endpoint authentication', () => {
  const saved = process.env.CRON_SECRET;
  beforeEach(() => {
    process.env.CRON_SECRET = SECRET;
  });
  afterEach(() => {
    if (saved === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = saved;
  });

  it('accepts the bearer secret and the x-cron-secret header', () => {
    expect(isAuthorised(new Headers({ authorization: `Bearer ${SECRET}` }), SECRET)).toBe(true);
    expect(isAuthorised(new Headers({ 'x-cron-secret': SECRET }), SECRET)).toBe(true);
  });

  it('rejects wrong, partial, empty and missing secrets', () => {
    const bad: Record<string, string>[] = [
      { authorization: 'Bearer wrong' },
      { authorization: SECRET },
      { authorization: `Bearer ${SECRET}x` },
      { authorization: 'Bearer ' },
      { 'x-cron-secret': 'wrong' },
      { 'x-cron-secret': '' },
      {},
    ];
    for (const h of bad) {
      expect(isAuthorised(new Headers(h), SECRET), JSON.stringify(h)).toBe(false);
    }
  });

  it('rejects everything when CRON_SECRET is not configured', () => {
    expect(isAuthorised(new Headers({ authorization: 'Bearer ' }), undefined)).toBe(false);
    expect(isAuthorised(new Headers({ 'x-cron-secret': '' }), '')).toBe(false);
  });

  it('answers 401 for a wrong or missing secret', async () => {
    const wrong: Record<string, string>[] = [
      {},
      { authorization: 'Bearer nope' },
      { 'x-cron-secret': 'nope' },
    ];
    for (const h of wrong) {
      const res = await call(h);
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: 'UNAUTHENTICATED' });
    }
  });

  it('answers 401 when no secret is configured, even with a header', async () => {
    delete process.env.CRON_SECRET;
    expect((await call({ authorization: 'Bearer anything' })).status).toBe(401);
  });

  it('runs with either header and reports the counts', async () => {
    for (const h of [{ authorization: `Bearer ${SECRET}` }, { 'x-cron-secret': SECRET }] as Record<
      string,
      string
    >[]) {
      const res = await call(h, '?budgetMs=2000');
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body).toMatchObject({ ok: true });
      for (const k of [
        'processed',
        'ticks',
        'failed',
        'busy',
        'stillDue',
        'windows',
        'elapsedMs',
      ]) {
        expect(body, k).toHaveProperty(k);
      }
    }
  });

  it('declares the Hobby maximum duration', () => {
    expect(maxDuration).toBe(60);
  });
});

describe('time budget', () => {
  const q = (s: string) => new URLSearchParams(s);
  it('defaults to 45 seconds', () => {
    expect(budgetFrom(q(''))).toBe(DEFAULT_BUDGET_MS);
    expect(DEFAULT_BUDGET_MS).toBe(45_000);
  });
  it('clamps a requested budget between 1 s and 55 s', () => {
    expect(budgetFrom(q('budgetMs=10000'))).toBe(10_000);
    expect(budgetFrom(q('budgetMs=5'))).toBe(1_000);
    expect(budgetFrom(q('budgetMs=999999'))).toBe(MAX_BUDGET_MS);
    expect(budgetFrom(q('budgetMs=abc'))).toBe(DEFAULT_BUDGET_MS);
    expect(budgetFrom(q('budgetMs=-4'))).toBe(DEFAULT_BUDGET_MS);
    expect(MAX_BUDGET_MS).toBeLessThan(60_000);
  });
});
