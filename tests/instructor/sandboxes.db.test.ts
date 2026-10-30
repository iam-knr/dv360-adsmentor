import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Actor } from '@/lib/accounts/permissions';
import { prisma } from '@/lib/db';
import { decideCertificate, listCertificateRequests } from '@/lib/instructor/certificates';
import { InstructorError } from '@/lib/instructor/rules';
import { createSandboxFor, resetSandboxes } from '@/lib/instructor/sandboxes';
import { seedReferenceData } from '@/lib/seed/reference-db';
import { cleanup, createAccount, createClassroom, uniq } from '../auth/fixtures';

const userIds: string[] = [];
const classroomIds: string[] = [];
let admin: Actor;
let other: Actor;
let classId: string;
let className: string;
const students: { id: string; name: string }[] = [];

const code = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    if (e instanceof InstructorError) return e.code;
    throw e;
  }
  return 'NO_ERROR';
};

beforeAll(async () => {
  // closed-form history only: these tests check the console, not the engine backfill (tests/sandbox/provision.db.test.ts)
  process.env.SANDBOX_ENGINE_DAYS = '0';
  await seedReferenceData(prisma);
  const a = await createAccount(prisma, { tag: 'sbx-admin', role: 'ADMIN' });
  const b = await createAccount(prisma, { tag: 'sbx-other', role: 'ADMIN' });
  userIds.push(a.user.id, b.user.id);
  admin = { id: a.user.id, role: 'ADMIN' };
  other = { id: b.user.id, role: 'ADMIN' };
  const c = await createClassroom(prisma, { tag: 'sbx', ownerAdminId: a.user.id, windows: 'none' });
  await prisma.classroom.update({ where: { id: c.id }, data: { defaultSeedTemplate: 'healthy' } });
  classroomIds.push(c.id);
  classId = c.id;
  className = c.name;
  for (const n of ['One', 'Two']) {
    const u = await createAccount(prisma, {
      tag: `sbx-${n}`,
      role: 'USER',
      cohortId: c.id,
      name: `Student ${n}`,
    });
    await prisma.classroomMember.create({ data: { classroomId: c.id, userId: u.user.id } });
    userIds.push(u.user.id);
    students.push({ id: u.user.id, name: u.user.name });
  }
}, 120_000);

afterAll(async () => {
  await prisma.classroomMember.deleteMany({ where: { userId: { in: userIds } } });
  await cleanup(prisma, { userIds, classroomIds });
});

const sandboxOf = (userId: string) =>
  prisma.sandbox.findFirstOrThrow({ where: { classroomId: classId, ownerUserId: userId } });

