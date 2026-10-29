import 'server-only';
// View checks for pages (routes.md 2 and 5.3). A person below the page's view code gets the 404 page in place, the
// same as a missing entity, so `REPORTING_ONLY` sees 404 on every non-reporting route (AC-01-25).
import { notFound, redirect } from 'next/navigation';
import { isReadOnlyView } from '@/lib/rbac/can';
import type { SessionUser } from '@/lib/auth/types';
import { canView } from '@/lib/nav/trees';
import type { ViewCode } from '@/lib/routes/route-table';
import { getViewer } from './resolve';
import type { ViewerInfo } from './types';

/** The signed in person, else the login page. */
export async function requireViewer(): Promise<SessionUser> {
  const user = await getViewer();
  if (!user) redirect('/sim/login');
  return user;
}

/** Render the 404 page unless the viewer's DV360 level reaches `code`. */
export async function requireView(code: ViewCode): Promise<SessionUser> {
  const user = await requireViewer();
  if (code !== 'PUBLIC' && code !== 'ANY' && !canView(user.dvRole, code)) notFound();
  return user;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '?';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return `${first}${last}`.toUpperCase();
}

export function toViewerInfo(user: SessionUser): ViewerInfo {
  const limitedAccess = user.dvRole === 'READ_ONLY' || user.dvRole === 'PARTNER_CLIENT';
  return {
    name: user.name,
    initials: initials(user.name),
    appRole: user.appRole,
    dvRole: user.dvRole,
    limitedAccess,
    readOnly: limitedAccess || user.dvRole === 'REPORTING_ONLY' || isReadOnlyView(user),
    viewAs: user.viewAs ? { name: user.name, actAs: user.viewAs.actAs } : null,
  };
}
