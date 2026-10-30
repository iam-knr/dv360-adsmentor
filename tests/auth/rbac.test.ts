import { describe, expect, it } from 'vitest';
import type { DvRole, SessionUser } from '@/lib/auth/types';
import {
  assertAccess,
  can,
  ForbiddenError,
  isReadOnlyView,
  type ActionClass,
} from '@/lib/rbac/can';
import {
  DV_ROLES,
  PERMISSION_KEYS,
  ROLE_PERMISSIONS,
  isReportingOnly,
  showsLimitedAccessChip,
} from '@/lib/rbac/permissions';
import { areaForPath, canOpenArea } from '@/lib/rbac/areas';

function user(dvRole: DvRole, over: Partial<SessionUser> = {}): SessionUser {
  return {
    id: 'u1',
    email: 'u1@example.test',
    name: 'U One',
    appRole: 'user',
    dvRole,
    sandboxId: 'sb1',
    ...over,
  };
}

// level x action class, with the page family where it matters (routes.md 2, RC-047, RC-048).
// y = allowed, n = denied
const TABLE: Array<[DvRole, ActionClass, string | undefined, boolean]> = [
  // ADMIN: everything
  ['ADMIN', 'view', undefined, true],
  ['ADMIN', 'write', undefined, true],
  ['ADMIN', 'user_admin', undefined, true],
  ['ADMIN', 'report_build', 'reporting', true],
  ['ADMIN', 'report_view', 'reporting', true],
  // STANDARD: everything except user admin (RC-047, RC-048)
  ['STANDARD', 'view', undefined, true],
  ['STANDARD', 'write', undefined, true],
  ['STANDARD', 'user_admin', undefined, false],
  ['STANDARD', 'report_build', 'reporting', true],
  ['STANDARD', 'report_view', 'reporting', true],
  // READ_ONLY: view all, open and download reports, no write, no report building
  ['READ_ONLY', 'view', undefined, true],
  ['READ_ONLY', 'view', 'reporting', true],
  ['READ_ONLY', 'write', undefined, false],
  ['READ_ONLY', 'user_admin', undefined, false],
  ['READ_ONLY', 'report_build', 'reporting', false],
  ['READ_ONLY', 'report_view', 'reporting', true],
  // REPORTING_ONLY: reporting routes and own bulk jobs only
  ['REPORTING_ONLY', 'view', undefined, false],
  ['REPORTING_ONLY', 'view', 'reporting', true],
  ['REPORTING_ONLY', 'view', 'bulk-status', true],
  ['REPORTING_ONLY', 'write', undefined, false],
  ['REPORTING_ONLY', 'user_admin', undefined, false],
  ['REPORTING_ONLY', 'report_build', 'reporting', true],
  ['REPORTING_ONLY', 'report_view', 'reporting', true],
  // PARTNER_CLIENT: like READ_ONLY
  ['PARTNER_CLIENT', 'view', undefined, true],
  ['PARTNER_CLIENT', 'write', undefined, false],
  ['PARTNER_CLIENT', 'user_admin', undefined, false],
  ['PARTNER_CLIENT', 'report_build', 'reporting', false],
  ['PARTNER_CLIENT', 'report_view', 'reporting', true],
  // CREATIVE: creatives and a read of parents
  ['CREATIVE', 'view', undefined, true],
  ['CREATIVE', 'view', 'reporting', false],
  ['CREATIVE', 'write', undefined, false],
  ['CREATIVE', 'write', 'creatives', true],
  ['CREATIVE', 'user_admin', undefined, false],
  ['CREATIVE', 'report_build', 'reporting', false],
  ['CREATIVE', 'report_view', 'reporting', false],
];

