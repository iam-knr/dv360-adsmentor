// SIM-CLOCK-RUNS (docs/gaps/sim-clock-runs.md): a student sandbox ends its build with the clock RUNNING, existing paused
// sandboxes are resumed once (a Super admin pause sticks), the timer only works for recently active students, and what a
// student builds delivers for BOTH advertisers.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SessionUser } from '@/lib/auth/types';
import { prisma } from '@/lib/db';
import { setSandboxClockRunning } from '@/lib/accounts/service';
import { newCampaignValue } from '@/lib/campaigns/wire';
import { createCampaign } from '@/lib/campaigns/service';
import { ensureCaughtUp, MAX_OWED_TICKS, runDueTicks } from '@/lib/engine/server';
import { createCreative } from '@/lib/creatives/service';
import { createInsertionOrder } from '@/lib/insertion-orders/service';
import { newIoValue } from '@/lib/insertion-orders/wire';
import {
  assignCreatives,
  createLineItem,
  getDraftInit,
  listLineItems,
  setLineItemStatus,
} from '@/lib/line-items/service';
import {
  ACTIVE_WINDOW_MS,
  AUTOSTART_ENV,
  DEFAULT_MINUTES_PER_SIM_DAY,
  RESUME_DONE_KEY,
  SPEED_META_KEY,
  adminPauseSandbox,
  adminResumeSandbox,
  getSandboxSpeed,
  isAdminPaused,
  parseMinutesPerSimDay,
  resumeExistingSandboxes,
  startSandboxClock,
} from '@/lib/sandbox/clock-run';
import { getSandboxClockView } from '@/lib/sandbox/clock-view';
import {
  getProvisionView,
  enqueueProvisionSandbox,
  runProvisionStep,
} from '@/lib/sandbox/provision';
import { partnerIdOf } from '@/lib/seed/sandbox';
import { seedReferenceData } from '@/lib/seed/reference-db';
import { clearSandboxData } from '@/lib/seed/write';
import { tpDisplay } from '../creatives/helpers';
import { cleanup, createAccount, createClassroom, uniq } from '../auth/fixtures';

const userIds: string[] = [];
const classroomIds: string[] = [];
const sandboxIds: string[] = [];
let adminId: string;
let classroomId: string;
let student: { userId: string; sandboxId: string };

const PER_TICK_MS = (DEFAULT_MINUTES_PER_SIM_DAY * 60_000) / 24;

async function newStudent(tag: string) {
  const { user } = await createAccount(prisma, { tag, role: 'USER', cohortId: classroomId });
  await prisma.classroomMember.create({ data: { classroomId, userId: user.id } });
  userIds.push(user.id);
  const sandboxId = (await enqueueProvisionSandbox(classroomId, user.id)).sandboxId as string;
  sandboxIds.push(sandboxId);
  for (let i = 0; i < 12; i++) {
    const v = await runProvisionStep(sandboxId);
    if (v.state === 'READY' || v.state === 'FAILED') break;
  }
  return { userId: user.id, sandboxId };
}

const clockOf = (id: string) => prisma.simClock.findUniqueOrThrow({ where: { sandboxId: id } });

beforeAll(async () => {
  process.env.SANDBOX_ENGINE_DAYS = '3';
  delete process.env[AUTOSTART_ENV];
  await seedReferenceData(prisma);
  const a = await createAccount(prisma, { tag: uniq('scr-admin'), role: 'SUPER_ADMIN' });
  userIds.push(a.user.id);
  adminId = a.user.id;
  classroomId = (await createClassroom(prisma, { tag: 'scr', ownerAdminId: a.user.id })).id;
  classroomIds.push(classroomId);
  await prisma.classroom.update({
    where: { id: classroomId },
    data: { defaultSeedTemplate: 'starter-agency' },
  });
  student = await newStudent(uniq('scr-st'));
}, 600_000);

