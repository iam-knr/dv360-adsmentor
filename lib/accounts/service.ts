import 'server-only';
import type { AppRole, Prisma, PrismaClient } from '@prisma/client';
import { generatePassword, hashPassword, checkPassword } from '@/lib/auth/password';
import { clearLockout } from '@/lib/auth/lockout';
import { getAccountPolicy } from '@/lib/auth/policy';
import { ProvisionError, provisionStudent } from '@/lib/auth/provision';
import { assertNotLastActiveSuperAdmin, LastSuperAdminError } from '@/lib/auth/super-admin';
import { prisma } from '@/lib/db';
import {
  enqueueProvisionSandbox,
  getProvisionView,
  retryProvisionSandbox,
  type ProvisionView,
} from '@/lib/sandbox/provision';
import { writeAccountAudit, type AccountAuditAction } from './audit';
import { can, type AccountAction, type Actor, type Target } from './permissions';
import {
  ACC,
  AccountError,
  MAX_BULK,
  MAX_SHARED_PASSWORD_BULK,
  checkCapacity,
  checkEmail,
  checkName,
  checkNotes,
  normaliseEmail,
} from './rules';
import { cohortScopeWhere, scopedUsers, userScopeWhere } from './scope';
import { transition, type StatusEvent } from './status';

type Db = PrismaClient;
type Tx = Prisma.TransactionClient;

export type PasswordInput = { mode: 'GENERATE' } | { mode: 'SET'; value: string };

export interface AccountRow {
  id: string;
  email: string;
  name: string;
  appRole: AppRole;
  status: 'ACTIVE' | 'DISABLED' | 'LOCKED' | 'ARCHIVED';
  cohortId: string | null;
  cohortName: string | null;
  accessStartsAt: Date | null;
  accessEndsAt: Date | null;
  lastLoginAt: Date | null;
  lockedUntil: Date | null;
  sandbox: string;
}

function toTarget(u: {
  id: string;
  appRole: AppRole;
  ownerAdminId: string | null;
  cohort?: { ownerAdminId: string } | null;
}): Target {
  return {
    id: u.id,
    role: u.appRole,
    ownerAdminId: u.ownerAdminId,
    cohortOwnerId: u.cohort?.ownerAdminId ?? null,
  };
}

/** Write a Denied audit row outside the failing transaction, then raise. */
async function deny(
  db: Db,
  actor: Actor,
  action: AccountAuditAction,
  targetId: string | null,
  code: keyof typeof ACC,
  payload?: Record<string, unknown>,
): Promise<never> {
  await writeAccountAudit(db, {
    actorUserId: actor.id,
    actorRole: actor.role,
    action: 'AUTHZ_DENIED',
    targetType: 'User',
    targetId,
    targetUserId: targetId,
    result: 'DENIED',
    payload: { reason: `${action}:${code}`, ...payload },
  });
  throw new AccountError(code);
}

async function loadTarget(tx: Tx, actor: Actor, id: string) {
  const user = await scopedUsers(tx, actor).findById(id);
  if (!user) throw new AccountError('ACC-022');
  return user as {
    id: string;
    email: string;
    name: string;
    appRole: AppRole;
    status: 'ACTIVE' | 'DISABLED' | 'LOCKED' | 'ARCHIVED';
    cohortId: string | null;
    ownerAdminId: string | null;
    cohort: { ownerAdminId: string; name: string } | null;
  };
}

function passwordFor(
  input: PasswordInput,
  email: string,
  minLength: number,
): { plaintext: string; generated: boolean } {
  if (input.mode === 'GENERATE') return { plaintext: generatePassword(), generated: true };
  const first = checkPassword(input.value, { email, minLength }).issues[0];
  if (first) throw new ProvisionError(first.code, first.message);
  return { plaintext: input.value, generated: false };
}

