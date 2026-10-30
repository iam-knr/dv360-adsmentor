import 'server-only';
// BulkJob persistence (module 11 3.2, 4.8): create, progress, list for the Bulk status page, detail and result files.
// Every writer of a bulk job (grid actions, SDF download and upload) goes through here.
import type { BulkAction, BulkResultKind, BulkSource, Prisma } from '@prisma/client';
import type { SessionUser } from '@/lib/auth/types';
import { fileStore } from '@/lib/creatives/storage';
import { withSandbox, type Tx } from '@/lib/db';
import { LIMITS } from '@/lib/validation/constants/limits';
import { assertRead, serviceCtx, ServiceFailure, type ServiceCtx } from '@/lib/campaigns/service-kit';
import { SOURCE_LABEL } from './messages';
import type { BulkJobDetail, BulkJobRow, BulkJobStatusKey } from './types';

/** What the worker needs to continue a job without a session: the acting user and the selection (3.2 `payload`). */
export interface JobPayload {
  actor: SessionUser;
  requestedBy: string;
  [key: string]: unknown;
}

export interface NewJob {
  advertiserId: string | null;
  source: BulkSource;
  action: BulkAction;
  description: string;
  payload: Record<string, unknown>;
  selectionCount: number;
  status?: BulkJobStatusKey;
}

export function jobPayload(ctx: ServiceCtx, extra: Record<string, unknown>): JobPayload {
  const actor = ctx.user.actor ?? ctx.user;
  return { actor: ctx.user, requestedBy: actor.name || actor.email, ...extra };
}

export async function partnerIdOf(tx: Tx, advertiserId: string | null, fallback?: string) {
  if (advertiserId) {
    const adv = await tx.advertiser.findUnique({
      where: { id: advertiserId },
      select: { partnerId: true },
    });
    if (adv) return adv.partnerId;
  }
  return fallback ?? '';
}

export async function createJob(tx: Tx, ctx: ServiceCtx, job: NewJob): Promise<{ id: string }> {
  const actor = ctx.user.actor ?? ctx.user;
  return tx.bulkJob.create({
    data: {
      sandboxId: ctx.sandboxId,
      advertiserId: job.advertiserId,
      partnerId: await partnerIdOf(tx, job.advertiserId, ctx.user.partnerId),
      requestedById: actor.id,
      source: job.source,
      action: job.action,
      description: job.description,
      status: job.status ?? 'QUEUED',
      payload: job.payload as Prisma.InputJsonValue,
      selectionCount: job.selectionCount,
    },
    select: { id: true },
  });
}

export interface FinishInfo {
  status: BulkJobStatusKey;
  errorSummary?: string | null;
  resultKind?: BulkResultKind;
  resultEntityId?: string | null;
  resultStorageKey?: string | null;
}

export async function finishJob(tx: Tx, jobId: string, info: FinishInfo): Promise<void> {
  await tx.bulkJob.update({
    where: { id: jobId },
    data: {
      status: info.status,
      errorSummary: info.errorSummary ?? null,
      ...(info.resultKind ? { resultKind: info.resultKind } : {}),
      ...(info.resultEntityId !== undefined ? { resultEntityId: info.resultEntityId } : {}),
      ...(info.resultStorageKey !== undefined ? { resultStorageKey: info.resultStorageKey } : {}),
    },
  });
}

const CONTENT_TYPE: Record<string, string> = {
  zip: 'application/zip',
  csv: 'text/csv; charset=utf-8',
  txt: 'text/plain; charset=utf-8',
};

export const resultKey = (sandboxId: string, jobId: string, name: string) =>
  `bulk/${sandboxId}/${jobId}/${name}`;

export async function putResult(
  sandboxId: string,
  jobId: string,
  name: string,
  bytes: Uint8Array,
): Promise<string> {
  const key = resultKey(sandboxId, jobId, name);
  await fileStore().put(key, bytes, CONTENT_TYPE[name.split('.').pop() ?? ''] ?? 'application/octet-stream');
  return key;
}

type JobRowDb = Prisma.BulkJobGetPayload<{ include: { items: false } }>;

function rowOf(j: JobRowDb): BulkJobRow {
  const payload = (j.payload ?? {}) as Partial<JobPayload>;
  const action: BulkJobRow['action'] =
    j.status !== 'COMPLETED'
      ? null
      : j.source === 'DUPLICATION'
        ? 'VIEW'
        : j.resultStorageKey
          ? 'RESULTS'
          : null;
  return {
    id: j.id,
    publicId: j.publicId.toString(),
    requestedAt: j.requestedAt.toISOString(),
    partnerId: j.partnerId,
    advertiserId: j.advertiserId,
    description: j.description,
    source: j.source,
    sourceLabel: SOURCE_LABEL[j.source] ?? j.source,
    user: payload.requestedBy ?? '',
    updatedAt: j.updatedAt.toISOString(),
    status: j.status,
    action,
    errorSummary: j.errorSummary,
  };
}

/** K13: the 100 most recent jobs of the sandbox (BLK-015). */
export async function listJobs(user: SessionUser): Promise<{ rows: BulkJobRow[]; capped: boolean }> {
  const ctx = await serviceCtx(user);
  assertRead(ctx);
  return withSandbox(ctx.sandboxId, async (tx) => {
    const rows = await tx.bulkJob.findMany({
      orderBy: [{ requestedAt: 'desc' }, { id: 'desc' }],
      take: LIMITS.BULK_STATUS_ROWS + 1,
    });
    return {
      rows: rows.slice(0, LIMITS.BULK_STATUS_ROWS).map(rowOf),
      capped: rows.length > LIMITS.BULK_STATUS_ROWS,
    };
  });
}

/** K14 */
export async function getJob(user: SessionUser, jobId: string): Promise<BulkJobDetail> {
  const ctx = await serviceCtx(user);
  assertRead(ctx);
  return withSandbox(ctx.sandboxId, async (tx) => {
    const j = await tx.bulkJob.findFirst({
      where: { OR: [{ id: jobId }, ...(/^\d+$/.test(jobId) ? [{ publicId: BigInt(jobId) }] : [])] },
      include: { items: { orderBy: [{ rowNumber: 'asc' }, { id: 'asc' }], take: 5000 } },
    });
    if (!j) throw new ServiceFailure('NOT_FOUND');
    const { items, ...rest } = j;
    return {
      ...rowOf(rest),
      action2: j.action,
      items: items.map((i) => ({
        entityType: i.entityType,
        entityId: i.entityId,
        status: i.status,
        ruleId: i.ruleId,
        message: i.message,
        row: i.rowNumber,
      })),
      resultKey: j.resultStorageKey,
    };
  });
}

/** K14 `/result`: the stored file, or null when the store lost it (memory store after a restart). */
export async function getJobResult(
  user: SessionUser,
  jobId: string,
): Promise<{ bytes: Uint8Array; name: string; contentType: string } | null> {
  const job = await getJob(user, jobId);
  if (!job.resultKey) return null;
  const file = await fileStore().get(job.resultKey);
  if (!file) return null;
  return {
    bytes: file.bytes,
    name: job.resultKey.split('/').pop() ?? 'result',
    contentType: file.contentType,
  };
}
