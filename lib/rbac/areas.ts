// Which simulator areas each account level may open (routes.md 5.3 rule 4, module 19 2.1). Edge safe.
import type { AppRole } from '@/lib/auth/types';
import { atLeast } from '@/lib/auth/roles';

export type Area = 'instructor' | 'admin' | 'manage' | 'manage_settings';

const MIN_ROLE: Record<Area, AppRole> = {
  instructor: 'admin',
  admin: 'super_admin',
  manage: 'admin',
  manage_settings: 'super_admin',
};

function under(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** The guarded area a path belongs to, or null when the path has no role rule of its own. */
export function areaForPath(pathname: string): Area | null {
  if (under(pathname, '/sim/admin')) return 'admin';
  if (under(pathname, '/sim/instructor')) return 'instructor';
  if (under(pathname, '/manage/settings')) return 'manage_settings';
  if (under(pathname, '/manage')) return 'manage';
  return null;
}

export function canOpenArea(role: AppRole, area: Area): boolean {
  return atLeast(role, MIN_ROLE[area]);
}