function wrap<T>(fn: () => Promise<T>): Promise<T> {
  return fn().catch((err: unknown) => {
    if (err instanceof LastSuperAdminError) throw new AccountError('ACC-024');
    if (err instanceof ProvisionError) throw new AccountError(err.code, err.message);
    throw err;
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Default cohort
// ---------------------------------------------------------------------------------------------------------------

/** Code of the cohort every student without a chosen cohort belongs to. Cohorts are an optional grouping (ADM-FIX). */
export const DEFAULT_COHORT_CODE = 'students';
const DEFAULT_COHORT_NAME = 'All students';
const DEFAULT_COHORT_CAPACITY = 100_000;

/**
 * The cohort that holds students who were added without one. A sandbox row hangs on a cohort (`Sandbox.classroomId`),
 * so every student has one; this one is created on first use, owned by the Super admin, and never listed as a cohort.
 */
export async function ensureDefaultCohort(tx: Tx, actor: Actor): Promise<string> {
  const found = await tx.classroom.findUnique({
    where: { code: DEFAULT_COHORT_CODE },
    select: { id: true, archivedAt: true },
  });
  if (found) {
    if (found.archivedAt) {
      await tx.classroom.update({ where: { id: found.id }, data: { archivedAt: null } });
    }
    return found.id;
  }
  // The oldest Super admin owns it: that account is never deleted, so the cohort never loses its owner.
  const owner = await tx.user.findFirst({
    where: { appRole: 'SUPER_ADMIN' },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  const ownerId = owner?.id ?? (actor.role === 'SUPER_ADMIN' ? actor.id : null);
  if (!ownerId) throw new AccountError('ACC-031');
  const created = await tx.classroom.upsert({
    where: { code: DEFAULT_COHORT_CODE },
    update: {},
    create: {
      name: DEFAULT_COHORT_NAME,
      code: DEFAULT_COHORT_CODE,
      ownerAdminId: ownerId,
      capacity: DEFAULT_COHORT_CAPACITY,
      defaultSeedTemplate: 'starter-agency',
    },
    select: { id: true },
  });
  return created.id;
}

// ---------------------------------------------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------------------------------------------

export interface CreateAccountInput {
  email: string;
  name: string;
  role: AppRole;
  cohortId?: string;
  accessStartsAt?: Date | null;
  accessEndsAt?: Date | null;
  notes?: string;
  mustChangePassword?: boolean;
  password: PasswordInput;
}

export async function createAccount(
  actor: Actor,
  input: CreateAccountInput,
  db: Db = prisma,
): Promise<{ id: string; email: string; cohortId?: string; initialPassword?: string }> {
  // Two levels exist (ADM-FIX): the retired ADMIN level can no longer be created, whoever asks.
  if (input.role === 'ADMIN' || !can(actor, 'account.create', { role: input.role })) {
    return deny(db, actor, 'ACCOUNT_CREATED', null, 'ACC-020', { toRole: input.role });
  }
  const email = normaliseEmail(input.email);
  const problem = checkEmail(email) ?? checkName(input.name) ?? checkNotes(input.notes);
  if (problem) throw new AccountError('ACC-001', problem);

  const result = await wrap(() =>
    db.$transaction(
      async (tx) => {
        const policy = await getAccountPolicy(tx);
        if (input.role === 'USER') {
          // The cohort is an optional grouping: without one the student joins the default cohort.
          const cohortId = input.cohortId ?? (await ensureDefaultCohort(tx, actor));
          const cohort = await tx.classroom.findFirst({
            where: { AND: [cohortScopeWhere(actor), { id: cohortId, archivedAt: null }] },
            select: { id: true },
          });
          if (!cohort) throw new AccountError('ACC-031');
          const pw = passwordFor(input.password, email, policy.minPasswordLength);
          const res = await provisionStudent(tx, cohortId, {
            email,
            name: input.name.trim(),
            password: pw.generated ? undefined : pw.plaintext,
            mustChangePassword: input.mustChangePassword,
            createdById: actor.id,
            accessStartsAt: input.accessStartsAt,
            accessEndsAt: input.accessEndsAt,
          });
          if (input.notes) {
            await tx.user.update({ where: { id: res.user.id }, data: { notes: input.notes } });
          }
          return { id: res.user.id, email, cohortId, initialPassword: res.password };
        }
        // SUPER_ADMIN: Super admin only (can() above); no cohort, no sandbox.
        const existing = await tx.user.findUnique({ where: { email }, select: { status: true } });
        if (existing) {
          throw new AccountError(existing.status === 'ARCHIVED' ? 'ACC-002A' : 'ACC-002');
        }
        const pw = passwordFor(input.password, email, policy.minPasswordLength);
        const user = await tx.user.create({
          data: {
            email,
            name: input.name.trim(),
            passwordHash: await hashPassword(pw.plaintext),
            appRole: input.role,
            mustChangePassword: input.mustChangePassword ?? policy.defaultMustChange,
            passwordChangedAt: new Date(),
            createdById: actor.id,
            notes: input.notes || null,
          },
          select: { id: true },
        });
        await writeAccountAudit(tx, {
          actorUserId: actor.id,
          actorRole: actor.role,
          action: 'ACCOUNT_CREATED',
          targetType: 'User',
          targetId: user.id,
          targetUserId: user.id,
          payload: { toRole: input.role },
        });
        return { id: user.id, email, initialPassword: pw.generated ? pw.plaintext : undefined };
      },
      { timeout: 20_000 },
    ),
  );
  if (input.role === 'USER' && result.cohortId) {
    // After commit (module 19 4.10). A failure leaves the account in place.
    await enqueueProvisionSandbox(result.cohortId, result.id).catch(() => undefined);
  }
  return result;
}

// ---------------------------------------------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------------------------------------------

async function freezeForAccount(tx: Tx, userId: string, now: Date): Promise<void> {
  const boxes = await tx.sandbox.findMany({
    where: { ownerUserId: userId, kind: 'STUDENT', status: { in: ['ACTIVE', 'FROZEN'] } },
    select: { id: true, status: true, clock: { select: { state: true, runOutsideSession: true } } },
  });
  for (const sb of boxes) {
    if (sb.status === 'ACTIVE') {
      await tx.sandbox.update({
        where: { id: sb.id },
        data: {
          status: 'FROZEN',
          frozenAt: now,
          frozenReason: 'ACCOUNT',
          clockStateBeforeFreeze: sb.clock?.state ?? null,
        },
      });
      if (sb.clock)
        await tx.simClock.update({ where: { sandboxId: sb.id }, data: { state: 'PAUSED' } });
    } else {
      // already frozen by the class window: the account reason wins so a window opening cannot thaw it
      await tx.sandbox.update({ where: { id: sb.id }, data: { frozenReason: 'ACCOUNT' } });
    }
  }
}

async function thawForAccount(tx: Tx, userId: string, now: Date) {
  const boxes = await tx.sandbox.findMany({
    where: { ownerUserId: userId, kind: 'STUDENT', status: 'FROZEN', frozenReason: 'ACCOUNT' },
    select: {
      id: true,
      clockStateBeforeFreeze: true,
      clock: { select: { runOutsideSession: true } },
    },
  });
  for (const sb of boxes) {
    await tx.sandbox.update({
      where: { id: sb.id },
      data: { status: 'ACTIVE', frozenAt: null, frozenReason: null, clockStateBeforeFreeze: null },
    });
    if (sb.clock) {
      await tx.simClock.update({
        where: { sandboxId: sb.id },
        data: {
          ...(sb.clock.runOutsideSession ? {} : { state: sb.clockStateBeforeFreeze ?? 'PAUSED' }),
          lastAdvanceRealAt: now,
          remainderMs: 0,
        },
      });
    }
  }
}

const AUDIT_FOR_EVENT: Record<StatusEvent, AccountAuditAction> = {
  disable: 'ACCOUNT_DISABLED',
  enable: 'ACCOUNT_ENABLED',
  lock: 'ACCOUNT_LOCKED',
  unlock: 'ACCOUNT_UNLOCKED',
  archive: 'ACCOUNT_ARCHIVED',
  restore: 'ACCOUNT_RESTORED',
};

async function authorise(
  db: Db,
  actor: Actor,
  action: AccountAction,
  audit: AccountAuditAction,
  user: Awaited<ReturnType<typeof loadTarget>>,
) {
  const target = toTarget(user);
  if (!can(actor, action, target)) {
    // In scope but not allowed (for example an Admin acting on their own row): refuse and audit.
    const self = user.id === actor.id;
    return deny(db, actor, audit, user.id, self ? 'ACC-023' : 'FORBIDDEN');
  }
}

export async function setAccountStatus(
  actor: Actor,
  id: string,
  event: 'disable' | 'enable',
  db: Db = prisma,
  now: Date = new Date(),
): Promise<void> {
  // Self harm is refused before the permission lookup so the answer is ACC-023, not "not found".
  if (event === 'disable' && id === actor.id) {
    return deny(db, actor, 'ACCOUNT_DISABLED', id, 'ACC-023');
  }
  await wrap(() =>
    db.$transaction(async (tx) => {
      const user = await loadTarget(tx, actor, id);
      await authorise(
        db,
        actor,
        event === 'disable' ? 'account.disable' : 'account.enable',
        AUDIT_FOR_EVENT[event],
        user,
      );
      const next = transition(user.status, event);
      if (!next) throw new AccountError('FORBIDDEN');
      if (event === 'disable' && user.appRole === 'SUPER_ADMIN')
        await assertNotLastActiveSuperAdmin(tx, id);
      await tx.user.update({
        where: { id },
        data:
          event === 'disable'
            ? {
                status: next,
                disabledAt: now,
                disabledById: actor.id,
                sessionVersion: { increment: 1 },
                activeSessionId: null,
              }
            : {
                status: next,
                disabledAt: null,
                disabledById: null,
                failedLoginCount: 0,
                lockedUntil: null,
              },
      });
      if (user.appRole === 'USER') {
        if (event === 'disable') await freezeForAccount(tx, id, now);
        else await thawForAccount(tx, id, now);
      }
      await writeAccountAudit(tx, {
        actorUserId: actor.id,
        actorRole: actor.role,
        classroomId: user.cohortId,
        action: AUDIT_FOR_EVENT[event],
        targetType: 'User',
        targetId: id,
        targetUserId: id,
        payload: { fromStatus: user.status, toStatus: next },
      });
    }),
  );
}

export async function unlockAccount(actor: Actor, id: string, db: Db = prisma): Promise<void> {
  await db.$transaction(async (tx) => {
    const user = await loadTarget(tx, actor, id);
    await authorise(db, actor, 'account.unlock', 'ACCOUNT_UNLOCKED', user);
    await clearLockout(tx, id);
    await writeAccountAudit(tx, {
      actorUserId: actor.id,
      actorRole: actor.role,
      classroomId: user.cohortId,
      action: 'ACCOUNT_UNLOCKED',
      targetType: 'User',
      targetId: id,
      targetUserId: id,
    });
  });
}

export async function revokeSessions(actor: Actor, id: string, db: Db = prisma): Promise<void> {
  await db.$transaction(async (tx) => {
    const user = await loadTarget(tx, actor, id);
    await authorise(db, actor, 'account.revokeSessions', 'SESSIONS_REVOKED', user);
    await tx.user.update({
      where: { id },
      data: { sessionVersion: { increment: 1 }, activeSessionId: null },
    });
    await writeAccountAudit(tx, {
      actorUserId: actor.id,
      actorRole: actor.role,
      classroomId: user.cohortId,
      action: 'SESSIONS_REVOKED',
      targetType: 'User',
      targetId: id,
      targetUserId: id,
    });
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Reset password
// ---------------------------------------------------------------------------------------------------------------

export async function resetPassword(
  actor: Actor,
  id: string,
  req: { password: PasswordInput; mustChangePassword?: boolean },
  db: Db = prisma,
): Promise<{ newPassword?: string }> {
  return wrap(() =>
    db.$transaction(
      async (tx) => {
        const user = await loadTarget(tx, actor, id);
        await authorise(db, actor, 'account.resetPassword', 'PASSWORD_RESET', user);
        if (user.status === 'ARCHIVED') throw new AccountError('ACC-022');
        const policy = await getAccountPolicy(tx);
        const pw = passwordFor(req.password, user.email, policy.minPasswordLength);
        const must = req.mustChangePassword ?? true;
        await tx.user.update({
          where: { id },
          data: {
            passwordHash: await hashPassword(pw.plaintext),
            passwordChangedAt: new Date(),
            mustChangePassword: must,
            sessionVersion: { increment: 1 },
            activeSessionId: null,
          },
        });
        await clearLockout(tx, id);
        await writeAccountAudit(tx, {
          actorUserId: actor.id,
          actorRole: actor.role,
          classroomId: user.cohortId,
          action: 'PASSWORD_RESET',
          targetType: 'User',
          targetId: id,
          targetUserId: id,
          payload: { mustChangePassword: must },
        });
        return pw.generated ? { newPassword: pw.plaintext } : {};
      },
      { timeout: 20_000 },
    ),
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Delete (archive) and restore
// ---------------------------------------------------------------------------------------------------------------

export async function deleteAccount(
  actor: Actor,
  id: string,
  req: { confirm: string },
  db: Db = prisma,
  now: Date = new Date(),
): Promise<void> {
  if (id === actor.id) return deny(db, actor, 'ACCOUNT_ARCHIVED', id, 'ACC-023');
  if (req.confirm !== 'DELETE') throw new AccountError('ACC-061');
  await wrap(() =>
    db.$transaction(async (tx) => {
      const user = await loadTarget(tx, actor, id);
      if (user.appRole === 'SUPER_ADMIN') return deny(db, actor, 'ACCOUNT_ARCHIVED', id, 'ACC-026');
      await authorise(db, actor, 'account.delete', 'ACCOUNT_ARCHIVED', user);
      const next = transition(user.status, 'archive');
      if (!next) throw new AccountError('ACC-022');
      await tx.user.update({
        where: { id },
        data: {
          status: next,
          archivedAt: now,
          sessionVersion: { increment: 1 },
          activeSessionId: null,
        },
      });
      await tx.sandbox.updateMany({
        where: { ownerUserId: id, kind: 'STUDENT' },
        data: { status: 'ARCHIVED' },
      });
      await writeAccountAudit(tx, {
        actorUserId: actor.id,
        actorRole: actor.role,
        classroomId: user.cohortId,
        action: 'ACCOUNT_ARCHIVED',
        targetType: 'User',
        targetId: id,
        targetUserId: id,
        payload: { fromStatus: user.status, toStatus: next },
      });
    }),
  );
}

export async function restoreAccount(actor: Actor, id: string, db: Db = prisma): Promise<void> {
  await db.$transaction(async (tx) => {
    const user = await loadTarget(tx, actor, id);
    await authorise(db, actor, 'account.restore', 'ACCOUNT_RESTORED', user);
    const next = transition(user.status, 'restore');
    if (!next) throw new AccountError('ACC-022');
    await tx.user.update({ where: { id }, data: { status: next, archivedAt: null } });
    await tx.sandbox.updateMany({
      where: { ownerUserId: id, kind: 'STUDENT', status: 'ARCHIVED' },
      data: { status: 'FROZEN', frozenReason: 'ACCOUNT', frozenAt: new Date() },
    });
    await writeAccountAudit(tx, {
      actorUserId: actor.id,
      actorRole: actor.role,
      classroomId: user.cohortId,
      action: 'ACCOUNT_RESTORED',
      targetType: 'User',
      targetId: id,
      targetUserId: id,
      payload: { fromStatus: user.status, toStatus: next },
    });
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Bulk (each id in its own transaction; skipped rows carry their reason, ACC-062)
// ---------------------------------------------------------------------------------------------------------------

export type BulkAction =
  | { type: 'DISABLE' }
  | { type: 'ENABLE' }
  | { type: 'DELETE'; confirm: string }
  | { type: 'RESET_PASSWORD'; mode: 'GENERATE' | { set: string }; mustChangePassword?: boolean };

export interface BulkResult {
  done: string[];
  skipped: { id: string; code: string; message: string }[];
  secrets: { id: string; email: string; password: string }[];
}

export async function bulkAccounts(
  actor: Actor,
  ids: string[],
  action: BulkAction,
  db: Db = prisma,
): Promise<BulkResult> {
  const unique = [...new Set(ids)];
  if (unique.length > MAX_BULK) throw new AccountError('ACC-060');
  if (action.type === 'DELETE' && action.confirm !== 'DELETE') throw new AccountError('ACC-061');
  if (
    action.type === 'RESET_PASSWORD' &&
    action.mode !== 'GENERATE' &&
    unique.length > MAX_SHARED_PASSWORD_BULK
  ) {
    throw new AccountError('ACC-063');
  }
  const result: BulkResult = { done: [], skipped: [], secrets: [] };
  for (const id of unique) {
    try {
      switch (action.type) {
        case 'DISABLE':
          await setAccountStatus(actor, id, 'disable', db);
          break;
        case 'ENABLE':
          await setAccountStatus(actor, id, 'enable', db);
          break;
        case 'DELETE':
          await deleteAccount(actor, id, { confirm: action.confirm }, db);
          break;
        case 'RESET_PASSWORD': {
          const r = await resetPassword(
            actor,
            id,
            {
              password:
                action.mode === 'GENERATE'
                  ? { mode: 'GENERATE' }
                  : { mode: 'SET', value: action.mode.set },
              mustChangePassword: action.mustChangePassword,
            },
            db,
          );
          if (r.newPassword) {
            const row = await db.user.findUnique({ where: { id }, select: { email: true } });
            result.secrets.push({ id, email: row?.email ?? '', password: r.newPassword });
          }
          break;
        }
      }
      result.done.push(id);
    } catch (err) {
      const code = err instanceof AccountError ? err.code : 'ERROR';
      const message =
        err instanceof AccountError ? err.message : 'Something went wrong. Try again.';
      result.skipped.push({ id, code, message });
    }
  }
  return result;
}

// ---------------------------------------------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------------------------------------------

export interface AccountListQuery {
  search?: string;
  role?: AppRole[];
  status?: AccountRow['status'][];
  cohortId?: string[];
  page?: number;
  pageSize?: number;
  sort?: 'name' | 'email' | 'appRole' | 'status' | 'lastLoginAt' | 'createdAt';
  dir?: 'asc' | 'desc';
}

export async function listAccounts(
  actor: Actor,
  q: AccountListQuery = {},
  db: Db = prisma,
  now: Date = new Date(),
): Promise<{ rows: AccountRow[]; total: number }> {
  const scope = scopedUsers(db, actor);
  const search = q.search?.trim();
  const where: Prisma.UserWhereInput = {
    AND: [
      // the retired ADMIN level is never listed
      { appRole: q.role?.length ? { in: q.role.filter((r) => r !== 'ADMIN') } : { not: 'ADMIN' } },
      // default filter: not archived (module 19 2.2)
      q.status?.length ? { status: { in: q.status } } : { status: { not: 'ARCHIVED' } },
      q.cohortId?.length ? { cohortId: { in: q.cohortId } } : {},
      search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {},
    ],
  };
  const pageSize = [20, 50, 100].includes(q.pageSize ?? 20) ? (q.pageSize ?? 20) : 20;
  const page = Math.max(1, q.page ?? 1);
  const [total, users] = await Promise.all([
    scope.count(where),
    scope.findMany({
      where,
      orderBy: { [q.sort ?? 'createdAt']: q.dir ?? 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        email: true,
        name: true,
        appRole: true,
        status: true,
        cohortId: true,
        accessStartsAt: true,
        accessEndsAt: true,
        lastLoginAt: true,
        lockedUntil: true,
        cohort: { select: { name: true } },
        sandboxes: { select: { status: true, provisionState: true }, take: 1 },
      },
    }),
  ]);
  const rows = (
    users as unknown as Array<
      Omit<AccountRow, 'cohortName' | 'sandbox'> & {
        cohort: { name: string } | null;
        sandboxes: { status: string; provisionState: string }[];
      }
    >
  ).map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    appRole: u.appRole,
    // an expired lock shows as Active (module 19 4.3: checked by the list query)
    status:
      u.status === 'LOCKED' && u.lockedUntil && u.lockedUntil <= now
        ? ('ACTIVE' as const)
        : u.status,
    cohortId: u.cohortId,
    cohortName: u.cohort?.name ?? null,
    accessStartsAt: u.accessStartsAt,
    accessEndsAt: u.accessEndsAt,
    lastLoginAt: u.lastLoginAt,
    lockedUntil: u.lockedUntil,
    sandbox:
      u.appRole !== 'USER'
        ? ''
        : u.sandboxes[0]
          ? u.sandboxes[0].provisionState === 'READY'
            ? 'READY'
            : u.sandboxes[0].provisionState
          : 'NOT CREATED',
  }));
  return { rows, total };
}

export async function getAccount(actor: Actor, id: string, db: Db = prisma) {
  const base = await scopedUsers(db, actor).findById(id);
  if (!base) throw new AccountError('ACC-022');
  const u = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      appRole: true,
      status: true,
      notes: true,
      mustChangePassword: true,
      failedLoginCount: true,
      lockedUntil: true,
      lastLoginAt: true,
      passwordChangedAt: true,
      accessStartsAt: true,
      accessEndsAt: true,
      createdAt: true,
      cohort: { select: { id: true, name: true, code: true } },
      createdBy: { select: { name: true } },
    },
  });
  const log = await db.auditLog.findMany({
    where: { targetUserId: id },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: { id: true, action: true, result: true, createdAt: true, actorUserId: true, payload: true },
  });
  const actorIds = [...new Set(log.map((r) => r.actorUserId).filter((v): v is string => !!v))];
  const actors = actorIds.length
    ? await db.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } })
    : [];
  const actorName = new Map(actors.map((a) => [a.id, a.name]));
  const activity = log.map((r) => ({
    id: r.id,
    createdAt: r.createdAt,
    result: r.result,
    actorName: r.actorUserId ? (actorName.get(r.actorUserId) ?? null) : null,
    summary: auditSummary(r.action, r.result, r.payload as AuditPayload),
  }));
  const account = u!;
  const sandbox =
    account.appRole === 'USER' ? await getProvisionView(id, db) : null;
  return { account, activity, sandbox };
}

/**
 * "Create sandbox" and "Retry provisioning" on the account page (module 19 4.10): starts the build for a User who has
 * none, or restarts a FAILED one, and runs the first step. Building or ready sandboxes are left alone.
 */
export async function retrySandbox(
  actor: Actor,
  id: string,
  db: Db = prisma,
): Promise<ProvisionView> {
  const user = await loadTarget(db, actor, id);
  await authorise(db, actor, 'account.edit', 'ACCOUNT_UPDATED', user);
  if (user.appRole !== 'USER' || user.status === 'ARCHIVED') throw new AccountError('ACC-022');
  // Students made before cohorts became optional may have none: they join the default cohort.
  const cohortId = user.cohortId ?? (await db.$transaction((tx) => ensureDefaultCohort(tx, actor)));
  if (!user.cohortId) await db.user.update({ where: { id }, data: { cohortId } });
  await writeAccountAudit(db, {
    actorUserId: actor.id,
    actorRole: actor.role,
    classroomId: cohortId,
    action: 'ACCOUNT_UPDATED',
    targetType: 'User',
    targetId: id,
    targetUserId: id,
    payload: { reason: 'SANDBOX_PROVISION' },
  });
  return retryProvisionSandbox(cohortId, id, { db, budgetMs: 25_000 });
}

const CHARGED = ['ACTIVE', 'DISABLED', 'LOCKED'] as const;

/** Cohorts are an optional grouping of students. The default cohort (every student without a chosen one) is not listed. */
export async function listCohorts(actor: Actor, db: Db = prisma) {
  const rows = await db.classroom.findMany({
    where: {
      AND: [cohortScopeWhere(actor), { archivedAt: null, code: { not: DEFAULT_COHORT_CODE } }],
    },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      capacity: true,
      timeZone: true,
      createdAt: true,
      _count: { select: { users: { where: { status: { in: [...CHARGED] }, appRole: 'USER' } } } },
    },
  });
  return rows.map((c) => ({ ...c, used: c._count.users }));
}

/** One cohort with its students (archived accounts are not members), or ACC-031. */
export async function getCohort(actor: Actor, id: string, db: Db = prisma) {
  const c = await db.classroom.findFirst({
    where: { AND: [cohortScopeWhere(actor), { id, code: { not: DEFAULT_COHORT_CODE } }] },
    select: {
      id: true,
      name: true,
      capacity: true,
      timeZone: true,
      createdAt: true,
      archivedAt: true,
      users: {
        where: { appRole: 'USER', status: { not: 'ARCHIVED' } },
        orderBy: { name: 'asc' },
        select: {
          id: true,
          email: true,
          name: true,
          status: true,
          lastLoginAt: true,
          sandboxes: { select: { provisionState: true }, take: 1 },
        },
      },
    },
  });
  if (!c) throw new AccountError('ACC-031');
  return {
    ...c,
    members: c.users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      status: u.status,
      lastLoginAt: u.lastLoginAt,
      sandbox: u.sandboxes[0]?.provisionState ?? 'NOT CREATED',
    })),
  };
}