afterAll(async () => {
  await prisma.appMeta.deleteMany({ where: { key: { startsWith: 'sandbox-clock:' } } });
  await prisma.appMeta.deleteMany({ where: { key: SPEED_META_KEY } });
  for (const id of sandboxIds) {
    await prisma
      .$transaction((tx) => clearSandboxData(tx, id), { timeout: 120_000 })
      .catch(() => undefined);
    await prisma.$executeRawUnsafe(`DELETE FROM "SimJob" WHERE "sandboxId" = $1`, id);
    await prisma.$executeRawUnsafe(`DELETE FROM "SimTickLog" WHERE "sandboxId" = $1`, id);
  }
  await cleanup(prisma, { userIds, classroomIds });
  await prisma.$disconnect();
}, 180_000);

describe('speed setting', () => {
  it('validates: whole minutes, not faster than the tick cap, not slower than real time', () => {
    expect(parseMinutesPerSimDay('10')).toBe(10);
    expect(parseMinutesPerSimDay(2)).toBe(2);
    expect(parseMinutesPerSimDay(1)).toBeNull(); // 24 ticks a minute: over the cap
    expect(parseMinutesPerSimDay(0)).toBeNull();
    expect(parseMinutesPerSimDay(1.5)).toBeNull();
    expect(parseMinutesPerSimDay('fast')).toBeNull();
    expect(parseMinutesPerSimDay(1441)).toBeNull();
    expect(parseMinutesPerSimDay('')).toBeNull();
  });

  it('is the default 10, an env value, or a setting that wins; an invalid value falls back', async () => {
    expect(await getSandboxSpeed(prisma, {})).toMatchObject({
      minutesPerSimDay: 10,
      source: 'default',
      speedX: 144,
    });
    expect(await getSandboxSpeed(prisma, { SANDBOX_SIM_MINUTES_PER_DAY: '30' })).toMatchObject({
      minutesPerSimDay: 30,
      source: 'env',
      speedX: 48,
    });
    expect(await getSandboxSpeed(prisma, { SANDBOX_SIM_MINUTES_PER_DAY: '0' })).toMatchObject({
      source: 'default',
    });
    await prisma.appMeta.upsert({
      where: { key: SPEED_META_KEY },
      create: { key: SPEED_META_KEY, value: '5' },
      update: { value: '5' },
    });
    expect(await getSandboxSpeed(prisma, { SANDBOX_SIM_MINUTES_PER_DAY: '30' })).toMatchObject({
      minutesPerSimDay: 5,
      source: 'setting',
    });
    await prisma.appMeta.update({ where: { key: SPEED_META_KEY }, data: { value: 'abc' } });
    expect(await getSandboxSpeed(prisma, {})).toMatchObject({ source: 'default' });
    await prisma.appMeta.delete({ where: { key: SPEED_META_KEY } });
  });
});

describe('a new sandbox', () => {
  it('reaches READY with the clock RUNNING at 1 sim day per 10 minutes and no catch-up debt', async () => {
    expect((await getProvisionView(student.userId)).state).toBe('READY');
    const c = await clockOf(student.sandboxId);
    expect(c.state).toBe('RUNNING');
    expect(c.minutesPerSimDay).toBe(10);
    expect(c.remainderMs).toBe(0);
    expect(Date.now() - (c.lastAdvanceRealAt as Date).getTime()).toBeLessThan(5 * 60_000);
    expect(Number(c.tickIndex)).toBe(2160); // the 90 day history
    const v = await getSandboxClockView(student.userId);
    expect(v).toMatchObject({ state: 'RUNNING', speedX: 144, pausedByAdmin: false });
  });
});

