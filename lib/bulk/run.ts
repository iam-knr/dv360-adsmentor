import 'server-only';
// Bulk job lifecycle (module 11 4.8): `runBulk` validates the selection and creates the job, `processJob` works
// through the items in chunks (cursor in the payload, one item per transaction, idempotent by row number), and
// `runDueJobs` is what the worker route calls. A rule failure on one item never fails the job.
import type { SessionUser } from '@/lib/auth/types';
import { runWithAmbient } from '@/lib/changelog/ambient';
import { withBypass, withSandbox } from '@/lib/db';
import {
  asResult,
  assertWrite,
  serviceCtx,
  ServiceFailure,
  type Result,
} from '@/lib/campaigns/service-kit';
import { LIMITS } from '@/lib/validation/constants/limits';
import { computeCapabilities } from './capabilities';
import { executeItem, loadRows, type RowInfo } from './exec';
import { createJob, finishJob, jobPayload, type JobPayload } from './jobs';
import { BLK_010, BLK_013, describeJob, PARENT_TYPE } from './messages';
import type { BulkEntityKey } from './entities';
import type { BulkCapabilities, BulkItemOutcome, BulkRequest, BulkResponse } from './types';

const ENTITY_TYPE = {
  campaign: 'CAMPAIGN',
  insertionOrder: 'INSERTION_ORDER',
  lineItem: 'LINE_ITEM',
} as const;

const ACTION_OF = {
  ACTIVATE: 'ACTIVATE',
  PAUSE: 'PAUSE',
  ARCHIVE: 'ARCHIVE',
  UNARCHIVE: 'UNARCHIVE',
  DUPLICATE: 'DUPLICATE',
  APPLY_TARGETING_TEMPLATE: 'APPLY_TARGETING_TEMPLATE',
  EDIT_SETTINGS: 'EDIT_SETTINGS',
  EDIT_TARGETING: 'EDIT_TARGETING',
  EDIT_CREATIVE_ASSIGNMENT: 'EDIT_CREATIVE_ASSIGNMENT',
} as const;

interface BulkPayload extends JobPayload {
  entity: BulkEntityKey;
  ids: string[];
  params: BulkRequest['params'];
  cursor: number;
  ok: number;
  failed: number;
  firstResult?: string;
  leaseUntil?: number;
}

const invalidReq = (path: string, message: string) =>
  new ServiceFailure('INVALID', [{ path, severity: 'error', code: 'BLK', message }]);

/** K2..K8: validate, create the job and run it until it finishes or the time budget is spent. */
export async function runBulk(
  user: SessionUser,
  req: BulkRequest,
  opts: { budgetMs?: number } = {},
): Promise<Result<BulkResponse>> {
  return asResult(async () => {
    const ctx = await serviceCtx(user);
    assertWrite(ctx);
    const ids = [...new Set(req.ids)];
    if (ids.length === 0) throw invalidReq('ids', 'Select at least one row.');
    if (ids.length > LIMITS.BULK_MAX_ROWS)
      throw invalidReq('ids', `You can select up to ${LIMITS.BULK_MAX_ROWS} rows.`);
    if (req.params.op === 'DUPLICATE' && (!Number.isInteger(req.params.copies) || req.params.copies < 1))
      throw invalidReq('copies', BLK_013);

    const rows = await loadRows(user, req.entity, ids);
    const first = rows.find((r): r is RowInfo => !!r);
    const params = req.params;
    const description = describeJob(params.op, req.entity, ids.length, {
      ...(params.op === 'DUPLICATE'
        ? {
            copies: params.copies,
            parentType: PARENT_TYPE[req.entity],
            parentId: params.targetParentId ?? first?.parentPublicId ?? '',
          }
        : {}),
    });
    const payload: BulkPayload = {
      ...jobPayload(ctx, {}),
      entity: req.entity,
      ids,
      params,
      cursor: 0,
      ok: 0,
      failed: 0,
    };
    const job = await withSandbox(ctx.sandboxId, (tx) =>
      createJob(tx, ctx, {
        advertiserId: first?.advertiserId ?? null,
        source: params.op === 'DUPLICATE' ? 'DUPLICATION' : 'BULK_EDIT',
        action: ACTION_OF[params.op],
        description,
        payload: payload,
        selectionCount: ids.length,
      }),
    );
    await processJob(ctx.sandboxId, job.id, opts.budgetMs);
    return { data: await jobResponse(ctx.sandboxId, job.id) };
  });
}

async function jobResponse(sandboxId: string, jobId: string): Promise<BulkResponse> {
  return withSandbox(sandboxId, async (tx) => {
    const j = await tx.bulkJob.findUniqueOrThrow({
      where: { id: jobId },
      include: { items: { orderBy: { rowNumber: 'asc' } } },
    });
    const items: BulkItemOutcome[] = j.items.map((i) => ({
      index: (i.rowNumber ?? 1) - 1,
      entityId: i.entityId ?? '',
      status: i.status,
      ...(i.message ? { message: i.message } : {}),
      ...(i.ruleId ? { ruleId: i.ruleId } : {}),
    }));
    return {
      jobId: j.id,
      status: j.status,
      ok: items.filter((i) => i.status === 'OK').length,
      failed: items.filter((i) => i.status === 'FAILED').length,
      ...(j.errorSummary ? { summary: j.errorSummary } : {}),
      items,
    };
  });
}

const LEASE_MS = 30_000;