export async function createCohort(
  actor: Actor,
  input: { name: string; timeZone?: string; capacity?: number },
  db: Db = prisma,
): Promise<{ id: string }> {
  if (!can(actor, 'cohort.create')) return deny(db, actor, 'COHORT_CREATED', null, 'FORBIDDEN');
  const name = input.name.trim();
  if (!name) throw new AccountError('ACC-033');
  if ([...name].length > 100) throw new AccountError('ACC-003B');
  const capacity = input.capacity ?? (await getAccountPolicy(db)).defaultCohortCapacity;
  const capProblem = checkCapacity(capacity, actor.role === 'SUPER_ADMIN');
  if (capProblem) throw new AccountError('ACC-034', capProblem);
  // The Super admin owns every cohort.
  const ownerAdminId = actor.id;
  return db.$transaction(async (tx) => {
    const dup = await tx.classroom.findFirst({
      where: { ownerAdminId, name },
      select: { id: true },
    });
    if (dup) throw new AccountError('ACC-033B');
    const code = `c-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36)}`;
    const c = await tx.classroom.create({
      data: {
        name,
        code,
        ownerAdminId,
        capacity,
        defaultSeedTemplate: 'starter-agency',
        ...(input.timeZone ? { timeZone: input.timeZone } : {}),
      },
      select: { id: true },
    });
    await writeAccountAudit(tx, {
      actorUserId: actor.id,
      actorRole: actor.role,
      classroomId: c.id,
      action: 'COHORT_CREATED',
      targetType: 'Classroom',
      targetId: c.id,
      payload: { cohortId: c.id, cohortName: name, count: capacity },
    });
    return c;
  });
}

