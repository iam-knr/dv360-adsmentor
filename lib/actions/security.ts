'use server';

import { revalidatePath } from 'next/cache';
import {
  bulkSecurity,
  markSecurityEventsSeen,
  restoreAccess,
  setScreenshotsAllowed,
  type SecurityBulkAction,
} from '@/lib/accounts/screenshot-guard';
import type { Actor } from '@/lib/accounts/permissions';
import { AccountError } from '@/lib/accounts/rules';
import { toDbRole } from '@/lib/auth/roles';
import { UnauthenticatedError, requireUser } from '@/lib/auth/session';

// Server actions of the screenshot guard (Super admin only). The actor always comes from the session.
type Result<T = void> = { ok: true; data: T } | { ok: false; error: string; code?: string };

async function run<T>(fn: (actor: Actor) => Promise<T>): Promise<Result<T>> {
  try {
    const user = await requireUser();
    const who = user.actor ?? user;
    const role = toDbRole(who.appRole);
    if (role !== 'SUPER_ADMIN') throw new AccountError('FORBIDDEN');
    const data = await fn({ id: who.id, role });
    revalidatePath('/manage', 'layout');
    return { ok: true, data };
  } catch (err) {
    if (err instanceof UnauthenticatedError)
      return { ok: false, error: 'Your session expired. Sign in again.' };
    if (err instanceof AccountError) return { ok: false, error: err.message, code: err.code };
    return { ok: false, error: 'Something went wrong. Try again.' };
  }
}

export async function setScreenshotsAllowedAction(id: string, allowed: boolean) {
  return run((actor) => setScreenshotsAllowed(actor, id, allowed));
}
export async function restoreAccessAction(id: string) {
  return run((actor) => restoreAccess(actor, id));
}
export async function bulkSecurityAction(ids: string[], action: SecurityBulkAction) {
  return run((actor) => bulkSecurity(actor, ids, action));
}
export async function markSecuritySeenAction() {
  return run((actor) => markSecurityEventsSeen(actor));
}