describe('can(): DV360 level x action class', () => {
  it.each(TABLE)('%s %s (%s) -> %s', (role, action, area, allowed) => {
    expect(can(user(role), action, { area })).toBe(allowed);
    if (allowed) expect(() => assertAccess(user(role), action, { area })).not.toThrow();
    else expect(() => assertAccess(user(role), action, { area })).toThrow(ForbiddenError);
  });

  it('covers every level and every action class', () => {
    const covered = new Set(TABLE.map(([r, a]) => `${r}/${a}`));
    for (const role of DV_ROLES) {
      for (const action of ['view', 'write', 'user_admin', 'report_build', 'report_view']) {
        expect(covered.has(`${role}/${action}`), `${role}/${action}`).toBe(true);
      }
    }
  });

  it('page families map to their own write permission', () => {
    expect(can(user('STANDARD'), 'write', { area: 'audiences' })).toBe(true);
    expect(can(user('CREATIVE'), 'write', { area: 'audiences' })).toBe(false);
    expect(can(user('READ_ONLY'), 'write', { area: 'bulk' })).toBe(false);
    expect(can(user('STANDARD'), 'write', { area: 'sdf' })).toBe(true);
  });

  it('accepts permission keys as actions and denies unknown actions', () => {
    expect(can(user('STANDARD'), 'creative.write')).toBe(true);
    expect(can(user('READ_ONLY'), 'creative.write')).toBe(false);
    expect(can(user('STANDARD'), 'partner.settings.write')).toBe(false);
    expect(can(user('ADMIN'), 'billing.read')).toBe(true);
    expect(can(user('ADMIN'), 'launch.rockets')).toBe(false);
  });

  it('never lets a User reach another sandbox', () => {
    expect(can(user('STANDARD'), 'view', { sandboxId: 'sb1' })).toBe(true);
    expect(can(user('STANDARD'), 'view', { sandboxId: 'sb2' })).toBe(false);
    expect(can(user('ADMIN', { sandboxId: undefined }), 'view', { sandboxId: 'sb2' })).toBe(false);
    expect(
      can(user('ADMIN', { appRole: 'super_admin', sandboxId: undefined }), 'view', {
        sandboxId: 'sb2',
      }),
    ).toBe(true);
  });

  it('a User without a sandbox cannot act on any sandbox', () => {
    expect(can(user('STANDARD', { sandboxId: undefined }), 'view', { sandboxId: 'sb1' })).toBe(
      false,
    );
    expect(can(user('STANDARD', { sandboxId: undefined }), 'view', {})).toBe(true);
  });

  it('matches the data-model 5.1 matrix', () => {
    expect([...ROLE_PERMISSIONS.ADMIN]).toEqual([...PERMISSION_KEYS]);
    expect(ROLE_PERMISSIONS.STANDARD).not.toContain('user.manage');
    expect(ROLE_PERMISSIONS.STANDARD).not.toContain('partner.settings.write');
    expect(ROLE_PERMISSIONS.STANDARD).not.toContain('billing.read');
    expect(ROLE_PERMISSIONS.READ_ONLY).toEqual(['entity.read', 'report.read']);
    expect(ROLE_PERMISSIONS.REPORTING_ONLY).toEqual(['report.read', 'report.write']);
    expect(ROLE_PERMISSIONS.CREATIVE).toEqual(['entity.read', 'creative.write']);
  });
});

describe('UI hints', () => {
  it('Limited Access chip for READ_ONLY and PARTNER_CLIENT (AC-01-26)', () => {
    expect(DV_ROLES.filter(showsLimitedAccessChip)).toEqual(['READ_ONLY', 'PARTNER_CLIENT']);
  });
  it('REPORTING_ONLY shows Reports only (AC-01-25)', () => {
    expect(DV_ROLES.filter(isReportingOnly)).toEqual(['REPORTING_ONLY']);
  });
});

describe('view-as is read only until "Act as student" (M18-AC13)', () => {
  const viewing = (actAs: boolean) => user('STANDARD', { viewAs: { userId: 'u1', actAs } });
  it('allows reads and blocks every write while read only', () => {
    expect(can(viewing(false), 'view')).toBe(true);
    expect(can(viewing(false), 'report_view', { area: 'reporting' })).toBe(true);
    expect(can(viewing(false), 'write')).toBe(false);
    expect(can(viewing(false), 'report_build', { area: 'reporting' })).toBe(false);
    expect(can(viewing(false), 'creative.write')).toBe(false);
    expect(isReadOnlyView(viewing(false))).toBe(true);
  });
  it('allows what the student may do once acting', () => {
    expect(can(viewing(true), 'write')).toBe(true);
    expect(can(viewing(true), 'user_admin')).toBe(false);
    expect(isReadOnlyView(viewing(true))).toBe(false);
    expect(isReadOnlyView(user('STANDARD'))).toBe(false);
  });
});

describe('simulator areas (routes.md 5.3 rule 4)', () => {
  it.each([
    ['/manage', 'manage'],
    ['/manage/accounts/new', 'manage'],
    ['/manage/cohorts/c1', 'manage'],
    ['/manage/settings', 'manage_settings'],
    ['/sim/me', null],
    ['/sim/instructor', null], // the instructor and admin areas are gone (ADM-FIX)
    ['/sim/admin', null],
    ['/p/1/home_v3', null],
  ] as const)('%s is area %s', (path, area) => {
    expect(areaForPath(path)).toBe(area);
  });

  it('role x area table: only the Super admin opens /manage', () => {
    const rows: Array<
      [Parameters<typeof canOpenArea>[0], Parameters<typeof canOpenArea>[1], boolean]
    > = [
      ['user', 'manage', false],
      ['user', 'manage_settings', false],
      ['super_admin', 'manage', true],
      ['super_admin', 'manage_settings', true],
    ];
    for (const [role, area, allowed] of rows)
      expect(canOpenArea(role, area), `${role} ${area}`).toBe(allowed);
  });
});
