// DV360 access levels and what each may do (data-model 5.1 "Role, Permission, RolePermission"; routes.md 2;
// RC-047, RC-048). P3-05a kept these as seed constants instead of tables, so the matrix lives here, in code.
import type { DvRole } from '@/lib/auth/types';

export const PERMISSION_KEYS = [
  'entity.read',
  'entity.write',
  'creative.write',
  'audience.write',
  'resource.write',
  'report.read',
  'report.write',
  'sdf.upload',
  'bulk.edit',
  'user.manage',
  'partner.settings.write',
  'billing.read',
] as const;
export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export const DV_ROLES: readonly DvRole[] = [
  'ADMIN',
  'STANDARD',
  'READ_ONLY',
  'REPORTING_ONLY',
  'PARTNER_CLIENT',
  'CREATIVE',
];

const STANDARD: PermissionKey[] = [
  'entity.read',
  'entity.write',
  'creative.write',
  'audience.write',
  'resource.write',
  'report.read',
  'report.write',
  'sdf.upload',
  'bulk.edit',
];

export const ROLE_PERMISSIONS: Record<DvRole, readonly PermissionKey[]> = {
  ADMIN: PERMISSION_KEYS,
  STANDARD,
  READ_ONLY: ['entity.read', 'report.read'],
  REPORTING_ONLY: ['report.read', 'report.write'],
  PARTNER_CLIENT: ['entity.read', 'report.read'],
  CREATIVE: ['entity.read', 'creative.write'],
};

export function hasPermission(role: DvRole, key: PermissionKey): boolean {
  return ROLE_PERMISSIONS[role].includes(key);
}

/** Roles that show the grey "Limited Access" chip next to page titles (routes.md 2). */
export function showsLimitedAccessChip(role: DvRole): boolean {
  return role === 'READ_ONLY' || role === 'PARTNER_CLIENT';
}

/** REPORTING_ONLY sees only Reports in the left nav; any other DV360 route renders the 404 page. */
export function isReportingOnly(role: DvRole): boolean {
  return role === 'REPORTING_ONLY';
}
