// DV360 Users page (module 02 4.9; AC-02-20 to AC-02-26). These are roles inside a sandbox, not account levels.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import {
  createUser,
  deleteUser,
  getEmailPreferences,
  getUser,
  listUsers,
  saveEmailPreferences,
  updateUser,
} from '@/lib/settings/users';
import { dropWorld } from '../db/helpers';
import { adminFor, groupsOf, settingsWorld, userFor, type World } from './helpers';

let w: World;
let other: World;
beforeAll(async () => {
  w = await settingsWorld('setusers');
  other = await settingsWorld('setusers2');
  // The fixture student holds STANDARD on the partner. A scenario can raise a student to Admin.
});
afterAll(async () => {
  await dropWorld(w);
  await dropWorld(other);
  await prisma.$disconnect();
});

const adv = (world: World) => ({ advertiserId: world.advertiserId });
const part = (world: World) => ({ partnerId: world.partnerId });

describe('listUsers', () => {
  it('shows "Your profile" and an empty grid for a lone student (AC-02-20)', async () => {
    const res = await listUsers(userFor(w));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.profile).toMatchObject({
      email: `${w.tag}-user@example.test`,
      roles: 'Standard',
      simulated: false,
    });
    expect(res.data.rows).toEqual([]);
    expect(res.data.canManage).toBe(false);
  });

  it('a student cannot create users (button disabled) unless raised to Admin', async () => {
    const res = await createUser(userFor(w), {
      name: 'A',
      email: 'a@example.test',
      access: [{ ...part(w), role: 'READ_ONLY' }],
    });
    expect(res).toMatchObject({ ok: false, code: 'FORBIDDEN' });
    const ro = await createUser(userFor(w, 'READ_ONLY'), {
      name: 'A',
      email: 'a@example.test',
      access: [{ ...part(w), role: 'READ_ONLY' }],
    });
    expect(ro).toMatchObject({ ok: false, code: 'FORBIDDEN' });
  });
});

describe('createUser (Admin)', () => {
  it('USR-001 to USR-003 validations (AC-02-22)', async () => {
    const empty = await createUser(adminFor(w), { name: '', email: '', access: [] });
    expect(!empty.ok && empty.issues.map((i) => i.code)).toEqual(['USR-001', 'USR-001', 'USR-002']);
    const noRole = await createUser(adminFor(w), {
      name: 'N',
      email: 'n@example.test',
      access: [{ ...part(w), role: '' }],
    });
    expect(!noRole.ok && noRole.issues[0]).toMatchObject({
      code: 'USR-003',
      message: 'A selection is required',
    });
  });

  it('saves with two access rows and shows "Standard, Read only" (AC-02-21, AC-02-27)', async () => {
    const res = await createUser(
      adminFor(w),
      {
        name: 'Casey Colleague',
        email: 'Colleague@Example.test',
        access: [
          { ...part(w), role: 'STANDARD' },
          { ...adv(w), role: 'READ_ONLY' },
        ],
      },
      'adding Casey',
    );
    expect(res.ok).toBe(true);
    const list = await listUsers(adminFor(w));
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    expect(list.data.rows).toHaveLength(1);
    expect(list.data.rows[0]).toMatchObject({
      name: 'Casey Colleague',
      email: 'colleague@example.test',
      roles: 'Standard, Read only',
      simulated: true,
    });
    expect(list.data.rows[0]?.partners).not.toBe('');
    expect(list.data.rows[0]?.advertisers).not.toBe('');
    const g = (await groupsOf(w.partnerId))[0];
    expect(g).toMatchObject({
      entityType: 'PARTNER',
      note: 'adding Casey',
      summary: '1 user added',
    });
    expect(g?.entries[0]?.fieldPath).toContain('users');
  });

  it('USR-004 refuses a duplicate email in the sandbox', async () => {
    const dup = await createUser(adminFor(w), {
      name: 'Again',
      email: 'colleague@example.test',
      access: [{ ...part(w), role: 'READ_ONLY' }],
    });
    expect(!dup.ok && dup.issues[0]).toMatchObject({
      code: 'USR-004',
      message: 'A user with this email already exists.',
    });
    const self = await createUser(adminFor(w), {
      name: 'Me',
      email: `${w.tag}-user@example.test`,
      access: [{ ...part(w), role: 'READ_ONLY' }],
    });
    expect(!self.ok && self.issues[0]?.code).toBe('USR-004');
  });

  it('two sandboxes can both add the same colleague address (AC-02-23, DELTA-02-2)', async () => {
    const a = await createUser(adminFor(other), {
      name: 'Casey',
      email: 'colleague@example.test',
      access: [{ ...part(other), role: 'READ_ONLY' }],
    });
    expect(a.ok).toBe(true);
    const list = await listUsers(adminFor(other));
    expect(list.ok && list.data.rows.map((r) => r.email)).toEqual(['colleague@example.test']);
    // and the first sandbox is untouched
    const first = await listUsers(adminFor(w));
    expect(first.ok && first.data.rows).toHaveLength(1);
  });

  it('a user in another sandbox cannot be reached by id', async () => {
    const first = await listUsers(adminFor(w));
    const id = first.ok ? first.data.rows[0]?.id : undefined;
    expect(id).toBeTruthy();
    expect(await getUser(adminFor(other), id!)).toMatchObject({ ok: false, code: 'NOT_FOUND' });
    expect(await deleteUser(adminFor(other), id!)).toMatchObject({ ok: false, code: 'NOT_FOUND' });
  });

  it('simulated users cannot sign in: there is no login row for them', async () => {
    expect(await prisma.user.count({ where: { email: 'colleague@example.test' } })).toBe(0);
  });
});

