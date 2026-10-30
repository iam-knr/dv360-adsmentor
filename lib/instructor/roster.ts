import 'server-only';
import type { Actor } from '@/lib/accounts/permissions';
import { AccountError } from '@/lib/accounts/rules';
import { scopedUsers } from '@/lib/accounts/scope';
import {
  createAccount,
  deleteAccount,
  resetPassword,
  setAccountStatus,
} from '@/lib/accounts/service';
import { prisma } from '@/lib/db';
import { writeInstructorAudit } from './audit';
import { InstructorError, MAX_ROSTER_ROWS, SIM } from './rules';
import { loadClass, type Db } from './scope';

// Roster (module 18 4.4, I3). Accounts are created, reset, disabled and removed by lib/accounts (RC-073); this file
// only adds the class view, the CSV parser and the batch loop. Passwords come back once, from the service.

export type SandboxLabel = 'READY' | 'PREPARING' | 'RESETTING' | 'FROZEN' | 'FAILED' | 'NOT CREATED';

export interface RosterRow {
  id: string;
  name: string;
  email: string;
  status: 'ACTIVE' | 'DISABLED' | 'LOCKED' | 'ARCHIVED';
  lastLoginAt: Date | null;
  mustChangePassword: boolean;
  sandbox: SandboxLabel;
  sandboxError: string | null;
  /** Overview of the student's partner with view-as on, when the sandbox exists. */
  viewAsHref: string | null;
}

export function sandboxLabel(
  sb: { status: string; provisionState: string } | null | undefined,
): SandboxLabel {
  if (!sb || sb.status === 'ARCHIVED') return 'NOT CREATED';
  if (sb.provisionState === 'FAILED') return 'FAILED';
  if (sb.status === 'RESETTING') return 'RESETTING';
  if (sb.provisionState !== 'READY') return 'PREPARING';
  return sb.status === 'FROZEN' ? 'FROZEN' : 'READY';
}

export async function getRoster(
  actor: Actor,
  classId: string,
  db: Db = prisma,
): Promise<{ className: string; code: string; capacity: number; rows: RosterRow[] }> {
  const cls = await loadClass(db, actor, classId);
  const users = (await scopedUsers(db, actor).findMany({
    where: { cohortId: classId, appRole: 'USER', status: { not: 'ARCHIVED' } },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      lastLoginAt: true,
      mustChangePassword: true,
    },
  })) as Omit<RosterRow, 'sandbox' | 'sandboxError' | 'viewAsHref'>[];
  const sandboxes = await db.sandbox.findMany({
    where: { classroomId: classId, ownerUserId: { in: users.map((u) => u.id) } },
    select: {
      id: true,
      ownerUserId: true,
      status: true,
      provisionState: true,
      provisionError: true,
    },
  });
  const partners = await db.partner.findMany({
    where: { sandboxId: { in: sandboxes.map((s) => s.id) } },
    select: { sandboxId: true, publicId: true },
  });
  const partnerOf = new Map(partners.map((p) => [p.sandboxId, p.publicId.toString()]));
  const byOwner = new Map(sandboxes.map((s) => [s.ownerUserId, s]));
  return {
    className: cls.name,
    code: cls.code,
    capacity: cls.capacity,
    rows: users.map((u) => {
      const sb = byOwner.get(u.id);
      const partner = sb ? partnerOf.get(sb.id) : undefined;
      return {
        ...u,
        sandbox: sandboxLabel(sb),
        sandboxError: sb?.provisionError ?? null,
        viewAsHref: partner ? `/p/${partner}/home_v3?sim_as=${u.id}` : null,
      };
    }),
  };
}

export interface RosterInput {
  name: string;
  email: string;
}

export interface ParsedRoster {
  students: RosterInput[];
  errors: { row: number; message: string }[];
}

/** Split one CSV line, honouring double quotes. */
function splitLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      out.push(cur);
      cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * `name,email` with a header row (SIM-008): missing columns, over 200 rows and duplicate emails are reported per
 * row, the good rows still parse. The parser is pure so the form can show the rows before anything is created.
 */
