'use server';

import { revalidatePath } from 'next/cache';
import {
  archiveCohort,
  bulkAccounts,
  createAccount,
  createCohort,
  deleteAccount,
  resetPassword,
  rebuildSandbox,
  setSandboxClockRunning,
  restoreAccount,
  retrySandbox,
  revokeSessions,
  setAccountStatus,
  unlockAccount,
  updateCohort,
  type BulkAction,
  type PasswordInput,
} from '@/lib/accounts/service';
import type { Actor } from '@/lib/accounts/permissions';
import { AccountError } from '@/lib/accounts/rules';
import { generatePassword } from '@/lib/auth/password';
import { toDbRole } from '@/lib/auth/roles';
import { UnauthenticatedError, requireUser } from '@/lib/auth/session';

// Thin server actions (module 19 4.7). The actor always comes from the session, never from the body. Next.js checks
// the Origin header of server actions against Host (T8). A password only leaves the server in the result of the
// action that made it, once.
export type Result<T = void> = { ok: true; data: T } | { ok: false; error: string; code?: string };

async function actorFromSession(): Promise<Actor> {
  const user = await requireUser();
  const who = user.actor ?? user;
  const role = toDbRole(who.appRole);
  if (role !== 'SUPER_ADMIN') throw new AccountError('FORBIDDEN');
  return { id: who.id, role };
}

async function run<T>(fn: (actor: Actor) => Promise<T>): Promise<Result<T>> {
  try {
    const actor = await actorFromSession();
    const data = await fn(actor);
    revalidatePath('/manage', 'layout');
    return { ok: true, data };
  } catch (err) {
    if (err instanceof UnauthenticatedError)
      return { ok: false, error: 'Your session expired. Sign in again.' };
    if (err instanceof AccountError) return { ok: false, error: err.message, code: err.code };
    return { ok: false, error: 'Something went wrong. Try again.' };
  }
}

export interface CreateAccountForm {
  email: string;
  name: string;
  role: 'SUPER_ADMIN' | 'USER';
  cohortId?: string;
  notes?: string;
  mustChangePassword?: boolean;
  accessStartsAt?: string | null;
  accessEndsAt?: string | null;
  password: PasswordInput;
}

const date = (v?: string | null) => (v ? new Date(v) : null);

export async function createAccountAction(form: CreateAccountForm) {
  return run(async (actor) => {
    const r = await createAccount(actor, {
      ...form,
      accessStartsAt: date(form.accessStartsAt),
      accessEndsAt: date(form.accessEndsAt),
    });
    return { id: r.id, email: r.email, initialPassword: r.initialPassword };
  });
}

/** The "Generate" button: returns one value and stores nothing. */
export async function generateAccountPassword(): Promise<Result<{ value: string }>> {
  return run(() => Promise.resolve({ value: generatePassword() }));
}

export async function setAccountStatusAction(id: string, event: 'disable' | 'enable') {
  return run((actor) => setAccountStatus(actor, id, event));
}
export async function unlockAccountAction(id: string) {
  return run((actor) => unlockAccount(actor, id));
}
export async function rebuildSandboxAction(id: string) {
  return run((actor) => rebuildSandbox(actor, id));
}

export async function setSandboxClockAction(id: string, running: boolean) {
  return run((actor) => setSandboxClockRunning(actor, id, running));
}

export async function retrySandboxAction(id: string) {
  return run((actor) => retrySandbox(actor, id));
}
export async function revokeSessionsAction(id: string) {
  return run((actor) => revokeSessions(actor, id));
}
export async function resetPasswordAction(
  id: string,
  req: { password: PasswordInput; mustChangePassword?: boolean },
) {
  return run((actor) => resetPassword(actor, id, req));
}
export async function deleteAccountAction(id: string, req: { confirm: string }) {
  return run((actor) => deleteAccount(actor, id, req));
}
export async function restoreAccountAction(id: string) {
  return run((actor) => restoreAccount(actor, id));
}
export async function bulkAccountsAction(ids: string[], action: BulkAction) {
  return run((actor) => bulkAccounts(actor, ids, action));
}
export async function createCohortAction(input: {
  name: string;
  timeZone?: string;
  capacity?: number;
}) {
  return run((actor) => createCohort(actor, input));
}
export async function updateCohortAction(id: string, input: { name?: string; capacity?: number }) {
  return run((actor) => updateCohort(actor, id, input));
}
export async function archiveCohortAction(id: string) {
  return run((actor) => archiveCohort(actor, id));
}
