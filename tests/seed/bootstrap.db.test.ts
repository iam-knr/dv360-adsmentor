import { verify } from '@node-rs/argon2';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { clearSandboxData } from '@/lib/seed/write';
import {
  DEMO_CLASS,
  DEMO_STUDENTS,
  runDemoClass,
} from '../../prisma/bootstrap/20-demo-class.bootstrap';
import { createAccount } from '../auth/fixtures';

const PASSWORD = 'demo-class-pass-1234';
const quiet = () => {};

describe('demo class bootstrap', () => {
  let ownerId: string | undefined;

  beforeAll(async () => {
    // the Super admin owns the cohort; create one when the database has none (CI runs db:bootstrap only before e2e)
    if ((await prisma.user.count({ where: { appRole: 'SUPER_ADMIN', status: 'ACTIVE' } })) === 0) {
      ownerId = (await createAccount(prisma, { tag: 'demo-owner', role: 'SUPER_ADMIN' })).user.id;
    }
    await runDemoClass(prisma, { NODE_ENV: 'test', SEED_STUDENT_PASSWORD: PASSWORD }, quiet);
  }, 240_000);

  afterAll(async () => {
    const classroom = await prisma.classroom.findUnique({ where: { code: DEMO_CLASS.code } });
    if (classroom) {
      for (const s of await prisma.sandbox.findMany({ where: { classroomId: classroom.id } })) {
        await prisma.$transaction((tx) => clearSandboxData(tx, s.id), { timeout: 60_000 });
      }
      await prisma.userAccessGrant.deleteMany({
        where: { sandbox: { classroomId: classroom.id } },
      });
      await prisma.sandbox.deleteMany({ where: { classroomId: classroom.id } });
      await prisma.accessWindow.deleteMany({ where: { classroomId: classroom.id } });
      await prisma.classroomMember.deleteMany({ where: { classroomId: classroom.id } });
      await prisma.user.deleteMany({ where: { cohortId: classroom.id } });
      await prisma.classroom.delete({ where: { id: classroom.id } });
    }
    if (ownerId) await prisma.user.deleteMany({ where: { id: ownerId } });
    await prisma.$disconnect();
  }, 120_000);

  it('creates the cohort, owned by a Super admin, and three student accounts', async () => {
    const classroom = await prisma.classroom.findUniqueOrThrow({
      where: { code: DEMO_CLASS.code },
      include: { members: { include: { user: true } }, ownerAdmin: true },
    });
    expect(classroom.name).toBe('Demo class');
    expect(classroom.ownerAdmin.appRole).toBe('SUPER_ADMIN');
    expect(classroom.members).toHaveLength(3);
    expect(classroom.members.every((m) => m.user.appRole === 'USER')).toBe(true);
    expect(classroom.members.map((m) => m.user.email).sort()).toEqual([
      'student1@example.test',
      'student2@example.test',
      'student3@example.test',
    ]);
    for (const m of classroom.members) {
      expect(m.user.status).toBe('ACTIVE');
      expect(await verify(m.user.passwordHash!, PASSWORD)).toBe(true);
    }
  });

  it('gives each student a ready starter-agency sandbox with a STANDARD grant on the partner', async () => {
    const classroom = await prisma.classroom.findUniqueOrThrow({
      where: { code: DEMO_CLASS.code },
    });
    const sandboxes = await prisma.sandbox.findMany({
      where: { classroomId: classroom.id },
      include: { owner: true },
    });
    expect(sandboxes).toHaveLength(3);
    for (const s of sandboxes) {
      expect(s).toMatchObject({
        provisionState: 'READY',
        seedTemplateKey: 'starter-agency',
        kind: 'STUDENT',
        status: 'ACTIVE',
      });
      expect(s.name).toMatch(/^Sandbox ST-00\d$/);
      expect(await prisma.lineItem.count({ where: { sandboxId: s.id } })).toBe(36 + 8); // plan + module 09 YouTube seed
      const partner = await prisma.partner.findFirstOrThrow({ where: { sandboxId: s.id } });
      expect(partner.name).toBe(s.name);
      const grants = await prisma.userAccessGrant.findMany({ where: { sandboxId: s.id } });
      expect(grants).toHaveLength(1);
      expect(grants[0]).toMatchObject({
        userId: s.ownerUserId,
        partnerId: partner.id,
        role: 'STANDARD',
        advertiserId: null,
      });
    }
    expect(new Set(sandboxes.map((s) => s.seedValue)).size).toBe(3);
    expect(DEMO_STUDENTS.map((s) => s.studentCode)).toEqual(['ST-001', 'ST-002', 'ST-003']);
  });

  it('creates no access window: there are no class windows', async () => {
    const classroom = await prisma.classroom.findUniqueOrThrow({
      where: { code: DEMO_CLASS.code },
    });
    expect(await prisma.accessWindow.count({ where: { classroomId: classroom.id } })).toBe(0);
  });

  it('is idempotent: a second run adds no rows, rebuilds nothing and keeps the passwords', async () => {
    const before = {
      users: await prisma.user.count(),
      sandboxes: await prisma.sandbox.count(),
      windows: await prisma.accessWindow.count(),
      grants: await prisma.userAccessGrant.count(),
      li: await prisma.lineItem.count(),
    };
    const hashBefore = (
      await prisma.user.findUniqueOrThrow({ where: { email: 'student1@example.test' } })
    ).passwordHash;
    const result = await runDemoClass(
      prisma,
      { NODE_ENV: 'test', SEED_STUDENT_PASSWORD: 'another-password-9999' },
      quiet,
    );
    expect(result.sandboxes?.every((s) => !s.built)).toBe(true);
    const after = {
      users: await prisma.user.count(),
      sandboxes: await prisma.sandbox.count(),
      windows: await prisma.accessWindow.count(),
      grants: await prisma.userAccessGrant.count(),
      li: await prisma.lineItem.count(),
    };
    expect(after).toEqual(before);
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { email: 'student1@example.test' } }))
        .passwordHash,
    ).toBe(hashBefore);
  });

  it('prints generated passwords only for accounts it creates, and never in production', async () => {
    const lines: string[] = [];
    const none = await runDemoClass(prisma, { NODE_ENV: 'test' }, (l) => lines.push(l));
    expect(none.generatedPasswords).toEqual({});
    expect(lines.join('\n')).not.toMatch(/generated passwords/);
    const skipped = await runDemoClass(prisma, { NODE_ENV: 'production' }, quiet);
    expect(skipped.skipped).toBe(true);
    await expect(
      runDemoClass(prisma, { NODE_ENV: 'production', SEED_DEMO: '1' }, quiet),
    ).rejects.toThrow(/SEED_STUDENT_PASSWORD/);
    await expect(
      runDemoClass(prisma, { NODE_ENV: 'test', SEED_STUDENT_PASSWORD: 'short' }, quiet),
    ).rejects.toThrow(/at least 10/);
  });
});