describe('resume of existing sandboxes (bootstrap)', () => {
  it('resumes a READY paused sandbox once; a Super admin pause is never undone', async () => {
    const a = student.sandboxId;
    await prisma.simClock.update({ where: { sandboxId: a }, data: { state: 'PAUSED' } });
    await prisma.appMeta.deleteMany({ where: { key: RESUME_DONE_KEY } });
    const r1 = await resumeExistingSandboxes(prisma, { env: {} });
    expect(r1.resumed).toBeGreaterThanOrEqual(1);
    expect((await clockOf(a)).state).toBe('RUNNING');
    // a Super admin pauses it: the next deploy (second run) leaves it alone
    await adminPauseSandbox(prisma, a);
    expect((await clockOf(a)).state).toBe('PAUSED');
    const r2 = await resumeExistingSandboxes(prisma, { env: {} });
    expect(r2.resumed).toBe(0);
    expect((await clockOf(a)).state).toBe('PAUSED');
    // even with the done marker gone, the pause marker keeps it paused
    await prisma.appMeta.deleteMany({ where: { key: RESUME_DONE_KEY } });
    const r3 = await resumeExistingSandboxes(prisma, { env: {} });
    expect(r3.respectedAdminPause).toBeGreaterThanOrEqual(1);
    expect((await clockOf(a)).state).toBe('PAUSED');
    expect(await startSandboxClock(prisma, a)).toBe(false);
    // only the explicit resume runs it again; the paused time is not owed
    expect(await adminResumeSandbox(prisma, a)).toBe(true);
    const c = await clockOf(a);
    expect(c.state).toBe('RUNNING');
    expect(await isAdminPaused(prisma, a)).toBe(false);
    expect(Date.now() - (c.lastAdvanceRealAt as Date).getTime()).toBeLessThan(60_000);
  });

  it('SANDBOX_CLOCK_AUTOSTART=0 keeps a clock paused (stable clocks for tests)', async () => {
    const a = student.sandboxId;
    await prisma.simClock.update({ where: { sandboxId: a }, data: { state: 'PAUSED' } });
    expect(await startSandboxClock(prisma, a, { env: { [AUTOSTART_ENV]: '0' } })).toBe(false);
    expect((await clockOf(a)).state).toBe('PAUSED');
    expect(await startSandboxClock(prisma, a)).toBe(true);
  });
});

describe('load protection', () => {
  async function owe(id: string, ticks: number, now: number) {
    await prisma.simClock.update({
      where: { sandboxId: id },
      data: {
        state: 'RUNNING',
        lastAdvanceRealAt: new Date(now - ticks * PER_TICK_MS),
        remainderMs: 0,
      },
    });
  }

  it("the timer skips a sandbox whose student was not seen in 7 days; the student's own call catches up", async () => {
    const id = student.sandboxId;
    const now = Date.now();
    await owe(id, 10, now);
    await prisma.user.update({
      where: { id: student.userId },
      data: { lastSeenAt: new Date(now - ACTIVE_WINDOW_MS - 3_600_000) },
    });
    const before = Number((await clockOf(id)).tickIndex);
    const idle = await runDueTicks(Number.MAX_SAFE_INTEGER, {
      now,
      activeWithinMs: ACTIVE_WINDOW_MS,
    });
    expect(idle.stillDue).not.toBeGreaterThan(Number.MAX_SAFE_INTEGER);
    expect(Number((await clockOf(id)).tickIndex)).toBe(before);
    // active again: the timer moves it
    await prisma.user.update({
      where: { id: student.userId },
      data: { lastSeenAt: new Date(now - 3_600_000) },
    });
    await runDueTicks(Number.MAX_SAFE_INTEGER, { now, activeWithinMs: ACTIVE_WINDOW_MS });
    expect(Number((await clockOf(id)).tickIndex)).toBe(before + 10);
    // the student's own lazy path works regardless of the window
    await owe(id, 4, now);
    await prisma.user.update({
      where: { id: student.userId },
      data: { lastSeenAt: new Date(now - 30 * 86_400_000) },
    });
    // lazy path: a page load runs a few ticks within its 800 ms budget (about 0.3 s per tick on this sandbox)
    const lazy = await ensureCaughtUp(id, { now });
    expect(lazy.ticks).toBeGreaterThanOrEqual(1);
    expect(lazy.ticks).toBeLessThanOrEqual(4);
  });

  it(
    'a long inactive sandbox catches up in chunks of at most 96 ticks, and debt beyond 7 days is not owed',
    { timeout: 240_000 },
    async () => {
      const id = student.sandboxId;
      const now = Date.now();
      await prisma.user.update({
        where: { id: student.userId },
        data: { lastSeenAt: new Date(now) },
      });
      await owe(id, 5000, now); // about 35 simulated days
      const before = Number((await clockOf(id)).tickIndex);
      const first = await runDueTicks(Number.MAX_SAFE_INTEGER, {
        now,
        activeWithinMs: ACTIVE_WINDOW_MS,
      });
      expect(first.ticks).toBe(96);
      expect(Number((await clockOf(id)).tickIndex)).toBe(before + 96);
      const second = await runDueTicks(Number.MAX_SAFE_INTEGER, {
        now,
        activeWithinMs: ACTIVE_WINDOW_MS,
      });
      expect(second.ticks).toBe(MAX_OWED_TICKS - 96); // 168 owed in total, the rest was forgiven
      expect(
        (await runDueTicks(Number.MAX_SAFE_INTEGER, { now, activeWithinMs: ACTIVE_WINDOW_MS }))
          .ticks,
      ).toBe(0);
    },
  );
});

