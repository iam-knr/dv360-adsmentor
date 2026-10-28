// One map between the database enum and the session values (RC-016, RC-068). Edge safe: no runtime imports.
import type { AppRole, DvRole } from './types';

export type DbAppRole = 'USER' | 'ADMIN' | 'SUPER_ADMIN';

export const APP_ROLES: readonly AppRole[] = ['user', 'admin', 'super_admin'];

const TO_SESSION: Record<DbAppRole, AppRole> = {
  USER: 'user',
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin',
};
const TO_DB: Record<AppRole, DbAppRole> = {
  user: 'USER',
  admin: 'ADMIN',
  super_admin: 'SUPER_ADMIN',
};
const RANK: Record<AppRole, number> = { user: 0, admin: 1, super_admin: 2 };

export function toSessionRole(role: DbAppRole): AppRole {
  return TO_SESSION[role];
}

export function toDbRole(role: AppRole): DbAppRole {
  return TO_DB[role];
}

export function isAppRole(value: unknown): value is AppRole {
  return value === 'user' || value === 'admin' || value === 'super_admin';
}

/** True when `role` is at least `min` in the SUPER_ADMIN > ADMIN > USER hierarchy. */
export function atLeast(role: AppRole, min: AppRole): boolean {
  return RANK[role] >= RANK[min];
}

/** DV360 role a person gets on a sandbox by default (RC-047, module 19 4.1). */
export function defaultDvRole(role: AppRole): DvRole {
  return role === 'user' ? 'STANDARD' : 'ADMIN';
}

/**
 * Where a person lands after sign in (module 19 4.1).
 * Until P3-02b ships `/manage`, a Super admin lands on `/sim/admin` (a page that links to it), so the first
 * production sign in is not a 404. P3-02b flips SUPER_ADMIN_LANDING to '/manage/accounts'.
 */
export const SUPER_ADMIN_LANDING = '/sim/admin';

export function landingFor(role: AppRole): string {
  if (role === 'super_admin') return SUPER_ADMIN_LANDING;
  if (role === 'admin') return '/sim/instructor';
  return '/sim/welcome';
}
