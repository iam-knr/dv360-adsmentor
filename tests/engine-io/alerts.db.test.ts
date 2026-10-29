// Alert persistence (engine.md 3.7, RC-013): open, resolve after two clear ticks, suppressed when the preference is off.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma, withBypass } from '@/lib/db';
import { defaultParams } from '@/lib/engine/params/load';
import { emptyOutput } from '@/lib/engine/output';
import { loadClock, loadWorlds } from '@/lib/engine/io/loadWorld';
import { persistTick } from '@/lib/engine/io/persistTick';
import { stepTicks } from '@/lib/engine/server';
import { reconcileAlerts, type ActiveAlert, type AlertDecision } from '@/lib/engine/diagnostics';
import { createEnv, dropEnv, rewind, startTick, TODAY, type Env } from './fixtures';

let env: Env;
let a: string;
let start: number;

const decision = (
  action: 'RAISE' | 'RESOLVE',
  code: AlertDecision['code'],
  scope: { kind: AlertDecision['scopeKind']; id: string },
): AlertDecision => ({
  action,
  code,
  scopeKind: scope.kind,
  scopeId: scope.id,
  severity: 'CRITICAL',
  params: { N: 1 },
  raisedAtTick: 1,
  ...(action === 'RESOLVE' ? { resolvedAtTick: 5 } : {}),
});

async function persist(decisions: AlertDecision[], advIndex = 0) {
  return withBypass(async (tx) => {
    const clock = (await loadClock(tx, a))!;
    const world = await loadWorlds(tx, clock, defaultParams());
    const adv = world.worlds[advIndex]!;
    const out = {
      ...emptyOutput(1, true, Date.parse(`${TODAY}T06:00:00Z`), TODAY, 6),
      alerts: decisions,
    };
    return {
      adv,
      result: await persistTick(tx, { sandboxId: a, classroomId: clock.classroomId, adv }, out),
    };
  });
}

/** The advertiser `persist` loads (worlds[0]). Entities picked for a decision must belong to it, or the scope ids are not resolved. */
async function worldAdvertiserId(): Promise<string> {
  return withBypass(async (tx) => {
    const clock = (await loadClock(tx, a))!;
    return (await loadWorlds(tx, clock, defaultParams())).worlds[0]!.advertiserId;
  });
}

beforeAll(async () => {
  env = await createEnv(1, 'alerts');
  a = env.sandboxIds[0]!;
  start = await startTick(a);
}, 300_000);

afterAll(async () => {
  await dropEnv(env);
  await prisma.$disconnect();
}, 120_000);