describe('Super admin pause and resume', () => {
  it('pauses and resumes with an audit entry, the pause survives the timer, and a student cannot do it', async () => {
    const id = student.sandboxId;
    const actor = { id: adminId, role: 'SUPER_ADMIN' } as const;
    await prisma.user.update({ where: { id: student.userId }, data: { lastSeenAt: new Date() } });
    const paused = await setSandboxClockRunning(actor, student.userId, false);
    expect(paused).toMatchObject({ state: 'PAUSED', pausedByAdmin: true });
    const tick = Number((await clockOf(id)).tickIndex);
    await prisma.simClock.updateMany({
      where: { sandboxId: id },
      data: { lastAdvanceRealAt: new Date(Date.now() - 600_000) },
    });
    await runDueTicks(Number.MAX_SAFE_INTEGER, { activeWithinMs: ACTIVE_WINDOW_MS });
    expect(Number((await clockOf(id)).tickIndex)).toBe(tick);
    const resumed = await setSandboxClockRunning(actor, student.userId, true);
    expect(resumed).toMatchObject({ state: 'RUNNING', pausedByAdmin: false });
    const actions = (
      await prisma.auditLog.findMany({
        where: {
          targetUserId: student.userId,
          action: { in: ['SANDBOX_PAUSED', 'SANDBOX_RESUMED'] },
        },
        orderBy: { createdAt: 'asc' },
      })
    ).map((r) => r.action);
    expect(actions).toEqual(['SANDBOX_PAUSED', 'SANDBOX_RESUMED']);
    await expect(
      setSandboxClockRunning({ id: student.userId, role: 'USER' } as never, student.userId, false),
    ).rejects.toBeDefined();
  });
});

