// Which simulator areas each account level may open (routes.md 5.3 rule 4, module 19 2.1). Edge safe.
// Two levels exist (ADM-FIX): only a Super admin opens /manage; students never do.
import type { AppRole } from '@/lib/auth/types';

export type Area = 'manage' | 'manage_settings';

function under(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** The guarded area a path belongs to, or null when the path has no role rule of its own. */
export function areaForPath(pathname: string): Area | null {
  if (under(pathname, '/manage/settings')) return 'manage_settings';
  if (under(pathname, '/manage')) return 'manage';
  return null;
}

export function canOpenArea(role: AppRole, _area: Area): boolean {
  return role === 'super_admin';
}
