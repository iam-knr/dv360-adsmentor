// P3-08b acceptance: the engine runtime against the database, on seeded starter-agency sandboxes.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma, withBypass, withSandbox } from '@/lib/db';
import { lockClock } from '@/lib/engine/io/locks';
import {
  ensureCaughtUp,
  fastForward,
  getJobProgress,
  pause,
  resetSandbox,
  resume,
  runDueTicks,
  runRetention,
  setSpeed,
  stepTicks,
} from '@/lib/engine/server';
import { createEnv, dropEnv, fingerprint, rewind, startTick, TODAY, type Env } from './fixtures';

const PER = 5 * 2500; // ms per tick at the default 5 minutes per sim day
const T0 = Date.parse('2026-10-29T08:00:00Z');
const FAR = Number.MAX_SAFE_INTEGER;

let env: Env;
let a: string;
let b: string;
let start: number;

/** Metric and state tables compared across runs (alerts are left out: seeded alert rows are not rewound). */
async function metricsPrint(id: string) {
  const f = await fingerprint(id);
  delete f.Alert;
  return f;
}

async function run(id: string, ticks: number, calls: number): Promise<void> {
  await prisma.simClock.update({
    where: { sandboxId: id },
    data: { state: 'RUNNING', lastAdvanceRealAt: new Date(T0), remainderMs: 0 },
  });
  const per = ticks / calls;
  for (let i = 1; i <= calls; i++) {
    await runDueTicks(FAR, { now: T0 + i * per * PER });
  }
}

beforeAll(async () => {
  env = await createEnv(2, 'runtime');
  [a, b] = env.sandboxIds as [string, string];
  start = await startTick(a);
}, 600_000);

afterAll(async () => {
  await dropEnv(env);
  await prisma.$disconnect();
}, 180_000);

