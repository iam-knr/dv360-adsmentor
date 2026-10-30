import 'server-only';
import type { AppRole, Prisma, PrismaClient } from '@prisma/client';
import { generatePassword, hashPassword, checkPassword } from '@/lib/auth/password';
import { clearLockout } from '@/lib/auth/lockout';
import { getAccountPolicy } from '@/lib/auth/policy';
import { ProvisionError, provisionStudent } from '@/lib/auth/provision';
import { assertNotLastActiveSuperAdmin, LastSuperAdminError } from '@/lib/auth/super-admin';
import { isClassOpen } from '@/lib/access/windows';
import { prisma } from '@/lib/db';
import {
  enqueueProvisionSandbox,
  getProvisionView,
  retryProvisionSandbox,
  type ProvisionView,
} from '@/lib/sandbox/provision';
import { writeAccountAudit, type AccountAuditAction } from './audit';
import { ownedCounts, transferOwnership } from './ownership';
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
  ownerAdminName: string | null;
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
): Promise<{ id: string; email: string; initialPassword?: string }> {
  if (!can(actor, 'account.create', { role: input.role })) {
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
          if (!input.cohortId) throw new AccountError('ACC-030');
          const cohort = await tx.classroom.findFirst({
            where: { AND: [cohortScopeWhere(actor), { id: input.cohortId, archivedAt: null }] },
            select: { id: true },
          });
          if (!cohort) throw new AccountError('ACC-031');
          const pw = passwordFor(input.password, email, policy.minPasswordLength);
          const res = await provisionStudent(tx, input.cohortId, {
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
          return { id: res.user.id, email, initialPassword: res.password };
        }
        // ADMIN / SUPER_ADMIN: Super admin only (can() above); no cohort, no sandbox.
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
  if (input.role === 'USER' && input.cohortId) {
    // After commit (module 19 4.10). A failure leaves the account in place.
    await enqueueProvisionSandbox(input.cohortId, result.id).catch(() => undefined);
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

async function thawForAccount(
  tx: Tx,
  userId: string,
  classOpen: (cohortId: string) => Promise<boolean>,
  now: Date,
) {
  const boxes = await tx.sandbox.findMany({
    where: { ownerUserId: userId, kind: 'STUDENT', status: 'FROZEN', frozenReason: 'ACCOUNT' },
    select: {
      id: true,
      classroomId: true,
      clockStateBeforeFreeze: true,
      clock: { select: { runOutsideSession: true } },
    },
  });
  for (const sb of boxes) {
    if (!(await classOpen(sb.classroomId))) {
      await tx.sandbox.update({ where: { id: sb.id }, data: { frozenReason: 'WINDOW' } });
      continue;
    }
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
        else
          await thawForAccount(
            tx,
            id,
            (c) => isClassOpen(c, now, tx as unknown as PrismaClient),
            now,
          );
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
  req: { confirm: string; transferTo?: string },
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
      if (user.appRole === 'ADMIN') {
        const owned = await ownedCounts(tx, id);
        if (owned.users + owned.cohorts > 0) {
          if (!req.transferTo) throw new AccountError('ACC-025');
          const to = await tx.user.findFirst({
            where: {
              id: req.transferTo,
              appRole: { in: ['ADMIN', 'SUPER_ADMIN'] },
              status: 'ACTIVE',
            },
            select: { id: true },
          });
          if (!to || to.id === id) throw new AccountError('ACC-025');
          await transferOwnership(tx, id, to.id);
          await writeAccountAudit(tx, {
            actorUserId: actor.id,
            actorRole: actor.role,
            action: 'ACCOUNT_OWNER_TRANSFERRED',
            targetType: 'User',
            targetId: id,
            targetUserId: id,
            payload: { count: owned.users + owned.cohorts },
          });
        }
      }
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
      q.role?.length ? { appRole: { in: q.role } } : {},
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
        ownerAdmin: { select: { name: true } },
        sandboxes: { select: { status: true, provisionState: true }, take: 1 },
      },
    }),
  ]);
  const rows = (
    users as unknown as Array<
      Omit<AccountRow, 'cohortName' | 'ownerAdminName' | 'sandbox'> & {
        cohort: { name: string } | null;
        ownerAdmin: { name: string } | null;
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
    ownerAdminName: u.ownerAdmin?.name ?? null,
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
      cohort: { select: { id: true, name: true } },
      ownerAdmin: { select: { name: true } },
      createdBy: { select: { name: true } },
    },
  });
  const activity = await db.auditLog.findMany({
    where: { targetUserId: id },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: { id: true, action: true, result: true, createdAt: true, actorUserId: true },
  });
  const account = u!;
  const sandbox =
    account.appRole === 'USER' && account.cohort
      ? await getProvisionView(id, account.cohort.id, db)
      : null;
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
  if (user.appRole !== 'USER' || !user.cohortId || user.status === 'ARCHIVED') {
    throw new AccountError('ACC-022');
  }
  await writeAccountAudit(db, {
    actorUserId: actor.id,
    actorRole: actor.role,
    classroomId: user.cohortId,
    action: 'ACCOUNT_UPDATED',
    targetType: 'User',
    targetId: id,
    targetUserId: id,
    payload: { reason: 'SANDBOX_PROVISION' },
  });
  return retryProvisionSandbox(user.cohortId, id, { db, budgetMs: 25_000 });
}