export function parseRosterCsv(text: string): ParsedRoster {
  const lines = text
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .filter((l) => l.trim() !== '');
  const errors: ParsedRoster['errors'] = [];
  if (lines.length === 0) return { students: [], errors: [{ row: 1, message: 'The file is empty.' }] };
  const header = splitLine(lines[0]!).map((h) => h.toLowerCase());
  const nameAt = header.indexOf('name');
  const emailAt = header.indexOf('email');
  if (nameAt < 0 || emailAt < 0) {
    return { students: [], errors: [{ row: 1, message: 'Columns needed: name,email.' }] };
  }
  const body = lines.slice(1);
  if (body.length > MAX_ROSTER_ROWS) {
    errors.push({ row: MAX_ROSTER_ROWS + 2, message: `Use ${MAX_ROSTER_ROWS} rows or fewer.` });
  }
  const seen = new Set<string>();
  const students: RosterInput[] = [];
  body.slice(0, MAX_ROSTER_ROWS).forEach((line, i) => {
    const row = i + 2;
    const cells = splitLine(line);
    const name = cells[nameAt] ?? '';
    const email = (cells[emailAt] ?? '').toLowerCase();
    if (!name) return void errors.push({ row, message: 'Enter a name.' });
    if (!EMAIL.test(email)) return void errors.push({ row, message: 'Enter a valid email address.' });
    if (seen.has(email)) return void errors.push({ row, message: 'This email is already in the file.' });
    seen.add(email);
    students.push({ name, email });
  });
  return { students, errors };
}

export interface AddStudentsResult {
  created: { userId: string; name: string; email: string; password: string }[];
  skipped: { email: string; reason: string }[];
}

/**
 * Create the accounts one by one through the account service, each with a generated password (returned once, never
 * stored). A bad row does not stop the others. A full class stops the loop: the rest are reported as skipped.
 */
export async function addStudents(
  actor: Actor,
  classId: string,
  students: RosterInput[],
  db: Db = prisma,
): Promise<AddStudentsResult> {
  const cls = await loadClass(db, actor, classId);
  if (students.length === 0) throw new InstructorError('SIM-008');
  if (students.length > MAX_ROSTER_ROWS) throw new InstructorError('SIM-008');
  const created: AddStudentsResult['created'] = [];
  const skipped: AddStudentsResult['skipped'] = [];
  const seen = new Set<string>();
  let full = false;
  for (const s of students) {
    const email = s.email.trim().toLowerCase();
    if (seen.has(email)) {
      skipped.push({ email, reason: 'Duplicate in this list.' });
      continue;
    }
    seen.add(email);
    if (full) {
      skipped.push({ email, reason: 'The class is full.' });
      continue;
    }
    try {
      const r = await createAccount(
        actor,
        { email, name: s.name, role: 'USER', cohortId: cls.id, password: { mode: 'GENERATE' } },
        db,
      );
      if (r.initialPassword) {
        created.push({ userId: r.id, name: s.name.trim(), email, password: r.initialPassword });
      }
    } catch (err) {
      if (err instanceof AccountError) {
        if (err.code === 'ACC-032') full = true;
        skipped.push({ email, reason: err.message });
      } else throw err;
    }
  }
  await writeInstructorAudit(db, {
    actorUserId: actor.id,
    actorRole: actor.role,
    classroomId: cls.id,
    action: 'ROSTER_ADDED',
    targetType: 'Classroom',
    targetId: cls.id,
    payload: { count: created.length, skipped: skipped.length, cohortName: cls.name },
  });
  return { created, skipped };
}

// The three module 18 actions are aliases of the account service (RC-073). The service checks that the student is in
// the actor's scope, writes the account audit row and ends the student's sessions.
export const resetStudentPassword = (actor: Actor, userId: string, db: Db = prisma) =>
  resetPassword(
    actor,
    userId,
    { password: { mode: 'GENERATE' }, mustChangePassword: true },
    db,
  ).then((r) => ({ tempPassword: r.newPassword }));

export const deactivateStudent = (actor: Actor, userId: string, db: Db = prisma) =>
  setAccountStatus(actor, userId, 'disable', db);

/** "Remove" archives the account and its sandbox (module 19 4.3); typed confirmation is the form's job. */
export async function removeStudent(
  actor: Actor,
  classId: string,
  userId: string,
  db: Db = prisma,
): Promise<void> {
  const cls = await loadClass(db, actor, classId);
  const [row] = (await scopedUsers(db, actor).findMany({
    where: { id: userId, cohortId: cls.id, appRole: 'USER' },
    select: { id: true },
  })) as { id: string }[];
  if (!row) throw new InstructorError('SIM-020', SIM['SIM-020']);
  await deleteAccount(actor, userId, { confirm: 'DELETE' }, db);
  await writeInstructorAudit(db, {
    actorUserId: actor.id,
    actorRole: actor.role,
    classroomId: cls.id,
    action: 'STUDENT_REMOVED',
    targetType: 'User',
    targetId: userId,
    targetUserId: userId,
  });
}