describe('create and reset (M18-AC12)', () => {
  it('createSandboxFor builds a READY sandbox with the student STANDARD on its partner', async () => {
    const r = await createSandboxFor(admin, classId, students[0]!.id);
    expect(r.ok, r.error).toBe(true);
    const sb = await sandboxOf(students[0]!.id);
    expect(sb).toMatchObject({ provisionState: 'READY', status: 'ACTIVE', kind: 'STUDENT' });
    const grants = await prisma.userAccessGrant.findMany({
      where: { sandboxId: sb.id, userId: students[0]!.id },
    });
    expect(grants).toHaveLength(1);
    expect(grants[0]!.role).toBe('STANDARD');
    // idempotent: a second call neither duplicates the grant nor rebuilds
    await createSandboxFor(admin, classId, students[0]!.id);
    expect(
      await prisma.sandbox.count({ where: { classroomId: classId, ownerUserId: students[0]!.id } }),
    ).toBe(1);
    expect(await prisma.userAccessGrant.count({ where: { sandboxId: sb.id } })).toBe(1);
    expect((await sandboxOf(students[0]!.id)).resetCount).toBe(0);
    await createSandboxFor(admin, classId, students[1]!.id);
  }, 120_000);

  it('resets one student: back to seed state, resetCount +1, the other student untouched', async () => {
    const one = await sandboxOf(students[0]!.id);
    const two = await sandboxOf(students[1]!.id);
    // the student "does work": rename the first advertiser in sandbox one and in sandbox two
    for (const sb of [one, two]) {
      await prisma.advertiser.updateMany({
        where: { sandboxId: sb.id },
        data: { name: 'Student edit' },
      });
    }
    const r = await resetSandboxes(admin, {
      classId,
      scope: 'USER',
      userIds: [students[0]!.id],
      confirm: 'RESET',
    });
    expect(r.outcomes).toEqual([{ userId: students[0]!.id, name: students[0]!.name, ok: true }]);
    const afterOne = await sandboxOf(students[0]!.id);
    expect(afterOne.id).toBe(one.id);
    expect(afterOne.resetCount).toBe(1);
    expect(afterOne.lastResetAt).not.toBeNull();
    expect(afterOne.status).toBe('ACTIVE');
    expect(afterOne.provisionState).toBe('READY');
    expect(
      await prisma.advertiser.count({ where: { sandboxId: one.id, name: 'Student edit' } }),
    ).toBe(0);
    expect(
      await prisma.advertiser.count({ where: { sandboxId: two.id, name: 'Student edit' } }),
    ).toBeGreaterThan(0);
    expect((await sandboxOf(students[1]!.id)).resetCount).toBe(0);
    // access grant survives the reset (the partner keeps its id)
    expect(
      await prisma.userAccessGrant.count({ where: { sandboxId: one.id, userId: students[0]!.id } }),
    ).toBe(1);
    expect(
      await prisma.auditLog.count({ where: { classroomId: classId, action: 'SANDBOX_RESET' } }),
    ).toBe(1);
  }, 180_000);

  it('SIM-009: a forged request without the confirmation is refused and nothing changes', async () => {
    const before = await sandboxOf(students[0]!.id);
    expect(
      await code(resetSandboxes(admin, { classId, scope: 'USER', userIds: [students[0]!.id] })),
    ).toBe('SIM-009');
    expect(
      await code(
        resetSandboxes(admin, {
          classId,
          scope: 'USER',
          userIds: [students[0]!.id],
          confirm: 'yes',
        }),
      ),
    ).toBe('SIM-009');
    expect(await code(resetSandboxes(admin, { classId, scope: 'CLASS' }))).toBe('SIM-009');
    expect(await code(resetSandboxes(admin, { classId, scope: 'CLASS', confirm: 'RESET' }))).toBe(
      'SIM-009',
    );
    expect(
      await code(resetSandboxes(admin, { classId, scope: 'USER', userIds: [], confirm: 'RESET' })),
    ).toBe('SIM-021');
    expect((await sandboxOf(students[0]!.id)).resetCount).toBe(before.resetCount);
  });

  it('resets the whole class only when the class name is typed; a frozen sandbox stays frozen', async () => {
    await prisma.sandbox.update({
      where: { id: (await sandboxOf(students[1]!.id)).id },
      data: {
        status: 'FROZEN',
        frozenReason: 'WINDOW',
        frozenAt: new Date(),
        clockStateBeforeFreeze: 'RUNNING',
      },
    });
    const r = await resetSandboxes(admin, {
      classId,
      scope: 'CLASS',
      confirm: className.toUpperCase(),
    });
    expect(r.outcomes.map((o) => o.ok)).toEqual([true, true]);
    const a = await sandboxOf(students[0]!.id);
    const b = await sandboxOf(students[1]!.id);
    expect(a.resetCount).toBe(2);
    expect(b.resetCount).toBe(1);
    expect(b.status).toBe('FROZEN');
    expect(b.clockStateBeforeFreeze).toBeNull();
    expect(
      await prisma.auditLog.count({ where: { classroomId: classId, action: 'CLASS_RESET' } }),
    ).toBe(1);
  }, 240_000);

  it('a new market seed changes the seed value', async () => {
    const before = await sandboxOf(students[0]!.id);
    await resetSandboxes(admin, {
      classId,
      scope: 'USER',
      userIds: [students[0]!.id],
      confirm: 'RESET',
      newMarketSeed: true,
    });
    expect((await sandboxOf(students[0]!.id)).seedValue).not.toBe(before.seedValue);
  }, 180_000);

  it('another instructor cannot reset or create sandboxes here (SIM-020)', async () => {
    expect(await code(resetSandboxes(other, { classId, scope: 'CLASS', confirm: className }))).toBe(
      'SIM-020',
    );
    expect(
      await code(
        resetSandboxes(other, {
          classId,
          scope: 'USER',
          userIds: [students[0]!.id],
          confirm: 'RESET',
        }),
      ),
    ).toBe('SIM-020');
    expect(await code(createSandboxFor(other, classId, students[0]!.id))).toBe('SIM-020');
  });

  it('an instructor cannot name a student of another class in their own class', async () => {
    const mine = await createClassroom(prisma, {
      tag: 'sbx-mine',
      ownerAdminId: other.id,
      windows: 'none',
    });
    classroomIds.push(mine.id);
    expect(
      await code(
        resetSandboxes(other, {
          classId: mine.id,
          scope: 'USER',
          userIds: [students[0]!.id],
          confirm: 'RESET',
        }),
      ),
    ).toBe('SIM-021');
    expect((await sandboxOf(students[0]!.id)).status).toBe('ACTIVE');
  });
});

describe('policy certificate requests (module 03 T09)', () => {
  it('lists REQUESTED certificates of the class and the instructor decides; another instructor cannot', async () => {
    const sb = await sandboxOf(students[0]!.id);
    const adv = await prisma.advertiser.findFirstOrThrow({ where: { sandboxId: sb.id } });
    const cert = await prisma.policyCertificate.create({
      data: {
        sandboxId: sb.id,
        advertiserId: adv.id,
        kind: 'CRYPTOCURRENCY',
        status: 'REQUESTED',
        countryCode: 'IN',
        notes: uniq('why'),
      },
    });
    const list = await listCertificateRequests(admin);
    const row = list.find((r) => r.id === cert.id);
    expect(row).toMatchObject({ classId, studentName: students[0]!.name });
    expect(await listCertificateRequests(other)).toEqual([]);

    expect(
      await code(
        decideCertificate(other, cert.id, 'APPROVED', undefined, 'Other', 'o@example.test'),
      ),
    ).toBe('SIM-020');
    await decideCertificate(
      admin,
      cert.id,
      'REJECTED',
      'Missing licence',
      'Admin',
      'a@example.test',
    );
    const after = await prisma.policyCertificate.findUniqueOrThrow({ where: { id: cert.id } });
    expect(after).toMatchObject({
      status: 'REJECTED',
      rejectionReason: 'Missing licence',
      decidedById: admin.id,
    });
    expect(
      await prisma.auditLog.count({ where: { action: 'CERTIFICATE_DECIDED', targetId: cert.id } }),
    ).toBe(1);
    // a decided request is gone from the list and cannot be decided twice
    expect((await listCertificateRequests(admin)).some((r) => r.id === cert.id)).toBe(false);
    expect(
      await code(
        decideCertificate(admin, cert.id, 'APPROVED', undefined, 'Admin', 'a@example.test'),
      ),
    ).toBe('SIM-018');
  });
});