describe('what a student builds delivers (both advertisers)', () => {
  it('a new ACTIVE line item with a creative delivers impressions and spend, for each advertiser', async () => {
    const id = student.sandboxId;
    const sb = await prisma.sandbox.findUniqueOrThrow({ where: { id } });
    const user: SessionUser = {
      id: student.userId,
      email: 'student@example.test',
      name: 'Student',
      appRole: 'user',
      classroomId: sb.classroomId,
      sandboxId: id,
      partnerId: partnerIdOf(id),
      dvRole: 'STANDARD',
    };
    const advertisers = await prisma.advertiser.findMany({
      where: { sandboxId: id },
      orderBy: { id: 'asc' },
    });
    expect(advertisers.length).toBeGreaterThanOrEqual(2);
    const clock = await clockOf(id);
    const simNow = new Date(clock.simStart.getTime() + Number(clock.tickIndex) * 3_600_000);
    const today = simNow.toISOString().slice(0, 10);
    const lis: { adv: string; li: string; io: string }[] = [];
    for (const adv of advertisers.slice(0, 2)) {
      const camp = await createCampaign(user, adv.id, {
        ...newCampaignValue(today),
        name: `Delivery ${adv.id.slice(-4)}`,
        goal: 'AWARENESS',
        kpi: { type: 'CPM', value: 50, otherText: '' },
        creativeTypes: ['DISPLAY'],
      });
      if (!camp.ok) throw new Error(`campaign: ${JSON.stringify(camp)}`);
      const ioWire = newIoValue('STANDARD', 'BRAND_AWARENESS', today);
      ioWire.name = 'Delivery IO';
      ioWire.budget.segments[0]!.amount = 500000;
      ioWire.kpi = { type: 'VCPM', value: 40 };
      const io = await createInsertionOrder(user, camp.data.id, { ...ioWire, status: 'ACTIVE' });
      if (!io.ok) throw new Error(`io: ${JSON.stringify(io)}`);
      const init = await getDraftInit(user, io.data.id, 'DISPLAY', { name: 'Delivery LI' });
      if (!init) throw new Error('no draft');
      const draft = {
        ...init.value,
        budget: { mode: 'AMOUNT' as const, amount: 100000 },
        pacing: {
          ...init.value.pacing,
          period: 'DAILY' as const,
          type: 'EVEN' as const,
          dailyAmount: 20000,
        },
        bid: { ...init.value.bid, mode: 'FIXED' as const, optimizedTowards: null, fixedCpm: 400 },
        euPoliticalAds: 'NO' as const,
      };
      const li = await createLineItem(user, io.data.id, draft);
      if (!li.ok) throw new Error(`li: ${JSON.stringify(li)}`);
      // through the real service: the review verdict is planned at random (some creatives are not servable by design,
      // like a student who has to upload another one); the exchange approval is decided by the engine after its delay
      let assigned = false;
      for (let n = 1; n <= 8 && !assigned; n++) {
        const creative = await createCreative(user, adv.id, tpDisplay(`Delivery banner ${n}`));
        if (!creative.ok) throw new Error(`creative: ${JSON.stringify(creative)}`);
        assigned = (await assignCreatives(user, li.data.id, { add: [creative.data.id] })).ok;
      }
      expect(assigned, 'a servable creative within 8 tries').toBe(true);
      const act = await setLineItemStatus(user, { id: li.data.id, status: 'ACTIVE' });
      if (!act.ok) throw new Error(`activate: ${JSON.stringify(act)}`);
      lis.push({ adv: adv.id, li: li.data.id, io: io.data.id });
    }
    // three simulated days, through the timer path (the student is active)
    const now = Date.now();
    await prisma.user.update({
      where: { id: student.userId },
      data: { lastSeenAt: new Date(now) },
    });
    await prisma.simClock.update({
      where: { sandboxId: id },
      data: {
        state: 'RUNNING',
        lastAdvanceRealAt: new Date(now - 72 * PER_TICK_MS),
        remainderMs: 0,
      },
    });
    let total = 0;
    for (let i = 0; i < 4 && total < 72; i++) {
      total += (
        await runDueTicks(Number.MAX_SAFE_INTEGER, { now, activeWithinMs: ACTIVE_WINDOW_MS })
      ).ticks;
    }
    expect(total).toBe(72);
    const to = new Date(Date.parse(`${today}T00:00:00Z`) + 5 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    for (const { adv, li, io } of lis) {
      // the list column the student looks at (instant report data) and History / Troubleshooter data react
      const list = await listLineItems(user, { kind: 'io', id: io }, {}, { from: today, to });
      const row = list?.rows.find((r) => r.id === li);
      expect(row?.impressions, `list impressions for advertiser ${adv}`).toBeGreaterThan(0);
      expect(row?.revenue, `list spend for advertiser ${adv}`).toBeGreaterThan(0);
      expect(
        await prisma.deliveryDiagnostic.count({ where: { sandboxId: id, lineItemId: li } }),
        'Troubleshooter diagnostics',
      ).toBeGreaterThan(0);
      expect(
        await prisma.changeGroup.count({ where: { sandboxId: id, entityId: li } }),
        'History entries',
      ).toBeGreaterThan(0);
      const sums = await prisma.simDailyMetric.aggregate({
        where: { sandboxId: id, lineItemId: li, sliceKind: 'total' },
        _sum: { impressions: true, totalMediaCost: true },
      });
      expect(Number(sums._sum.impressions), `impressions for advertiser ${adv}`).toBeGreaterThan(0);
      expect(Number(sums._sum.totalMediaCost), `spend for advertiser ${adv}`).toBeGreaterThan(0);
    }
  }, 300_000);
});