describe('a tick', () => {
  it('writes funnel, hourly, daily, pacing and reach rows for the seeded line items', async () => {
    await rewind(a, start);
    await stepTicks(a, 24); // past 23:00 in the advertiser zones, where reach snapshots are written
    const [hourly, daily, diag, pacing, reach, log] = await Promise.all([
      prisma.simHourlyMetric.count({
        where: { sandboxId: a, simHour: { gte: new Date(`${TODAY}T00:00:00Z`) } },
      }),
      prisma.simDailyMetric.count({
        where: { sandboxId: a, simDate: { gte: new Date(`${TODAY}T00:00:00Z`) } },
      }),
      prisma.deliveryDiagnostic.count({
        where: { sandboxId: a, date: { gte: new Date(`${TODAY}T00:00:00Z`) } },
      }),
      prisma.simPacingSnapshot.count({
        where: { sandboxId: a, simDate: { gte: new Date(`${TODAY}T00:00:00Z`) } },
      }),
      prisma.simReachSnapshot.count({
        where: { sandboxId: a, simDate: { gte: new Date(`${TODAY}T00:00:00Z`) } },
      }),
      prisma.simTickLog.count({ where: { sandboxId: a, status: 'OK' } }),
    ]);
    expect(hourly).toBeGreaterThan(0);
    expect(daily).toBeGreaterThan(0);
    expect(diag).toBeGreaterThan(0);
    expect(pacing).toBeGreaterThan(0);
    expect(reach).toBeGreaterThan(0);
    expect(log).toBe(24);
    const clock = await prisma.simClock.findUniqueOrThrow({ where: { sandboxId: a } });
    expect(Number(clock.tickIndex)).toBe(start + 24);
    const imp = await prisma.simDailyMetric.aggregate({
      where: { sandboxId: a, sliceKind: 'total', simDate: { gte: new Date(`${TODAY}T00:00:00Z`) } },
      _sum: { impressions: true },
    });
    expect(Number(imp._sum.impressions)).toBeGreaterThan(0);
  }, 120_000);

  it('M.WON equals impressions before refunds and daily totals equal the hourly sum', async () => {
    const won = await prisma.$queryRaw<{ n: bigint }[]>`
      SELECT coalesce(sum("count"), 0)::bigint AS n FROM "DeliveryDiagnostic"
      WHERE "sandboxId" = ${a} AND "reasonCode" = 'M.WON' AND "date" >= ${TODAY}::date`;
    const imps = await prisma.$queryRaw<{ h: bigint; d: bigint; hc: string; dc: string }[]>`
      SELECT (SELECT coalesce(sum("impressions"), 0) FROM "SimHourlyMetric" WHERE "sandboxId" = ${a} AND "simHour" >= ${TODAY}::date)::bigint AS h,
             (SELECT coalesce(sum("impressions"), 0) FROM "SimDailyMetric" WHERE "sandboxId" = ${a} AND "sliceKind" = 'total' AND "simDate" >= ${TODAY}::date)::bigint AS d,
             (SELECT coalesce(sum("mediaCost"), 0) FROM "SimHourlyMetric" WHERE "sandboxId" = ${a} AND "simHour" >= ${TODAY}::date)::text AS hc,
             (SELECT coalesce(sum("mediaCost"), 0) FROM "SimDailyMetric" WHERE "sandboxId" = ${a} AND "sliceKind" = 'total' AND "simDate" >= ${TODAY}::date)::text AS dc`;
    expect(won[0]!.n).toBe(imps[0]!.h);
    expect(imps[0]!.h).toBe(imps[0]!.d);
    expect(Number(imps[0]!.hc)).toBeCloseTo(Number(imps[0]!.dc), 4);
  });

  it('stores money once in the advertiser currency (RC-025)', async () => {
    const rows = await prisma.$queryRaw<{ cpm: number; currency: string }[]>`
      SELECT (sum(d."mediaCost") / sum(d."impressions") * 1000)::float AS cpm, adv."currencyCode" AS currency
      FROM "SimDailyMetric" d
      JOIN "LineItem" li ON li."id" = d."lineItemId" AND li."sandboxId" = d."sandboxId"
      JOIN "Advertiser" adv ON adv."id" = li."advertiserId" AND adv."sandboxId" = li."sandboxId"
      WHERE d."sandboxId" = ${a} AND d."sliceKind" = 'total' AND d."simDate" >= ${TODAY}::date AND d."impressions" > 0
      GROUP BY adv."currencyCode"`;
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      // a CPM in the advertiser currency: INR 5 to 2,000 or SGD 0.1 to 60; micros or USD would be far outside
      if (r.currency === 'INR') expect(r.cpm).toBeGreaterThan(5);
      expect(r.cpm).toBeLessThan(r.currency === 'INR' ? 2_000 : 400);
      expect(r.cpm).toBeGreaterThan(0);
    }
  });
});

