import { describe, expect, it } from 'vitest';
import {
  ACCOUNT_ACTIONS,
  can,
  type Actor,
  type Level,
  type Target,
} from '@/lib/accounts/permissions';

const sa: Actor = { id: 'sa1', role: 'SUPER_ADMIN' };
const ad: Actor = { id: 'ad1', role: 'ADMIN' };
const us: Actor = { id: 'us1', role: 'USER' };

const ownUser: Target = { id: 'u1', role: 'USER' };
const otherUser: Target = { id: 'u2', role: 'USER' };
const otherSuper: Target = { id: 'sa2', role: 'SUPER_ADMIN' };

describe('permission matrix (module 19 4.2, two levels since ADM-FIX)', () => {
  it('students can do nothing', () => {
    for (const action of ACCOUNT_ACTIONS) expect(can(us, action, ownUser)).toBe(false);
  });

  it('the retired Admin level can do nothing either, on anyone', () => {
    for (const action of ACCOUNT_ACTIONS) {
      for (const t of [ownUser, otherSuper, { id: 'ad1', role: 'ADMIN' as Level }]) {
        expect(can(ad, action, t), `${action} on ${t.role}`).toBe(false);
      }
    }
  });

  it('only a Super admin opens settings and edits policy', () => {
    expect(can(sa, 'policy.edit')).toBe(true);
    expect(can(us, 'policy.edit')).toBe(false);
  });

  it('create: a Super admin adds students and Super admins', () => {
    for (const role of ['SUPER_ADMIN', 'USER'] as Level[]) {
      expect(can(sa, 'account.create', { role })).toBe(true);
    }
  });

  it.each([
    'account.view',
    'account.edit',
    'account.disable',
    'account.enable',
    'account.unlock',
    'account.resetPassword',
    'account.revokeSessions',
    'account.delete',
    'account.restore',
  ] as const)('%s: the Super admin on any student', (action) => {
    expect(can(sa, action, ownUser)).toBe(true);
    expect(can(sa, action, otherUser)).toBe(true);
  });

  it('role change and transfer are never on self', () => {
    expect(can(sa, 'account.changeRole', ownUser)).toBe(true);
    expect(can(sa, 'account.changeRole', { id: 'sa1', role: 'SUPER_ADMIN' })).toBe(false);
    expect(can(sa, 'account.transfer', ownUser)).toBe(true);
  });

  it('no self harm: nobody disables or deletes their own account', () => {
    const self: Target = { id: 'sa1', role: 'SUPER_ADMIN' };
    expect(can(sa, 'account.disable', self)).toBe(false);
    expect(can(sa, 'account.delete', self)).toBe(false);
  });

  it('Super admin accounts are never deleted; others cannot be reset', () => {
    expect(can(sa, 'account.delete', otherSuper)).toBe(false);
    expect(can(sa, 'account.resetPassword', otherSuper)).toBe(false);
    expect(can(sa, 'account.disable', otherSuper)).toBe(true);
  });

  it('cohorts: the Super admin creates and edits them', () => {
    expect(can(sa, 'cohort.create')).toBe(true);
    expect(can(sa, 'cohort.edit', { role: 'USER', ownerAdminId: 'sa1' })).toBe(true);
    expect(can(ad, 'cohort.create')).toBe(false);
  });
});