/** Work through a job from its cursor. Safe to call twice at once: the second caller finds the lease taken. */
export async function processJob(
  sandboxId: string,
  jobId: string,
  budgetMs = 8000,
): Promise<{ status: string; processed: number }> {
  const deadline = Date.now() + budgetMs;
  // claim: row lock, status check, lease
  const claimed = await withSandbox(sandboxId, async (tx) => {
    await tx.$queryRaw`SELECT id FROM "BulkJob" WHERE id = ${jobId} FOR UPDATE`;
    const j = await tx.bulkJob.findUnique({ where: { id: jobId } });
    if (!j || (j.status !== 'QUEUED' && j.status !== 'RUNNING')) return null;
    const payload = j.payload as unknown as BulkPayload | null;
    if (!payload || !('entity' in payload)) return null;
    if (payload.leaseUntil && payload.leaseUntil > Date.now()) return null;
    payload.leaseUntil = Date.now() + LEASE_MS;
    await tx.bulkJob.update({
      where: { id: jobId },
      data: { status: 'RUNNING', payload: payload as never },
    });
    return payload;
  });
  if (!claimed) return { status: 'SKIPPED', processed: 0 };
  const payload = claimed;
  const user = payload.actor;
  const total = payload.ids.length;
  const source = payload.params.op === 'DUPLICATE' ? 'DUPLICATION' : 'BULK_EDIT';
  const rows = await loadRows(user, payload.entity, payload.ids);
  let processed = 0;

  while (payload.cursor < total && Date.now() < deadline) {
    const index = payload.cursor;
    const row = rows[index] ?? null;
    const existing = await withSandbox(sandboxId, (tx) =>
      tx.bulkJobItem.findFirst({ where: { jobId, rowNumber: index + 1 }, select: { id: true } }),
    );
    let out: BulkItemOutcome;
    if (existing) out = { index, entityId: payload.ids[index]!, status: 'OK' };
    else {
      try {
        out = await runWithAmbient({ source, bulkJobId: jobId }, () =>
          executeItem(user, payload.entity, index, row, payload.ids[index]!, payload.params),
        );
      } catch (e) {
        out = {
          index,
          entityId: row?.publicId ?? payload.ids[index]!,
          status: 'FAILED',
          message: e instanceof ServiceFailure ? (e.issues[0]?.message ?? e.code) : 'The change was not saved.',
          ruleId: 'BLK-005',
        };
      }
      await withSandbox(sandboxId, (tx) =>
        tx.bulkJobItem.create({
          data: {
            sandboxId,
            jobId,
            entityType: ENTITY_TYPE[payload.entity],
            entityId: out.entityId,
            status: out.status,
            message: out.message ?? null,
            ruleId: out.ruleId ?? null,
            rowNumber: index + 1,
            field: out.resultEntityId ?? null,
          },
        }),
      );
    }
    if (out.status === 'OK') payload.ok += 1;
    else payload.failed += 1;
    if (out.resultEntityId && !payload.firstResult) payload.firstResult = out.resultEntityId;
    payload.cursor = index + 1;
    processed += 1;
    payload.leaseUntil = Date.now() + LEASE_MS;
    await withSandbox(sandboxId, (tx) =>
      tx.bulkJob.update({ where: { id: jobId }, data: { payload: payload as never } }),
    );
  }

  const done = payload.cursor >= total;
  await withSandbox(sandboxId, async (tx) => {
    delete payload.leaseUntil;
    await tx.bulkJob.update({ where: { id: jobId }, data: { payload: payload as never } });
    if (done)
      await finishJob(tx, jobId, {
        status: 'COMPLETED',
        errorSummary: payload.failed > 0 ? BLK_010(payload.failed, total) : null,
        ...(payload.firstResult
          ? { resultKind: 'ENTITY_LIST' as const, resultEntityId: payload.firstResult }
          : {}),
      });
  });
  return { status: done ? 'COMPLETED' : 'RUNNING', processed };
}

/** Worker route: jobs still QUEUED or RUNNING whose lease ran out, oldest first (4.8). */
export async function runDueJobs(budgetMs = 8000): Promise<{ jobs: number; processed: number }> {
  const deadline = Date.now() + budgetMs;
  const due = await withBypass((tx) =>
    tx.bulkJob.findMany({
      where: { status: { in: ['QUEUED', 'RUNNING'] }, source: { in: ['BULK_EDIT', 'DUPLICATION'] } },
      orderBy: { requestedAt: 'asc' },
      take: 20,
      select: { id: true, sandboxId: true },
    }),
  );
  let processed = 0;
  let jobs = 0;
  for (const j of due) {
    const left = deadline - Date.now();
    if (left <= 0) break;
    const r = await processJob(j.sandboxId, j.id, left);
    if (r.status !== 'SKIPPED') jobs += 1;
    processed += r.processed;
  }
  return { jobs, processed };
}

/** Continue the jobs of this sandbox that stalled (lazy catch-up when the Bulk status page loads). */
export async function resumeSandboxJobs(sandboxId: string, budgetMs = 4000): Promise<void> {
  const open = await withSandbox(sandboxId, (tx) =>
    tx.bulkJob.findMany({
      where: { status: { in: ['QUEUED', 'RUNNING'] }, source: { in: ['BULK_EDIT', 'DUPLICATION'] } },
      orderBy: { requestedAt: 'asc' },
      take: 5,
      select: { id: true },
    }),
  );
  const deadline = Date.now() + budgetMs;
  for (const j of open) {
    if (Date.now() >= deadline) break;
    await processJob(sandboxId, j.id, deadline - Date.now());
  }
}

/** K1 for the API: the capabilities of a selection, from the stored rows. */
export async function bulkCapabilities(
  user: SessionUser,
  entity: BulkEntityKey,
  ids: string[],
): Promise<BulkCapabilities> {
  const rows = (await loadRows(user, entity, ids)).filter((r): r is RowInfo => !!r);
  return computeCapabilities(
    entity,
    rows.map((r) => ({ id: r.publicId, status: r.status, ...(r.type ? { type: r.type } : {}) })),
    { role: user.dvRole },
  );
}
