import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  AccessWindowClosedError,
  assertWindowOpen,
  checkWindowOpen,
  getClassAccessState,
  getWindowBanner,
  isClassOpen,
  tickAccessWindows,
} from '@/lib/access/windows';
import type { SessionUser } from '@/lib/auth/types';
import { prisma } from '@/lib/db';
import { cleanup, createAccount, createStudent } from './fixtures';

const userIds: string[] = [];
const classroomIds: string[] = [];
const at = (hhmm: string) => new Date(`2026-11-02T${hhmm}:00Z`);

let adminId: string;
async function classroom(name: string) {
  const c = await prisma.classroom.create({
    data: {
      name: `${name}-${Date.now()}-${Math.random()}`,
      code: `c-${name}-${Math.random()}`,
      ownerAdminId: adminId,
      timeZone: 'Asia/Kolkata',
    },
  });
  classroomIds.push(c.id);
  return c;
}
async function window(
  classroomId: string,
  from: string,
  to: string,
  status: 'SCHEDULED' | 'OPEN' | 'CLOSED' = 'SCHEDULED',
) {
  return prisma.accessWindow.create({
    data: { classroomId, label: 'Class', opensAt: at(from), closesAt: at(to), status },
  });
}
async function student(classroomId: string, clockState: 'RUNNING' | 'PAUSED' = 'RUNNING') {
  const s = await createStudent(prisma, { tag: 'win', classroomId, clockState });
  userIds.push(s.user.id);
  return s;
}
const simTick = async (sandboxId: string) =>
  (await prisma.simClock.findUniqueOrThrow({ where: { sandboxId } })).tickIndex;

beforeAll(async () => {
  const a = await createAccount(prisma, { tag: 'win-admin', role: 'ADMIN' });
  adminId = a.user.id;
  userIds.push(adminId);
});
afterAll(() => cleanup(prisma, { userIds, classroomIds }));

describe('window tick: status moves', () => {
  it('SCHEDULED to OPEN to CLOSED with the clock, and CLOSED records the schedule as the reason', async () => {
    const c = await classroom('status');
    const w = await window(c.id, '10:00', '12:00');
    const status = async () => await prisma.accessWindow.findUniqueOrThrow({ where: { id: w.id } });

    expect((await tickAccessWindows(at('09:59'))).opened).toBe(0);
    expect((await status()).status).toBe('SCHEDULED');

    expect((await tickAccessWindows(at('10:00'))).opened).toBe(1);
    expect((await status()).status).toBe('OPEN');

    await tickAccessWindows(at('11:59'));
    expect((await status()).status).toBe('OPEN');

    expect((await tickAccessWindows(at('12:00'))).closed).toBe(1);
    expect(await status()).toMatchObject({ status: 'CLOSED', closedBy: 'SCHEDULE' });

    // idempotent
    expect(await tickAccessWindows(at('12:00'))).toMatchObject({ opened: 0, closed: 0 });
  });

  it('a window that passed completely while nobody ticked goes straight to CLOSED', async () => {
    const c = await classroom('skipped');
    const w = await window(c.id, '10:00', '12:00');
    await tickAccessWindows(at('15:00'));
    expect((await prisma.accessWindow.findUniqueOrThrow({ where: { id: w.id } })).status).toBe(
      'CLOSED',
    );
  });
});