export async function listCohorts(actor: Actor, db: Db = prisma) {
  const rows = await db.classroom.findMany({
    where: { AND: [cohortScopeWhere(actor), { archivedAt: null }] },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      capacity: true,
      timeZone: true,
      createdAt: true,
      ownerAdmin: { select: { id: true, name: true } },
      _count: {
        select: {
          users: { where: { status: { in: ['ACTIVE', 'DISABLED', 'LOCKED'] }, appRole: 'USER' } },
        },
      },
    },
  });
  return rows.map((c) => ({ ...c, used: c._count.users }));
}

export async function createCohort(
  actor: Actor,
  input: { name: string; ownerAdminId?: string; timeZone?: string; capacity?: number },
  db: Db = prisma,
): Promise<{ id: string }> {
  if (!can(actor, 'cohort.create')) return deny(db, actor, 'COHORT_CREATED', null, 'FORBIDDEN');
  const name = input.name.trim();
  if (!name) throw new AccountError('ACC-033');
  if ([...name].length > 100) throw new AccountError('ACC-003B');
  const capacity = input.capacity ?? (await getAccountPolicy(db)).defaultCohortCapacity;
  const capProblem = checkCapacity(capacity, actor.role === 'SUPER_ADMIN');
  if (capProblem) throw new AccountError('ACC-034', capProblem);
  // Admins own their cohorts; only a Super admin may pick another owner.
  const ownerAdminId = actor.role === 'SUPER_ADMIN' ? (input.ownerAdminId ?? actor.id) : actor.id;
  return db.$transaction(async (tx) => {
    if (ownerAdminId !== actor.id) {
      const owner = await tx.user.findFirst({
        where: { id: ownerAdminId, appRole: { in: ['ADMIN', 'SUPER_ADMIN'] }, status: 'ACTIVE' },
        select: { id: true },
      });
      if (!owner) throw new AccountError('ACC-022');
    }
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
        ...(input.timeZone ? { timeZone: input.timeZone } : {}),
      },
      select: { id: true },
    });
    await tx.classroomMember.create({
      data: { classroomId: c.id, userId: ownerAdminId, appRole: 'ADMIN' },
    });
    await writeAccountAudit(tx, {
      actorUserId: actor.id,
      actorRole: actor.role,
      classroomId: c.id,
      action: 'COHORT_CREATED',
      targetType: 'Classroom',
      targetId: c.id,
      payload: { cohortId: c.id, count: capacity },
    });
    return c;
  });
}

/** Audit rows visible to the actor: Super admin all; Admin where they are the actor or the target is in scope. */
export async function listAudit(actor: Actor, db: Db = prisma, take = 100) {
  const where: Prisma.AuditLogWhereInput =
    actor.role === 'SUPER_ADMIN'
      ? {}
      : {
          OR: [
            { actorUserId: actor.id },
            {
              targetUserId: {
                in: (
                  (await scopedUsers(db, actor).findMany({ select: { id: true } })) as {
                    id: string;
                  }[]
                ).map((u) => u.id),
              },
            },
          ],
        };
  return db.auditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take,
    select: {
      id: true,
      action: true,
      result: true,
      createdAt: true,
      actorUserId: true,
      targetUserId: true,
      targetType: true,
      payload: true,
    },
  });
}

export { userScopeWhere };