describe('idempotency and catch-up', () => {
  it('re-running an applied tick writes nothing', async () => {
    await rewind(a, start);
    await stepTicks(a, 6);
    const before = await fingerprint(a);
    // Simulate a crash that lost only the clock move: the ledger still holds the six ticks.
    await prisma.simClock.update({ where: { sandboxId: a }, data: { tickIndex: BigInt(start) } });
    const r = await stepTicks(a, 6);
    expect(r.ticks).toBe(6);
    const after = await fingerprint(a);
    expect(after).toEqual(before);
    const clock = await prisma.simClock.findUniqueOrThrow({ where: { sandboxId: a } });
    expect(Number(clock.tickIndex)).toBe(start + 6);
    expect(await prisma.simTickLog.count({ where: { sandboxId: a, status: 'OK' } })).toBe(6);
  }, 120_000);

  it('30 ticks one per call equal 30 ticks in one catch-up call', async () => {
    await rewind(a, start);
    await run(a, 30, 30);
    const live = await metricsPrint(a);
    expect(
      Number((await prisma.simClock.findUniqueOrThrow({ where: { sandboxId: a } })).tickIndex),
    ).toBe(start + 30);
    await rewind(a, start);
    await run(a, 30, 1);
    const catchUp = await metricsPrint(a);
    expect(
      Number((await prisma.simClock.findUniqueOrThrow({ where: { sandboxId: a } })).tickIndex),
    ).toBe(start + 30);
    expect(catchUp).toEqual(live);
    expect(live.SimHourlyMetric).not.toMatch(/^0:/);
  }, 300_000);

  it('another sandbox in the same run does not change this sandbox (isolation)', async () => {
    await rewind(a, start);
    await rewind(b, await startTick(b));
    await run(a, 12, 1);
    const alone = await metricsPrint(a);
    await rewind(a, start);
    await prisma.simClock.update({
      where: { sandboxId: b },
      data: { state: 'RUNNING', lastAdvanceRealAt: new Date(T0), remainderMs: 0 },
    });
    await prisma.simClock.update({
      where: { sandboxId: a },
      data: { state: 'RUNNING', lastAdvanceRealAt: new Date(T0), remainderMs: 0 },
    });
    await runDueTicks(FAR, { now: T0 + 12 * PER });
    const together = await metricsPrint(a);
    expect(together).toEqual(alone);
    const bRows = await prisma.simHourlyMetric.count({
      where: { sandboxId: b, simHour: { gte: new Date(`${TODAY}T00:00:00Z`) } },
    });
    expect(bRows).toBeGreaterThan(0);
    // every row of A belongs to a line item of A, and RLS hides A from B
    const stray = await prisma.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n FROM "SimHourlyMetric" h
      JOIN "LineItem" li ON li."id" = h."lineItemId" WHERE h."sandboxId" = ${a} AND li."sandboxId" <> ${a}`;
    expect(stray[0]!.n).toBe(0);
    const seen = await withSandbox(b, (tx) =>
      tx.simHourlyMetric.count({ where: { sandboxId: a } }),
    );
    expect(seen).toBe(0);
  }, 300_000);
});

describe('locks', () => {
  it('two concurrent runDueTicks never process the same sandbox tick twice', async () => {
    await rewind(a, start);
    await prisma.simClock.update({
      where: { sandboxId: a },
      data: { state: 'RUNNING', lastAdvanceRealAt: new Date(T0), remainderMs: 0 },
    });
    // keep b out of the picture
    await prisma.simClock.update({ where: { sandboxId: b }, data: { state: 'PAUSED' } });
    const [x, y] = await Promise.all([
      runDueTicks(FAR, { now: T0 + 10 * PER }),
      runDueTicks(FAR, { now: T0 + 10 * PER }),
    ]);
    expect(x.ticks + y.ticks).toBe(10);
    expect(await prisma.simTickLog.count({ where: { sandboxId: a, status: 'OK' } })).toBe(10);
    const clock = await prisma.simClock.findUniqueOrThrow({ where: { sandboxId: a } });
    expect(Number(clock.tickIndex)).toBe(start + 10);
  }, 120_000);

  it('a sandbox whose clock is locked by another transaction is skipped, not waited for', async () => {
    await rewind(a, start);
    await prisma.simClock.update({
      where: { sandboxId: a },
      data: { state: 'RUNNING', lastAdvanceRealAt: new Date(T0), remainderMs: 0 },
    });
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    let held!: () => void;
    const holding = new Promise<void>((r) => (held = r));
    const holder = withBypass(async (tx) => {
      expect(await lockClock(tx, a)).not.toBeNull();
      held();
      await gate;
    });
    await holding;
    const t = Date.now();
    const r = await runDueTicks(FAR, { now: T0 + 3 * PER });
    expect(Date.now() - t).toBeLessThan(5_000);
    expect(r.ticks).toBe(0);
    expect(r.busy).toBe(1);
    expect(await ensureCaughtUp(a, { now: T0 + 3 * PER })).toEqual({ ticks: 0 });
    release();
    await holder;
    const after = await runDueTicks(FAR, { now: T0 + 3 * PER });
    expect(after.ticks).toBe(3);
  }, 120_000);

  it('one call advances at most 25 sandboxes and reports how many are still due', async () => {
    const ids: string[] = [];
    const t0 = new Date(T0);
    for (let i = 0; i < 26; i++) {
      const sb = await prisma.sandbox.create({
        data: {
          classroomId: env.classroomId,
          name: `cap-${i}`,
          kind: 'DEMO',
          seedValue: 1,
          provisionState: 'READY',
        },
      });
      await prisma.simClock.create({
        data: {
          sandboxId: sb.id,
          simStart: new Date('2026-07-30T00:00:00Z'),
          tickIndex: 0n,
          state: 'RUNNING',
          marketSeed: 'm',
          sandboxSeed: 's',
          lastAdvanceRealAt: t0,
        },
      });
      ids.push(sb.id);
    }
    await prisma.simClock.update({ where: { sandboxId: a }, data: { state: 'PAUSED' } });
    const first = await runDueTicks(FAR, { now: T0 + PER });
    expect(first.processed).toBe(25);
    expect(first.stillDue).toBe(1);
    const second = await runDueTicks(FAR, { now: T0 + PER });
    expect(second.processed).toBe(1);
    expect(second.stillDue).toBe(0);
    // a call whose budget is already spent starts nothing
    const late = await runDueTicks(Date.now() - 1, { now: T0 + 2 * PER });
    expect(late.processed).toBe(0);
    expect(late.stillDue).toBe(26);
    await prisma.sandbox.deleteMany({ where: { id: { in: ids } } });
  }, 180_000);
});

describe('frozen sandboxes', () => {
  it('receive no ticks while frozen and resume without a jump', async () => {
    await rewind(a, start);
    await prisma.simClock.update({
      where: { sandboxId: a },
      data: { state: 'RUNNING', lastAdvanceRealAt: new Date(T0), remainderMs: 0 },
    });
    // what lib/access/windows.ts does when a class window closes
    await prisma.sandbox.update({
      where: { id: a },
      data: {
        status: 'FROZEN',
        frozenAt: new Date(T0),
        frozenReason: 'WINDOW',
        clockStateBeforeFreeze: 'RUNNING',
      },
    });
    await prisma.simClock.update({ where: { sandboxId: a }, data: { state: 'PAUSED' } });
    const frozen = await runDueTicks(FAR, { now: T0 + 40 * PER });
    expect(frozen.ticks).toBe(0);
    expect(
      Number((await prisma.simClock.findUniqueOrThrow({ where: { sandboxId: a } })).tickIndex),
    ).toBe(start);
    // even a RUNNING clock on a frozen sandbox is not listed
    await prisma.simClock.update({ where: { sandboxId: a }, data: { state: 'RUNNING' } });
    expect((await runDueTicks(FAR, { now: T0 + 40 * PER })).ticks).toBe(0);
    // unfreeze: the gap is not owed
    const back = T0 + 40 * PER;
    await prisma.sandbox.update({
      where: { id: a },
      data: { status: 'ACTIVE', frozenAt: null, frozenReason: null, clockStateBeforeFreeze: null },
    });
    await prisma.simClock.update({
      where: { sandboxId: a },
      data: { state: 'RUNNING', lastAdvanceRealAt: new Date(back), remainderMs: 0 },
    });
    const resumed = await runDueTicks(FAR, { now: back + 2 * PER });
    expect(resumed.ticks).toBe(2);
    expect(
      Number((await prisma.simClock.findUniqueOrThrow({ where: { sandboxId: a } })).tickIndex),
    ).toBe(start + 2);
  }, 120_000);
});

describe('fast-forward', () => {
  it('runs 7 sim days, reports progress and leaves the clock paused', async () => {
    await rewind(a, start);
    const seen = new Set<number>();
    let jobId: string | undefined;
    let stop = false;
    const poll = (async () => {
      while (!stop) {
        const j = await prisma.simJob.findFirst({
          where: { sandboxId: a, kind: 'FAST_FORWARD' },
          orderBy: { createdAt: 'desc' },
        });
        if (j) jobId = j.id;
        const p = j?.progress as { doneTicks?: number } | null;
        if (p?.doneTicks) seen.add(p.doneTicks);
        await new Promise((r) => setTimeout(r, 100));
      }
    })();
    const job = await fastForward(a, 168);
    stop = true;
    await poll;
    expect(job.status).toBe('DONE');
    expect(job.progress?.doneTicks).toBe(168);
    expect(job.progress?.totalTicks).toBe(168);
    expect(job.progress?.simDate).toBe('2026-11-03');
    expect([...seen].length).toBeGreaterThan(1);
    expect((await getJobProgress(job.id))?.status).toBe('DONE');
    expect(jobId).toBe(job.id);
    const clock = await prisma.simClock.findUniqueOrThrow({ where: { sandboxId: a } });
    expect(Number(clock.tickIndex)).toBe(start + 168);
    expect(clock.state).toBe('PAUSED');
    const days = await prisma.$queryRaw<{ n: number }[]>`
      SELECT count(DISTINCT "simDate")::int AS n FROM "SimDailyMetric" WHERE "sandboxId" = ${a} AND "simDate" >= ${TODAY}::date`;
    // 168 UTC hours touch 7 or 8 advertiser-local dates (IST and SGT days start before the UTC day)
    expect(days[0]!.n).toBeGreaterThanOrEqual(7);
    expect(days[0]!.n).toBeLessThanOrEqual(8);
  }, 600_000);

  it('stops early when NO_SPEND_LI opens', async () => {
    await rewind(a, start);
    const li = await prisma.lineItem.findFirstOrThrow({
      where: {
        sandboxId: a,
        status: 'ACTIVE',
        io: { status: 'ACTIVE', campaign: { status: 'ACTIVE' } },
      },
      orderBy: { id: 'asc' },
    });
    const saved = await prisma.creativeAssignment.findMany({ where: { lineItemId: li.id } });
    await prisma.creativeAssignment.deleteMany({ where: { lineItemId: li.id } });
    try {
      const job = await fastForward(a, 168, { untilAlert: 'NO_SPEND_LI' });
      expect(job.status).toBe('DONE');
      expect(job.progress?.stoppedBy).toBe('alert:NO_SPEND_LI');
      expect(job.progress!.doneTicks).toBeLessThan(168);
      const open = await prisma.alert.count({
        where: { sandboxId: a, diagnosticCode: 'NO_SPEND_LI', state: 'OPEN' },
      });
      expect(open).toBeGreaterThan(0);
    } finally {
      await prisma.creativeAssignment.createMany({ data: saved });
    }
  }, 600_000);
});

describe('reset and clock controls', () => {
  it('resetSandbox deletes simulation rows and returns the clock to tick 0, paused', async () => {
    await rewind(a, start);
    await stepTicks(a, 3);
    const job = await resetSandbox(a);
    expect(job.status).toBe('DONE');
    for (const table of [
      'SimHourlyMetric',
      'SimDailyMetric',
      'DeliveryDiagnostic',
      'SimState',
      'SimTickLog',
      'Alert',
    ]) {
      const n = await prisma.$queryRawUnsafe<{ n: number }[]>(
        `SELECT count(*)::int AS n FROM "${table}" WHERE "sandboxId" = $1`,
        a,
      );
      expect(n[0]!.n, table).toBe(0);
    }
    const clock = await prisma.simClock.findUniqueOrThrow({ where: { sandboxId: a } });
    expect(Number(clock.tickIndex)).toBe(0);
    expect(clock.state).toBe('PAUSED');
    expect(
      (await prisma.sandbox.findUniqueOrThrow({ where: { id: a } })).resetCount,
    ).toBeGreaterThan(0);
    // the sandbox is still usable: its entities are intact
    expect(await prisma.lineItem.count({ where: { sandboxId: a } })).toBeGreaterThan(0);
    await rewind(a, start); // history is gone after a reset; later tests are done with a
  }, 300_000);

  it('setSpeed, pause, resume and stepTicks follow engine.md 1.2', async () => {
    await expect(setSpeed(b, 1)).rejects.toThrow(/not allowed/);
    await setSpeed(b, 10);
    expect(
      (await prisma.simClock.findUniqueOrThrow({ where: { sandboxId: b } })).minutesPerSimDay,
    ).toBe(10);
    await resume(b, T0);
    const running = await prisma.simClock.findUniqueOrThrow({ where: { sandboxId: b } });
    expect(running.state).toBe('RUNNING');
    expect(running.lastAdvanceRealAt?.getTime()).toBe(T0);
    await expect(stepTicks(b, 1)).rejects.toThrow(/paused/);
    await pause(b);
    expect((await prisma.simClock.findUniqueOrThrow({ where: { sandboxId: b } })).state).toBe(
      'PAUSED',
    );
    const before = Number(
      (await prisma.simClock.findUniqueOrThrow({ where: { sandboxId: b } })).tickIndex,
    );
    expect((await stepTicks(b, 2)).ticks).toBe(2);
    const after = await prisma.simClock.findUniqueOrThrow({ where: { sandboxId: b } });
    expect(Number(after.tickIndex)).toBe(before + 2);
    expect(after.state).toBe('PAUSED');
    await expect(stepTicks(b, 0)).rejects.toThrow();
  }, 120_000);
});

describe('retention and structural edits', () => {
  it('trims hourly rows older than 14 sim days and keeps daily rows', async () => {
    const id = a;
    const li = await prisma.lineItem.findFirstOrThrow({
      where: { sandboxId: id },
      orderBy: { id: 'asc' },
    });
    await rewind(id, start);
    await stepTicks(id, 1);
    const simNow = Date.parse(`${TODAY}T00:00:00Z`) + 1 * 3_600_000;
    const old = new Date(simNow - 15 * 86_400_000);
    const recent = new Date(simNow - 13 * 86_400_000);
    await prisma.simHourlyMetric.deleteMany({
      where: { lineItemId: li.id, simHour: { in: [old, recent] } },
    });
    await prisma.simHourlyMetric.createMany({
      data: [old, recent].map((simHour) => ({
        sandboxId: id,
        lineItemId: li.id,
        simHour,
        impressions: 7n,
      })),
    });
    const days = await prisma.simDailyMetric.count({ where: { sandboxId: id } });
    await runRetention();
    expect(await prisma.simHourlyMetric.count({ where: { lineItemId: li.id, simHour: old } })).toBe(
      0,
    );
    expect(
      await prisma.simHourlyMetric.count({ where: { lineItemId: li.id, simHour: recent } }),
    ).toBe(1);
    expect(await prisma.simDailyMetric.count({ where: { sandboxId: id } })).toBe(days);
  }, 120_000);

  it('decides a due exchange review through the change log (CREATIVE_APPROVAL_SYNC, source ENGINE)', async () => {
    await rewind(a, start);
    const review = await prisma.creativeReview.findFirstOrThrow({
      where: { sandboxId: a },
      orderBy: { id: 'asc' },
    });
    await prisma.creativeReview.update({
      where: { id: review.id },
      data: { status: 'PENDING', decideAt: new Date(`${TODAY}T00:00:00Z`) },
    });
    await stepTicks(a, 1);
    const after = await prisma.creativeReview.findUniqueOrThrow({ where: { id: review.id } });
    expect(['APPROVED', 'DISAPPROVED']).toContain(after.status);
    const group = await prisma.changeGroup.findFirstOrThrow({
      where: { sandboxId: a, entityId: review.creativeId, systemActor: 'CREATIVE_APPROVAL_SYNC' },
      include: { entries: true },
    });
    expect(group.source).toBe('ENGINE');
    expect(group.actorType).toBe('SYSTEM');
    expect(group.entries.length).toBe(1);
    expect(group.entries[0]!.oldValue).toBe('PENDING');
    expect(group.entries[0]!.newValue).toBe(after.status);
  }, 120_000);
});