describe('freeze and unfreeze (M18-AC5, M18-AC6)', () => {
  it('freezes at close, pauses the clock, and restores the previous clock state at open without moving sim time', async () => {
    const c = await classroom('freeze');
    await window(c.id, '10:00', '12:00');
    const running = await student(c.id, 'RUNNING');
    const paused = await student(c.id, 'PAUSED');
    const before = {
      running: await simTick(running.sandbox.id),
      paused: await simTick(paused.sandbox.id),
    };

    // 09:00: the class is closed, so the sandboxes are frozen and their clocks paused
    const t1 = await tickAccessWindows(at('09:00'));
    expect(t1.frozen).toBeGreaterThanOrEqual(2);
    const frozen = await prisma.sandbox.findUniqueOrThrow({
      where: { id: running.sandbox.id },
      include: { clock: true },
    });
    expect(frozen).toMatchObject({
      status: 'FROZEN',
      frozenReason: 'WINDOW',
      clockStateBeforeFreeze: 'RUNNING',
    });
    expect(frozen.frozenAt?.toISOString()).toBe(at('09:00').toISOString());
    expect(frozen.clock?.state).toBe('PAUSED');
    expect(await simTick(running.sandbox.id)).toBe(before.running);

    // 10:00: open again, clocks go back to what they were
    const t2 = await tickAccessWindows(at('10:00'));
    expect(t2.unfrozen).toBeGreaterThanOrEqual(2);
    const thawed = await prisma.sandbox.findUniqueOrThrow({
      where: { id: running.sandbox.id },
      include: { clock: true },
    });
    expect(thawed).toMatchObject({
      status: 'ACTIVE',
      frozenReason: null,
      frozenAt: null,
      clockStateBeforeFreeze: null,
    });
    expect(thawed.clock?.state).toBe('RUNNING');
    expect(thawed.clock?.lastAdvanceRealAt?.toISOString()).toBe(at('10:00').toISOString()); // closed hours are not owed
    expect(thawed.clock?.remainderMs).toBe(0);
    expect(
      (await prisma.simClock.findUniqueOrThrow({ where: { sandboxId: paused.sandbox.id } })).state,
    ).toBe('PAUSED');

    // sim time never moved
    expect(await simTick(running.sandbox.id)).toBe(before.running);
    expect(await simTick(paused.sandbox.id)).toBe(before.paused);

    // 12:00: closes again
    await tickAccessWindows(at('12:00'));
    expect(
      (await prisma.sandbox.findUniqueOrThrow({ where: { id: running.sandbox.id } })).status,
    ).toBe('FROZEN');
    // and a second tick changes nothing
    expect(await tickAccessWindows(at('12:00'))).toMatchObject({ frozen: 0, unfrozen: 0 });
  });

  it('only touches classes that changed state', async () => {
    const open = await classroom('open-class');
    await window(open.id, '08:00', '18:00', 'OPEN');
    const closed = await classroom('closed-class');
    const a = await student(open.id);
    const b = await student(closed.id);
    await tickAccessWindows(at('10:00'));
    expect((await prisma.sandbox.findUniqueOrThrow({ where: { id: a.sandbox.id } })).status).toBe(
      'ACTIVE',
    );
    expect((await prisma.sandbox.findUniqueOrThrow({ where: { id: b.sandbox.id } })).status).toBe(
      'FROZEN',
    );
  });

  it('never unfreezes a sandbox frozen for the account (disabled User), RC-076', async () => {
    const c = await classroom('account-freeze');
    await window(c.id, '08:00', '18:00', 'OPEN');
    const s = await student(c.id);
    await prisma.sandbox.update({
      where: { id: s.sandbox.id },
      data: { status: 'FROZEN', frozenReason: 'ACCOUNT' },
    });
    await tickAccessWindows(at('10:00'));
    expect(await prisma.sandbox.findUniqueOrThrow({ where: { id: s.sandbox.id } })).toMatchObject({
      status: 'FROZEN',
      frozenReason: 'ACCOUNT',
    });
  });

  it('leaves demo and archived sandboxes alone', async () => {
    const c = await classroom('kinds');
    const demo = await prisma.sandbox.create({
      data: { classroomId: c.id, name: 'demo', seedValue: 1, kind: 'DEMO' },
    });
    const s = await student(c.id);
    await prisma.sandbox.update({ where: { id: s.sandbox.id }, data: { status: 'ARCHIVED' } });
    await tickAccessWindows(at('10:00'));
    expect((await prisma.sandbox.findUniqueOrThrow({ where: { id: demo.id } })).status).toBe(
      'ACTIVE',
    );
    expect((await prisma.sandbox.findUniqueOrThrow({ where: { id: s.sandbox.id } })).status).toBe(
      'ARCHIVED',
    );
  });

  it('keeps an instructor demo clock running when runOutsideSession is on', async () => {
    const c = await classroom('outside');
    const s = await student(c.id, 'RUNNING');
    await prisma.simClock.update({
      where: { sandboxId: s.sandbox.id },
      data: { runOutsideSession: true },
    });
    await tickAccessWindows(at('09:00'));
    const row = await prisma.sandbox.findUniqueOrThrow({
      where: { id: s.sandbox.id },
      include: { clock: true },
    });
    expect(row.status).toBe('FROZEN');
    expect(row.clock?.state).toBe('RUNNING');
  });
});