describe('edit and delete', () => {
  it('changes the role of a user and logs the access change', async () => {
    const list = await listUsers(adminFor(w));
    const row = list.ok ? list.data.rows[0] : undefined;
    expect(row).toBeTruthy();
    const res = await updateUser(adminFor(w), row!.id, {
      name: 'Casey C.',
      access: [{ ...adv(w), role: 'CREATIVE' }],
    });
    expect(res.ok).toBe(true);
    const after = await getUser(adminFor(w), row!.id);
    expect(after.ok && after.data.user).toMatchObject({ name: 'Casey C.', roles: 'Creative' });
    const groups = await groupsOf(w.partnerId);
    expect(
      groups
        .at(-1)
        ?.entries.some(
          (e) =>
            e.label === 'Access' &&
            /Read only/.test(e.oldValue ?? '') &&
            /Creative/.test(e.newValue ?? ''),
        ),
    ).toBe(true);
  });

  it('USR-010: removing the last Admin of a partner is refused; with a second Admin it works (AC-02-24)', async () => {
    await prisma.userAccessGrant.deleteMany({
      where: { userId: w.userId, sandboxId: w.sandboxId },
    });
    await prisma.userAccessGrant.create({
      data: { userId: w.userId, sandboxId: w.sandboxId, partnerId: w.partnerId, role: 'ADMIN' },
    });
    const me = adminFor(w);
    const list = await listUsers(me);
    const casey = list.ok ? list.data.rows[0] : undefined;
    // make Casey a second admin, then delete Casey: fine, I am still an admin
    await updateUser(me, casey!.id, { access: [{ ...part(w), role: 'ADMIN' }] });
    expect((await deleteUser(me, casey!.id)).ok).toBe(true);
    // lowering my own access is USR-011
    const lower = await updateUser(me, `u:${w.userId}`, {
      access: [{ ...part(w), role: 'STANDARD' }],
    });
    expect(!lower.ok && lower.issues.map((i) => i.code)).toEqual(['USR-011', 'USR-010']);
    // a contact who is the only other admin cannot be demoted past zero admins when I am not one
    await prisma.userAccessGrant.deleteMany({
      where: { userId: w.userId, sandboxId: w.sandboxId },
    });
    await prisma.userAccessGrant.create({
      data: { userId: w.userId, sandboxId: w.sandboxId, partnerId: w.partnerId, role: 'STANDARD' },
    });
    const only = await createUser(me, {
      name: 'Only Admin',
      email: 'only@example.test',
      access: [{ ...part(w), role: 'ADMIN' }],
    });
    expect(only.ok).toBe(true);
    const id = only.ok ? only.data.id : '';
    const demote = await updateUser(me, id, { access: [{ ...part(w), role: 'READ_ONLY' }] });
    expect(!demote.ok && demote.issues.map((i) => i.code)).toEqual(['USR-010']);
    expect((await deleteUser(me, id)).ok === false).toBe(true);
  });

  it('an Admin cannot remove themselves', async () => {
    expect(await deleteUser(adminFor(w), `u:${w.userId}`)).toMatchObject({
      ok: false,
      code: 'FORBIDDEN',
    });
  });
});

describe('email preferences (AC-02-26)', () => {
  it('defaults on, saves both toggles and survives a reload; no change log', async () => {
    expect(await getEmailPreferences(userFor(w))).toMatchObject({
      ok: true,
      data: { alerts: true, news: true },
    });
    const before = await prisma.changeGroup.count({ where: { sandboxId: w.sandboxId } });
    expect((await saveEmailPreferences(userFor(w), { alerts: false, news: true })).ok).toBe(true);
    expect(await getEmailPreferences(userFor(w))).toMatchObject({
      ok: true,
      data: { alerts: false, news: true },
    });
    expect(await prisma.changeGroup.count({ where: { sandboxId: w.sandboxId } })).toBe(before);
  });

  it('is private to the person and not writable while viewing as someone else', async () => {
    expect(await getEmailPreferences(adminFor(other))).toMatchObject({
      ok: true,
      data: { alerts: true },
    });
    const viewer = {
      ...userFor(w),
      viewAs: { userId: w.userId, actAs: false },
      actor: {
        id: other.ownerId,
        email: 'admin@example.test',
        name: 'Admin',
        appRole: 'admin' as const,
      },
    };
    expect(await saveEmailPreferences(viewer, { alerts: true, news: true })).toMatchObject({
      ok: false,
      code: 'FORBIDDEN',
    });
  });
});