/** Rename a cohort or change its seat limit (never below the students in it). */
export async function updateCohort(
  actor: Actor,
  id: string,
  input: { name?: string; capacity?: number },
  db: Db = prisma,
): Promise<void> {
  if (!can(actor, 'cohort.edit', { role: 'USER', ownerAdminId: actor.id })) {
    return deny(db, actor, 'COHORT_UPDATED', null, 'FORBIDDEN');
  }
  await db.$transaction(async (tx) => {
    const c = await tx.classroom.findFirst({
      where: { AND: [cohortScopeWhere(actor), { id, archivedAt: null, code: { not: DEFAULT_COHORT_CODE } }] },
      select: { id: true, name: true, capacity: true },
    });
    if (!c) throw new AccountError('ACC-031');
    const name = input.name === undefined ? c.name : input.name.trim();
    if (!name) throw new AccountError('ACC-033');
    if ([...name].length > 100) throw new AccountError('ACC-003B');
    const capacity = input.capacity ?? c.capacity;
    const problem = checkCapacity(capacity, true);
    if (problem) throw new AccountError('ACC-034', problem);
    const used = await tx.user.count({
      where: { cohortId: id, appRole: 'USER', status: { in: [...CHARGED] } },
    });
    if (capacity < used) throw new AccountError('ACC-034', `The cohort already has ${used} students.`);
    if (name !== c.name) {
      const dup = await tx.classroom.findFirst({
        where: { ownerAdminId: actor.id, name, NOT: { id } },
        select: { id: true },
      });
      if (dup) throw new AccountError('ACC-033B');
    }
    await tx.classroom.update({ where: { id }, data: { name, capacity } });
    await writeAccountAudit(tx, {
      actorUserId: actor.id,
      actorRole: actor.role,
      classroomId: id,
      action: 'COHORT_UPDATED',
      targetType: 'Classroom',
      targetId: id,
      payload: { cohortId: id, cohortName: name, count: capacity },
    });
  });
}