describe('isClassOpen and the hard stop', () => {
  it('follows the window times, whatever the status column says', async () => {
    const c = await classroom('times');
    await window(c.id, '10:00', '12:00'); // SCHEDULED, tick has not run
    expect(await isClassOpen(c.id, at('09:59'))).toBe(false);
    expect(await isClassOpen(c.id, at('10:00'))).toBe(true);
    expect(await isClassOpen(c.id, at('11:59'))).toBe(true);
    expect(await isClassOpen(c.id, at('12:00'))).toBe(false);

    const d = await classroom('stale');
    await window(d.id, '10:00', '12:00', 'OPEN'); // tick is late: status still OPEN after the end
    expect(await isClassOpen(d.id, at('12:01'))).toBe(false);
  });

  it('a window closed by hand ends the class at once (Close now)', async () => {
    const c = await classroom('manual');
    const w = await window(c.id, '10:00', '12:00', 'OPEN');
    expect(await isClassOpen(c.id, at('10:30'))).toBe(true);
    await prisma.accessWindow.update({
      where: { id: w.id },
      data: { status: 'CLOSED', closedBy: 'INSTRUCTOR' },
    });
    expect(await isClassOpen(c.id, at('10:30'))).toBe(false);
  });

  it('reports the next window and the end of the open stretch', async () => {
    const c = await classroom('state');
    await window(c.id, '10:00', '12:00', 'OPEN');
    await window(c.id, '12:00', '13:00'); // back to back
    await window(c.id, '15:00', '16:00');
    const open = await getClassAccessState(c.id, at('11:00'));
    expect(open.open).toBe(true);
    expect(open.closesAt?.toISOString()).toBe(at('13:00').toISOString());
    expect(open.nextWindow?.opensAt.toISOString()).toBe(at('12:00').toISOString());
    const closed = await getClassAccessState(c.id, at('14:00'));
    expect(closed.open).toBe(false);
    expect(closed.nextWindow?.opensAt.toISOString()).toBe(at('15:00').toISOString());
    expect(closed.timeZone).toBe('Asia/Kolkata');
  });
});

describe('writes after the close (SIM-010)', () => {
  const user = (classroomId: string | undefined, over: Partial<SessionUser> = {}): SessionUser => ({
    id: 'u',
    email: 'u@example.test',
    name: 'U',
    appRole: 'user',
    dvRole: 'STANDARD',
    classroomId,
    ...over,
  });

  it('returns ACCESS_WINDOW_CLOSED with the SIM-010 text for a student', async () => {
    const c = await classroom('write');
    await window(c.id, '10:00', '12:00');
    expect(await checkWindowOpen(user(c.id), at('11:00'))).toBeNull();
    await expect(assertWindowOpen(user(c.id), at('11:00'))).resolves.toBeUndefined();
    expect(await checkWindowOpen(user(c.id), at('12:00'))).toEqual({
      code: 'ACCESS_WINDOW_CLOSED',
      message: 'Class has ended. Your work is saved.',
    });
    await expect(assertWindowOpen(user(c.id), at('12:00'))).rejects.toBeInstanceOf(
      AccessWindowClosedError,
    );
    await expect(assertWindowOpen(user(c.id), at('12:00'))).rejects.toMatchObject({
      code: 'ACCESS_WINDOW_CLOSED',
    });
  });

  it('a student without a class cannot write', async () => {
    expect(await checkWindowOpen(user(undefined), at('11:00'))).not.toBeNull();
  });

  it('admins and super admins bypass, and so does an admin acting through view-as', async () => {
    const c = await classroom('bypass');
    for (const appRole of ['admin', 'super_admin'] as const) {
      expect(await checkWindowOpen(user(c.id, { appRole }), at('20:00'))).toBeNull();
    }
    const acting = user(c.id, {
      viewAs: { userId: 'u', actAs: true },
      actor: { id: 'a', email: 'a@example.test', name: 'A', appRole: 'admin' },
    });
    expect(await checkWindowOpen(acting, at('20:00'))).toBeNull();
  });

  it('shows the banner in the last five minutes only, to students only', async () => {
    const c = await classroom('banner');
    await window(c.id, '10:00', '12:00', 'OPEN');
    expect(await getWindowBanner(user(c.id), at('11:54'))).toBeNull();
    expect(await getWindowBanner(user(c.id), at('11:55'))).toBe(
      'Class ends at 5:30 PM. Save your work.',
    ); // 12:00 UTC = 17:30 IST
    expect(await getWindowBanner(user(c.id), at('12:00'))).toBeNull();
    expect(await getWindowBanner(user(c.id, { appRole: 'admin' }), at('11:57'))).toBeNull();
  });
});
