'use server';

import { revalidatePath } from 'next/cache';
import { AccountError } from '@/lib/accounts/rules';
import type { Actor } from '@/lib/accounts/permissions';
import { toDbRole } from '@/lib/auth/roles';
import { UnauthenticatedError, requireUser } from '@/lib/auth/session';
import { ServiceFailure } from '@/lib/campaigns/service-kit';
import { createAnnouncement, deleteAnnouncement, type AnnouncementInput } from '@/lib/history/notifications';
import { auditAnnouncement } from './announcements';
import { decideCertificate } from './certificates';
import {
  addStudents,
  deactivateStudent,
  parseRosterCsv,
  removeStudent,
  resetStudentPassword,
  type AddStudentsResult,
  type RosterInput,
} from './roster';
import { InstructorError } from './rules';
import { createSandboxFor, resetSandboxes, type ResetRequest, type SandboxOutcome } from './sandboxes';
import {
  closeClassNow,
  createAccessWindow,
  deleteAccessWindow,
  openClassNow,
  updateAccessWindow,
  type WindowInput,
  type WindowPatch,
} from './windows';

// Thin server actions for the console. The actor always comes from the session, never from the body. A password only
// leaves the server in the result of the action that made it, once, and is never put in a log or a revalidated path.
export type Result<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string; rows?: { row: number; message: string }[] };

interface Who {
  actor: Actor;
  name: string;
  email: string;
}

async function who(): Promise<Who> {
  const user = await requireUser();
  const p = user.actor ?? user;
  const role = toDbRole(p.appRole);
  if (role === 'USER') throw new InstructorError('FORBIDDEN');
  return { actor: { id: p.id, role }, name: p.name, email: p.email };
}

async function run<T>(paths: string[], fn: (w: Who) => Promise<T>): Promise<Result<T>> {
  try {
    const w = await who();
    const data = await fn(w);
    for (const p of paths) revalidatePath(p, 'layout');
    return { ok: true, data };
  } catch (err) {
    if (err instanceof UnauthenticatedError)
      return { ok: false, error: 'Your session expired. Sign in again.' };
    if (err instanceof InstructorError)
      return { ok: false, error: err.message, code: err.code, ...(err.rows ? { rows: err.rows } : {}) };
    if (err instanceof AccountError) return { ok: false, error: err.message, code: err.code };
    if (err instanceof ServiceFailure) {
      return { ok: false, error: err.issues[0]?.message ?? "You don't have access to this.", code: err.code };
    }
    return { ok: false, error: 'Something went wrong. Try again.' };
  }
}

const CONSOLE = ['/sim/instructor'];

// Access windows
export async function openClassNowAction(classId: string, hours?: number) {
  return run(CONSOLE, (w) =>
    openClassNow(w.actor, classId, { hours }).then((r) => ({ closesAt: r.closesAt.toISOString() })),
  );
}
export async function closeClassNowAction(classId: string) {
  return run(CONSOLE, (w) => closeClassNow(w.actor, classId));
}
export async function createWindowAction(input: WindowInput) {
  return run(CONSOLE, (w) => createAccessWindow(w.actor, input));
}
export async function updateWindowAction(id: string, patch: WindowPatch, scope: 'THIS' | 'SERIES') {
  return run(CONSOLE, (w) => updateAccessWindow(w.actor, id, patch, scope));
}
export async function deleteWindowAction(id: string, scope: 'THIS' | 'SERIES') {
  return run(CONSOLE, (w) => deleteAccessWindow(w.actor, id, scope));
}

// Roster
export async function addStudentsAction(classId: string, students: RosterInput[]) {
  return run<AddStudentsResult>(CONSOLE, (w) => addStudents(w.actor, classId, students));
}

export interface ImportResult extends AddStudentsResult {
  errors: { row: number; message: string }[];
}
export async function importRosterAction(classId: string, csv: string) {
  return run<ImportResult>(CONSOLE, async (w) => {
    const parsed = parseRosterCsv(csv);
    if (parsed.students.length === 0) {
      throw new InstructorError('SIM-008', undefined, parsed.errors);
    }
    const res = await addStudents(w.actor, classId, parsed.students);
    return { ...res, errors: parsed.errors };
  });
}
export async function resetStudentPasswordAction(userId: string) {
  return run(CONSOLE, (w) => resetStudentPassword(w.actor, userId));
}
export async function deactivateStudentAction(userId: string) {
  return run(CONSOLE, (w) => deactivateStudent(w.actor, userId));
}
export async function removeStudentAction(classId: string, userId: string) {
  return run(CONSOLE, (w) => removeStudent(w.actor, classId, userId));
}

// Sandboxes
export async function createSandboxAction(classId: string, userId: string) {
  return run<SandboxOutcome>(CONSOLE, (w) => createSandboxFor(w.actor, classId, userId));
}
export async function resetSandboxesAction(req: ResetRequest) {
  return run(CONSOLE, (w) => resetSandboxes(w.actor, req));
}

// Announcements (create and delete are P4-12's services; the audit row is added here)
export async function createAnnouncementAction(input: AnnouncementInput) {
  return run(CONSOLE, async (w) => {
    const user = await requireUser();
    const row = await createAnnouncement(user, input);
    await auditAnnouncement(w.actor, 'ANNOUNCEMENT_CREATED', input.classId, row.id);
    return row;
  });
}
export async function deleteAnnouncementAction(id: string, classId?: string) {
  return run(CONSOLE, async (w) => {
    const user = await requireUser();
    await deleteAnnouncement(user, id);
    await auditAnnouncement(w.actor, 'ANNOUNCEMENT_DELETED', classId, id);
    return null;
  });
}

// Policy certificate requests (module 03 T09)
export async function decideCertificateAction(
  certId: string,
  decision: 'APPROVED' | 'REJECTED',
  reason?: string,
) {
  return run(CONSOLE, (w) =>
    decideCertificate(w.actor, certId, decision, reason, w.name, w.email),
  );
}
