// Fast-forward history mode (docs/gaps/eng-ff.md): a batch writes once instead of once per tick, hourly rows and slices
// are kept for the last days only, and the numbers stay those of the hourly engine.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { fastForward } from '@/lib/engine/server';
import { provisionSandbox } from '@/lib/seed/sandbox';
import { createEnv, dropEnv, fingerprint, rewind, startTick, TODAY, type Env } from './fixtures';

let env: Env;
let id: string;
let start: number;

async function metricsPrint() {
  const f = await fingerprint(id);
  delete f.Alert; // history mode keeps the latest decision of each alert per batch
  return f;
}

beforeAll(async () => {
  env = await createEnv(1, 'history');
  id = env.sandboxIds[0] as string;
  start = await startTick(id);
}, 600_000);

afterAll(async () => {
  await dropEnv(env);
  await prisma.$disconnect();
}, 180_000);

describe('history mode', () => {
  it('writes the same metrics, diagnostics, pacing, reach and state as the per-tick path', async () => {
    await rewind(id, start);
    await fastForward(id, 72);
    const normal = await metricsPrint();

    await rewind(id, start);
    const job = await fastForward(id, 72, { history: { hourlyDays: 14, sliceDays: 14 } });
    expect(job.status).toBe('DONE');
    expect(await metricsPrint()).toEqual(normal);
  }, 300_000);

  it('is independent of the chunking', async () => {
    await rewind(id, start);
    await fastForward(id, 72, { history: { hourlyDays: 14, sliceDays: 14 } });
    const one = await metricsPrint();
    await rewind(id, start);
    for (let i = 0; i < 3; i++)
      await fastForward(id, 24, { history: { hourlyDays: 14, sliceDays: 14 } });
    expect(await metricsPrint()).toEqual(one);
  }, 300_000);

  it('keeps hourly rows and slices for the last days only; day totals do not change', async () => {
    await rewind(id, start);
    await fastForward(id, 72);
    const totals = await prisma.$queryRawUnsafe<unknown[]>(
      `SELECT "lineItemId", "simDate"::text d, impressions::text i, "mediaCost"::text c FROM "SimDailyMetric"
       WHERE "sandboxId" = $1 AND "simDate" >= $2::date AND "sliceKind" = 'total' ORDER BY 1, 2`,
      id,
      TODAY,
    );

    await rewind(id, start);
    await fastForward(id, 72, { history: { hourlyDays: 1, sliceDays: 1 } });
    const after = await prisma.$queryRawUnsafe<unknown[]>(
      `SELECT "lineItemId", "simDate"::text d, impressions::text i, "mediaCost"::text c FROM "SimDailyMetric"
       WHERE "sandboxId" = $1 AND "simDate" >= $2::date AND "sliceKind" = 'total' ORDER BY 1, 2`,
      id,
      TODAY,
    );
    expect(after).toEqual(totals);

    const days = async (table: string, col: string, where = '') =>
      (
        await prisma.$queryRawUnsafe<{ d: string }[]>(
          `SELECT DISTINCT ${col}::date::text d FROM "${table}" WHERE "sandboxId" = $1 AND ${col} >= $2::date ${where} ORDER BY 1`,
          id,
          TODAY,
        )
      ).map((r) => r.d);
    // 72 ticks from 2026-10-28 00:00 UTC cover three UTC days; only the last 24 hours keep hourly rows and slices.
    // Daily rows use the advertiser date (UTC+5:30 here), so the last UTC hours fall on the 31st.
    expect(await days('SimHourlyMetric', '"simHour"')).toEqual(['2026-10-30']);
    expect(await days('SimDailyMetric', '"simDate"', `AND "sliceKind" <> 'total'`)).toEqual([
      '2026-10-30',
      '2026-10-31',
    ]);
    expect(await days('SimDailyMetric', '"simDate"', `AND "sliceKind" = 'total'`)).toEqual([
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
    ]);
  }, 300_000);
});

describe('provisioning with engine days', () => {
  it('builds 90 days of history, is deterministic on rebuild and leaves a READY sandbox', async () => {
    const input = {
      classroomId: env.classroomId,
      ownerUserId: null,
      name: 'Engine history',
      template: 'starter-agency' as const,
      kind: 'DEMO' as const,
      seedValue: 9201,
      partnerName: 'Sandbox EH-1',
      today: TODAY,
      knobs: { engineDays: 14 },
      force: true,
    };
    const first = await provisionSandbox(prisma, input);
    env.sandboxIds.push(first.sandboxId);
    expect(first.backfill).toBe('DONE');
    const sb = await prisma.sandbox.findUniqueOrThrow({ where: { id: first.sandboxId } });
    expect(sb.provisionState).toBe('READY');
    const clock = await prisma.simClock.findUniqueOrThrow({
      where: { sandboxId: first.sandboxId },
    });
    expect(Number(clock.tickIndex)).toBe(90 * 24); // "today" 00:00 as with the stub
    const days = await prisma.$queryRawUnsafe<{ n: number; span: number; hi: string }[]>(
      `SELECT count(DISTINCT "simDate")::int n, (max("simDate") - min("simDate") + 1)::int span, max("simDate")::text hi
       FROM "SimDailyMetric" WHERE "sandboxId" = $1 AND "sliceKind" = 'total'`,
      first.sandboxId,
    );
    expect(days[0]?.hi).toBe('2026-10-28'); // advertiser date: the last UTC hours of the 27th
    // the stub days and the engine days join without a gap
    expect(days[0]?.n).toBe(days[0]?.span);
    expect(days[0]?.n).toBeGreaterThan(14);
    const hourly = await prisma.$queryRawUnsafe<{ lo: string }[]>(
      `SELECT min("simHour")::text lo FROM "SimHourlyMetric" WHERE "sandboxId" = $1`,
      first.sandboxId,
    );
    expect(hourly[0]?.lo.slice(0, 10)).toBe('2026-10-14');
    const jobs = await prisma.simJob.findMany({ where: { sandboxId: first.sandboxId } });
    expect(jobs.map((j) => j.status)).toEqual(['DONE']);

    const a = await fingerprint(first.sandboxId);
    const second = await provisionSandbox(prisma, input);
    expect(second.sandboxId).toBe(first.sandboxId);
    expect(await fingerprint(first.sandboxId)).toEqual(a);
  }, 600_000);

  it('stops at the deadline, stays BACKFILLING and the runtime finishes the job', async () => {
    const r = await provisionSandbox(prisma, {
      classroomId: env.classroomId,
      ownerUserId: null,
      name: 'Engine history chunked',
      template: 'starter-agency',
      kind: 'DEMO',
      seedValue: 9202,
      partnerName: 'Sandbox EH-2',
      today: TODAY,
      knobs: { engineDays: 3 },
      deadlineMs: Date.now() + 1, // spent before the first chunk
    });
    env.sandboxIds.push(r.sandboxId);
    expect(r.backfill).toBe('PENDING');
    expect(
      (await prisma.sandbox.findUniqueOrThrow({ where: { id: r.sandboxId } })).provisionState,
    ).toBe('BACKFILLING');
    const { advanceJobs } = await import('@/lib/engine/server');
    for (let i = 0; i < 5; i++) await advanceJobs(Number.MAX_SAFE_INTEGER);
    expect(
      (await prisma.sandbox.findUniqueOrThrow({ where: { id: r.sandboxId } })).provisionState,
    ).toBe('READY');
    const clock = await prisma.simClock.findUniqueOrThrow({ where: { sandboxId: r.sandboxId } });
    expect(Number(clock.tickIndex)).toBe(90 * 24);
  }, 600_000);
});