/**
 * Archive a cohort. Its students are not deleted: they move to the default cohort and keep their sandboxes (a sandbox
 * is found by its owner, `resolveClassContext`).
 */
export async function archiveCohort(actor: Actor, id: string, db: Db = prisma): Promise<{ moved: number }> {
  if (!can(actor, 'cohort.edit', { role: 'USER', ownerAdminId: actor.id })) {
    return deny(db, actor, 'COHORT_ARCHIVED', null, 'FORBIDDEN');
  }
  return db.$transaction(async (tx) => {
    const c = await tx.classroom.findFirst({
      where: { AND: [cohortScopeWhere(actor), { id, archivedAt: null, code: { not: DEFAULT_COHORT_CODE } }] },
      select: { id: true, name: true },
    });
    if (!c) throw new AccountError('ACC-031');
    const defaultId = await ensureDefaultCohort(tx, actor);
    const moved = await tx.user.updateMany({
      where: { cohortId: id },
      data: { cohortId: defaultId },
    });
    await tx.classroom.update({ where: { id }, data: { archivedAt: new Date() } });
    await writeAccountAudit(tx, {
      actorUserId: actor.id,
      actorRole: actor.role,
      classroomId: id,
      action: 'COHORT_ARCHIVED',
      targetType: 'Classroom',
      targetId: id,
      payload: { cohortId: id, cohortName: c.name, count: moved.count },
    });
    return { moved: moved.count };
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------------------------------------------

export interface AuditEntry {
  id: string;
  createdAt: Date;
  action: string;
  result: 'OK' | 'DENIED';
  actor: { id: string; name: string; email: string } | null;
  target: { id: string; name: string; email: string } | null;
  targetLabel: string;
  summary: string;
}

type AuditPayload = Record<string, string | number | boolean | null> | null;

const ACTION_TEXT: Record<string, string> = {
  ACCOUNT_CREATED: 'Created account',
  ACCOUNT_UPDATED: 'Updated account',
  ACCOUNT_ROLE_CHANGED: 'Changed level',
  ACCOUNT_DISABLED: 'Disabled account',
  ACCOUNT_ENABLED: 'Enabled account',
  ACCOUNT_LOCKED: 'Account locked after failed sign-ins',
  ACCOUNT_UNLOCKED: 'Unlocked account',
  ACCOUNT_COHORT_MOVED: 'Moved to another cohort',
  ACCOUNT_ARCHIVED: 'Deleted account',
  ACCOUNT_RESTORED: 'Restored account',
  ACCOUNT_PURGED: 'Purged account',
  ACCOUNTS_IMPORTED: 'Imported accounts',
  PASSWORD_RESET: 'Reset password',
  PASSWORD_CHANGED: 'Changed password',
  SESSIONS_REVOKED: 'Signed out all devices',
  COHORT_CREATED: 'Created cohort',
  COHORT_UPDATED: 'Updated cohort',
  COHORT_ARCHIVED: 'Archived cohort',
  POLICY_CHANGED: 'Changed account policy',
  AUTHZ_DENIED: 'Action refused',
};

const LEVEL: Record<string, string> = { USER: 'Student', SUPER_ADMIN: 'Super admin', ADMIN: 'Retired level' };
const nice = (v: unknown) => String(v).toLowerCase().replace(/_/g, ' ');

/** One readable line for an audit row (the raw payload is never shown). */
export function auditSummary(action: string, result: string, payload: AuditPayload): string {
  const p = payload ?? {};
  const base = ACTION_TEXT[action] ?? action.toLowerCase().replace(/_/g, ' ');
  const bits: string[] = [];
  if (result === 'DENIED' && typeof p.reason === 'string') bits.push(`refused (${p.reason})`);
  if (typeof p.cohortName === 'string') bits.push(`cohort "${p.cohortName}"`);
  const from = p.fromRole ?? p.oldRole;
  const to = p.toRole ?? p.newRole;
  if (from && to) bits.push(`${LEVEL[String(from)] ?? from} to ${LEVEL[String(to)] ?? to}`);
  else if (to) bits.push(`as ${LEVEL[String(to)] ?? to}`);
  const fs = p.fromStatus ?? p.oldStatus;
  const ts = p.toStatus ?? p.newStatus;
  if (fs && ts) bits.push(`${nice(fs)} to ${nice(ts)}`);
  if (p.reason === 'SANDBOX_PROVISION') bits.push('create or retry sandbox');
  if (p.mustChangePassword === true) bits.push('new password required at next sign-in');
  if (typeof p.count === 'number' && action.startsWith('COHORT')) bits.push(`${p.count} students`);
  if (typeof p.fileName === 'string') bits.push(p.fileName);
  return bits.length ? `${base}: ${bits.join(', ')}` : base;
}

export interface AuditQuery {
  action?: string;
  /** Matches the actor's or the target's name or email. */
  q?: string;
  page?: number;
}

export const AUDIT_PAGE_SIZE = 50;

/** Audit rows with the actor and target resolved to names. A Super admin sees all of it. */
export async function listAudit(actor: Actor, query: AuditQuery = {}, db: Db = prisma) {
  if (!can(actor, 'audit.view')) throw new AccountError('FORBIDDEN');
  const q = query.q?.trim();
  const people = q
    ? (
        await db.user.findMany({
          where: {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
            ],
          },
          select: { id: true },
          take: 200,
        })
      ).map((u) => u.id)
    : [];
  const where: Prisma.AuditLogWhereInput = {
    ...(query.action ? { action: query.action } : {}),
    ...(q ? { OR: [{ actorUserId: { in: people } }, { targetUserId: { in: people } }] } : {}),
  };
  const page = Math.max(1, query.page ?? 1);
  const [rows, total, actions] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * AUDIT_PAGE_SIZE,
      take: AUDIT_PAGE_SIZE,
      select: {
        id: true,
        action: true,
        result: true,
        createdAt: true,
        actorUserId: true,
        targetUserId: true,
        targetType: true,
        targetId: true,
        payload: true,
      },
    }),
    db.auditLog.count({ where }),
    db.auditLog.findMany({ distinct: ['action'], select: { action: true }, orderBy: { action: 'asc' } }),
  ]);
  const ids = [...new Set(rows.flatMap((r) => [r.actorUserId, r.targetUserId]).filter((v): v is string => !!v))];
  const users = ids.length
    ? await db.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, email: true } })
    : [];
  const byId = new Map(users.map((u) => [u.id, u]));
  const cohortIds = [
    ...new Set(rows.filter((r) => r.targetType === 'Classroom' && r.targetId).map((r) => r.targetId as string)),
  ];
  const cohorts = cohortIds.length
    ? await db.classroom.findMany({ where: { id: { in: cohortIds } }, select: { id: true, name: true } })
    : [];
  const cohortName = new Map(cohorts.map((c) => [c.id, c.name]));
  const entries: AuditEntry[] = rows.map((r) => {
    const target = r.targetUserId ? (byId.get(r.targetUserId) ?? null) : null;
    return {
      id: r.id,
      createdAt: r.createdAt,
      action: r.action,
      result: r.result,
      actor: r.actorUserId ? (byId.get(r.actorUserId) ?? null) : null,
      target,
      targetLabel: target
        ? `${target.name} (${target.email})`
        : r.targetType === 'Classroom' && r.targetId
          ? `Cohort ${cohortName.get(r.targetId) ?? ''}`.trim()
          : '',
      summary: auditSummary(r.action, r.result, r.payload as AuditPayload),
    };
  });
  return {
    rows: entries,
    total,
    page,
    pages: Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE)),
    actions: actions.map((a) => a.action),
  };
}

export { userScopeWhere };
