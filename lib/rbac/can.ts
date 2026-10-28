// `can()` and `assertAccess()` (module 02 section 4, routes.md 2). The view check happens in the context layouts;
// the write check happens in every service and action, so a hand made POST cannot bypass the UI (routes.md 2).
import type { SessionUser } from '@/lib/auth/types';
import { hasPermission, PERMISSION_KEYS, type PermissionKey } from './permissions';

/** The four action classes of build-plan 4.6, plus `report_view`, or any permission key such as `creative.write`. */
export type ActionClass = 'view' | 'write' | 'user_admin' | 'report_build' | 'report_view';
export type Action = ActionClass | PermissionKey | (string & {});

export interface Scope {
  /** Page family, for example 'reporting', 'bulk-status', 'creatives', 'audiences', 'resources', 'bulk', 'sdf'. */
  area?: string;
  sandboxId?: string;
  [key: string]: string | undefined;
}

const WRITE_PERMISSION_BY_AREA: Record<string, PermissionKey> = {
  creatives: 'creative.write',
  audiences: 'audience.write',
  resources: 'resource.write',
  bulk: 'bulk.edit',
  sdf: 'sdf.upload',
};

/** Which permission an action needs on a page family. Null for an action nobody knows (denied). */
export function requiredPermission(action: Action, area?: string): PermissionKey | null {
  if ((PERMISSION_KEYS as readonly string[]).includes(action)) return action as PermissionKey;
  switch (action) {
    case 'view':
      return area === 'reporting' ? 'report.read' : 'entity.read';
    case 'write':
      return (area && WRITE_PERMISSION_BY_AREA[area]) || 'entity.write';
    case 'user_admin':
      return 'user.manage';
    case 'report_build':
      return 'report.write';
    case 'report_view':
      return 'report.read';
    default:
      return null;
  }
}

const READ_ONLY_PERMISSIONS: ReadonlySet<PermissionKey> = new Set(['entity.read', 'report.read']);

export function can(user: SessionUser, action: Action, scope: Scope = {}): boolean {
  const permission = requiredPermission(action, scope.area);
  if (!permission) return false;

  // can() never lets a person act on a sandbox other than the one they are working in. An Admin reaches a student's
  // sandbox through view-as (the session then carries that student's sandboxId); who may do that is decided in
  // lib/auth/view-as.ts, not here. Without a sandbox of their own, only an Admin or Super admin gets past a sandbox scope.
  if (scope.sandboxId) {
    if (user.sandboxId ? user.sandboxId !== scope.sandboxId : user.appRole === 'user') return false;
  }

  // View-as is read only until "Act as student" is switched on (module 18 2.4).
  if (user.viewAs && !user.viewAs.actAs && !READ_ONLY_PERMISSIONS.has(permission)) return false;

  // REPORTING_ONLY: only reporting routes and their own bulk jobs (routes.md 2).
  if (user.dvRole === 'REPORTING_ONLY' && permission === 'entity.read') {
    return scope.area === 'reporting' || scope.area === 'bulk-status';
  }
  return hasPermission(user.dvRole, permission);
}

export class ForbiddenError extends Error {
  readonly code = 'FORBIDDEN';
  constructor() {
    super('FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}

export function assertAccess(user: SessionUser, action: Action, scope: Scope = {}): void {
  if (!can(user, action, scope)) throw new ForbiddenError();
}

/** True while an admin looks at a student's account without "Act as student": nothing may be saved. */
export function isReadOnlyView(user: Pick<SessionUser, 'viewAs'>): boolean {
  return Boolean(user.viewAs && !user.viewAs.actAs);
}

export function viewOnlyMessage(user: Pick<SessionUser, 'name'>): string {
  return `You are viewing as ${user.name}. Read only. Switch on Act as student to make changes.`;
}
