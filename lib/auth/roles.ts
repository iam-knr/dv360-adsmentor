// One map between the database enum and the session values (RC-016, RC-068). Edge safe: no runtime imports.
import type { AppRole, DvRole } from './types';

/**
 * The database enum. `ADMIN` is a retired level (ADM-FIX: only a Super admin and students exist). The value stays in
 * the enum because dropping it needs a table rewrite; no code creates it and no session can carry it.
 */
export type DbAppRole = 'USER' | 'ADMIN' | 'SUPER_ADMIN';

export const APP_ROLES: readonly AppRole[] = ['user', 'super_admin'];

/** The retired level. Sign in refuses it and the account lists hide it. */
export const RETIRED_DB_ROLE: DbAppRole = 'ADMIN';

export function isRetiredRole(role: DbAppRole): boolean {
  return role === RETIRED_DB_ROLE;
}

/** Session value of a database role, or null for the retired level (it has no session). */
export function sessionRoleOrNull(role: DbAppRole): AppRole | null {
  if (role === 'USER') return 'user';
  if (role === 'SUPER_ADMIN') return 'super_admin';
  return null;
}

export function toSessionRole(role: DbAppRole): AppRole {
  const r = sessionRoleOrNull(role);
  if (!r) throw new Error('RETIRED_ROLE');
  return r;
}

export function toDbRole(role: AppRole): DbAppRole {
  return role === 'super_admin' ? 'SUPER_ADMIN' : 'USER';
}

export function isAppRole(value: unknown): value is AppRole {
  return value === 'user' || value === 'super_admin';
}

/** DV360 role a person gets on a sandbox by default (RC-047, module 19 4.1). */
export function defaultDvRole(role: AppRole): DvRole {
  return role === 'user' ? 'STANDARD' : 'ADMIN';
}

/** Where a Super admin lands after sign in (module 19 4.1). */
export const SUPER_ADMIN_LANDING = '/manage';

/**
 * Where a person lands after sign in. A student goes to `/sim/welcome`, which shows the sandbox build and then opens the
 * sandbox home; `/` resolves the sandbox home directly (lib/scope/home.ts).
 */
export function landingFor(role: AppRole): string {
  return role === 'super_admin' ? SUPER_ADMIN_LANDING : '/sim/welcome';
}