describe('persistTick alerts', () => {
  it('opens an alert once, refreshes it on a repeat, and resolves it', async () => {
    const li = await prisma.lineItem.findFirstOrThrow({
      where: { sandboxId: a, advertiserId: await worldAdvertiserId() },
      orderBy: { id: 'desc' },
    });
    await prisma.alert.deleteMany({ where: { sandboxId: a, lineItemId: li.id } });
    const raise = decision('RAISE', 'NO_SPEND_LI', { kind: 'LINE_ITEM', id: li.id });
    const first = await persist([raise]);
    expect(first.result.raised).toEqual(['NO_SPEND_LI']);
    await persist([raise]);
    const rows = await prisma.alert.findMany({ where: { sandboxId: a, lineItemId: li.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      type: 'NO_SPEND',
      category: 'BUDGET',
      diagnosticCode: 'NO_SPEND_LI',
      severity: 'CRITICAL',
      state: 'OPEN',
      ioId: li.ioId,
      campaignId: li.campaignId,
      advertiserId: li.advertiserId,
    });
    await persist([decision('RESOLVE', 'NO_SPEND_LI', { kind: 'LINE_ITEM', id: li.id })]);
    const after = await prisma.alert.findUniqueOrThrow({ where: { id: rows[0]!.id } });
    expect(after.state).toBe('RESOLVED');
    expect(after.resolvedAt).not.toBeNull();
  });

  it('resolves only after the condition has been clear for two consecutive ticks', async () => {
    const li = await prisma.lineItem.findFirstOrThrow({
      where: { sandboxId: a, advertiserId: await worldAdvertiserId() },
      orderBy: { id: 'asc' },
    });
    await prisma.alert.deleteMany({ where: { sandboxId: a, lineItemId: li.id } });
    const active: ActiveAlert = {
      code: 'NO_SPEND_LI',
      scopeKind: 'LINE_ITEM',
      scopeId: li.id,
      severity: 'CRITICAL',
      params: { N: 1 },
    };
    const state = async (): Promise<string | undefined> =>
      (await prisma.alert.findFirst({ where: { sandboxId: a, lineItemId: li.id } }))?.state;
    let trackers = {};
    const tick = async (n: number, list: ActiveAlert[]) => {
      const r = reconcileAlerts(trackers, list, n, 2);
      trackers = r.next;
      await persist(r.decisions);
    };
    await tick(1, [active]);
    expect(await state()).toBe('OPEN');
    await tick(2, []);
    expect(await state()).toBe('OPEN'); // one clear tick is not enough
    await tick(3, [active]);
    await tick(4, []);
    await tick(5, []);
    expect(await state()).toBe('RESOLVED'); // the second consecutive clear tick resolves it
  });

  it('never creates an alert whose preference is off', async () => {
    const io = await prisma.insertionOrder.findFirstOrThrow({
      where: { sandboxId: a, advertiserId: await worldAdvertiserId() },
      orderBy: { id: 'asc' },
    });
    await prisma.alert.deleteMany({
      where: { sandboxId: a, ioId: io.id, diagnosticCode: 'UNDERPACING_IO' },
    });
    await prisma.advertiserAlertPreference.upsert({
      where: {
        advertiserId_alertType: { advertiserId: io.advertiserId, alertType: 'UNDERPACING' },
      },
      create: {
        sandboxId: a,
        advertiserId: io.advertiserId,
        alertType: 'UNDERPACING',
        enabled: false,
      },
      update: { enabled: false },
    });
    const clockWorlds = await withBypass(async (tx) =>
      loadWorlds(tx, (await loadClock(tx, a))!, defaultParams()),
    );
    const idx = clockWorlds.worlds.findIndex((w) => w.advertiserId === io.advertiserId);
    expect(clockWorlds.worlds[idx]!.world.advertiser.alertPrefs.enabled?.UNDERPACING_IO).toBe(
      false,
    );
    const r = await persist(
      [decision('RAISE', 'UNDERPACING_IO', { kind: 'INSERTION_ORDER', id: io.id })],
      idx,
    );
    expect(r.result.raised).toEqual([]);
    expect(
      await prisma.alert.count({
        where: { sandboxId: a, ioId: io.id, diagnosticCode: 'UNDERPACING_IO' },
      }),
    ).toBe(0);
    await prisma.advertiserAlertPreference.update({
      where: {
        advertiserId_alertType: { advertiserId: io.advertiserId, alertType: 'UNDERPACING' },
      },
      data: { enabled: true },
    });
    const on = await persist(
      [decision('RAISE', 'UNDERPACING_IO', { kind: 'INSERTION_ORDER', id: io.id })],
      idx,
    );
    expect(on.result.raised).toEqual(['UNDERPACING_IO']);
  });
});

describe('alerts over a run', () => {
  async function pickLi() {
    await rewind(a, start);
    await stepTicks(a, 24);
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT d."lineItemId" AS id FROM "SimDailyMetric" d
      WHERE d."sandboxId" = ${a} AND d."sliceKind" = 'total' AND d."simDate" >= ${TODAY}::date
      GROUP BY d."lineItemId" ORDER BY sum(d."impressions") DESC LIMIT 1`;
    await rewind(a, start);
    return rows[0]!.id;
  }

  it('opens when a line item stops spending and resolves once spend returns', async () => {
    const liId = await pickLi();
    const saved = await prisma.creativeAssignment.findMany({ where: { lineItemId: liId } });
    await prisma.alert.deleteMany({
      where: { sandboxId: a, lineItemId: liId, diagnosticCode: 'NO_SPEND_LI' },
    });
    await prisma.creativeAssignment.deleteMany({ where: { lineItemId: liId } });
    const find = () =>
      prisma.alert.findFirst({
        where: { sandboxId: a, lineItemId: liId, diagnosticCode: 'NO_SPEND_LI' },
        orderBy: { firstSeenAt: 'desc' },
      });
    let opened = false;
    for (let i = 0; i < 8 && !opened; i++) {
      await stepTicks(a, 12);
      opened = (await find())?.state === 'OPEN';
    }
    expect(opened).toBe(true);
    await prisma.creativeAssignment.createMany({ data: saved });
    let resolved = false;
    for (let i = 0; i < 12 && !resolved; i++) {
      await stepTicks(a, 1);
      resolved = (await find())?.state === 'RESOLVED';
    }
    expect(resolved).toBe(true);
    const alert = (await find())!;
    expect(alert.resolvedAt!.getTime()).toBeGreaterThan(alert.firstSeenAt.getTime());
  }, 600_000);

  it('creates no NO_SPEND alert for an advertiser that switched the preference off', async () => {
    const liId = await pickLi();
    const li = await prisma.lineItem.findUniqueOrThrow({ where: { id: liId } });
    await prisma.advertiserAlertPreference.upsert({
      where: { advertiserId_alertType: { advertiserId: li.advertiserId, alertType: 'NO_SPEND' } },
      create: {
        sandboxId: a,
        advertiserId: li.advertiserId,
        alertType: 'NO_SPEND',
        enabled: false,
      },
      update: { enabled: false },
    });
    const saved = await prisma.creativeAssignment.findMany({ where: { lineItemId: liId } });
    await prisma.creativeAssignment.deleteMany({ where: { lineItemId: liId } });
    await prisma.alert.deleteMany({
      where: {
        sandboxId: a,
        advertiserId: li.advertiserId,
        diagnosticCode: { in: ['NO_SPEND_LI', 'NO_SPEND_IO'] },
      },
    });
    try {
      for (let i = 0; i < 4; i++) await stepTicks(a, 12);
      const n = await prisma.alert.count({
        where: {
          sandboxId: a,
          advertiserId: li.advertiserId,
          diagnosticCode: { in: ['NO_SPEND_LI', 'NO_SPEND_IO'] },
        },
      });
      expect(n).toBe(0);
    } finally {
      await prisma.creativeAssignment.createMany({ data: saved });
    }
  }, 600_000);
});
