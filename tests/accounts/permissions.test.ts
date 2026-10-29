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

const ownUser: Target = { id: 'u1', role: 'USER', ownerAdminId: 'ad1', cohortOwnerId: 'ad1' };
const otherUser: Target = { id: 'u2', role: 'USER', ownerAdminId: 'ad2', cohortOwnerId: 'ad2' };
const otherAdmin: Target = { id: 'ad2', role: 'ADMIN' };
const otherSuper: Target = { id: 'sa2', role: 'SUPER_ADMIN' };

describe('permission matrix (module 19 4.2)', () => {
  it('Users can do nothing', () => {
    for (const action of ACCOUNT_ACTIONS) expect(can(us, action, ownUser)).toBe(false);
  });

  it('only a Super admin opens settings and edits policy', () => {
    expect(can(sa, 'policy.edit')).toBe(true);
    expect(can(ad, 'policy.edit')).toBe(false);
  });

  it('create: Super admin any role, Admin only Users', () => {
    for (const role of ['SUPER_ADMIN', 'ADMIN', 'USER'] as Level[]) {
      expect(can(sa, 'account.create', { role })).toBe(true);
    }
    expect(can(ad, 'account.create', { role: 'USER' })).toBe(true);
    expect(can(ad, 'account.create', { role: 'ADMIN' })).toBe(false);
    expect(can(ad, 'account.create', { role: 'SUPER_ADMIN' })).toBe(false);
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
  ] as const)('%s: Admin on own Users only', (action) => {
    expect(can(ad, action, ownUser)).toBe(true);
    expect(can(ad, action, otherUser)).toBe(false);
    expect(can(ad, action, otherAdmin)).toBe(false);
    expect(can(ad, action, otherSuper)).toBe(false);
  });

  it('an Admin can view and sign out their own row, nothing else on it', () => {
    const self: Target = { id: 'ad1', role: 'ADMIN' };
    expect(can(ad, 'account.view', self)).toBe(true);
    expect(can(ad, 'account.revokeSessions', self)).toBe(true);
    for (const a of [
      'account.disable',
      'account.delete',
      'account.resetPassword',
      'account.changeRole',
    ] as const) {
      expect(can(ad, a, self)).toBe(false);
    }
  });

  it('role change and transfer are Super admin only; never on self', () => {
    expect(can(sa, 'account.changeRole', ownUser)).toBe(true);
    expect(can(sa, 'account.changeRole', { id: 'sa1', role: 'SUPER_ADMIN' })).toBe(false);
    expect(can(ad, 'account.changeRole', ownUser)).toBe(false);
    expect(can(ad, 'account.transfer', ownUser)).toBe(false);
    expect(can(sa, 'account.transfer', otherAdmin)).toBe(true);
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
    expect(can(sa, 'account.delete', otherAdmin)).toBe(true);
    expect(can(sa, 'account.resetPassword', otherAdmin)).toBe(true);
  });

  it('cohorts: Admin edits own cohorts only', () => {
    expect(can(ad, 'cohort.create')).toBe(true);
    expect(can(ad, 'cohort.edit', { role: 'USER', ownerAdminId: 'ad1' })).toBe(true);
    expect(can(ad, 'cohort.edit', { role: 'USER', ownerAdminId: 'ad2' })).toBe(false);
  });
});
