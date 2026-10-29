import 'server-only';
// Campaign services (module 06 4.1: A1, A2, A3, A4, A5, A6, A8, A13). Every write: can() first, then lib/validation,
// then withChangeLog in the sandbox transaction. Ids may be public ids or row ids (routes.md 6.4).
import type { Campaign, CampaignBudget } from '@prisma/client';
import type { SessionUser } from '@/lib/auth/types';
import { withChangeLog } from '@/lib/changelog';
import { withSandbox, type Tx } from '@/lib/db';
import { getGridMetrics } from '@/lib/metrics/grid-metrics';
import type { CurrencyCode } from '@/lib/money';
import { parseIdRef, whereId } from '@/lib/routes/params';
import { canTransition, validate, type Issue } from '@/lib/validation';
import { todayIn } from '@/lib/validation/primitives';
import { buildContext } from '@/lib/validation/server/context';
import { archiveCampaignChildren, type CascadeResult } from './cascade';
import { kpiActualText, kpiActualTrueViewText, kpiGoalText } from './kpi';
import { budgetRows, campaignData, campaignSnapshotOf, campaignToWire } from './mapping';
import { rangeFromParam } from './range';
import {
  ADVERTISER_CTX_SELECT,
  assertRead,
  assertWrite,
  asResult,
  canWrite,
  changeCtx,
  conflict,
  decimalToNumber,
  forbidden,
  fromDbDate,
  invalid,
  notFound,
  roleOf,
  serviceCtx,
  ServiceFailure,
  staticLoader,
  type Result,
  type ServiceCtx,
} from './service-kit';
import {
  toValidationInput,
  toWireIssues,
  type CampaignCopySource,
  type CampaignDetail,
  type CampaignRow,
  type CampaignWire,
  type CopySetting,
  type EntityStatusKey,
  type WireIssue,
  type WriteMeta,
} from './wire';

type Advertiser = {
  id: string;
  currencyCode: string;
  timeZone: string;
  status: string;
  demandGenFloodlightOptimization: boolean;
  googleInventoryEnabled: boolean;
};
type CampaignFull = Campaign & { budgets: CampaignBudget[] };

export interface ListQuery {
  q?: string;
  /** `['*']` or empty = every status except archived is not implied; default `['ACTIVE']` is set by the caller. */
  status?: string[];
  sort?: { field: string; dir: 'asc' | 'desc' };
  page?: number;
  pageSize?: number;
  d?: string | null;
}

export interface ListResult<R> {
  rows: R[];
  total: number;
  page: number;
  pageSize: number;
  asOf: string;
}

const STATUSES: readonly EntityStatusKey[] = ['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED'];

export function statusFilter(status: string[] | undefined): EntityStatusKey[] | null {
  if (!status || status.length === 0 || status.includes('*')) return null;
  return STATUSES.filter((s) => status.includes(s));
}

function idOrThrow(seg: string) {
  const ref = parseIdRef(seg);
  if (!ref) throw notFound();
  return whereId(ref);
}

async function loadAdvertiser(tx: Tx, aid: string): Promise<Advertiser> {
  const adv = await tx.advertiser.findFirst({
    where: idOrThrow(aid),
    select: ADVERTISER_CTX_SELECT,
  });
  if (!adv) throw notFound();
  return adv;
}

async function loadCampaign(tx: Tx, cid: string): Promise<CampaignFull> {
  const c = await tx.campaign.findFirst({
    where: idOrThrow(cid),
    include: { budgets: { orderBy: { id: 'asc' } } },
  });
  if (!c) throw notFound();
  return c;
}

async function advertiserOf(tx: Tx, advertiserId: string): Promise<Advertiser> {
  const adv = await tx.advertiser.findUnique({
    where: { id: advertiserId },
    select: ADVERTISER_CTX_SELECT,
  });
  if (!adv) throw notFound();
  return adv;
}

function storedInput(c: CampaignFull, currency: CurrencyCode) {
  return toValidationInput(campaignToWire(c), currency);
}

async function campaignIssues(
  ctx: ServiceCtx,
  adv: Advertiser,
  wire: CampaignWire,
  stored?: CampaignFull,
): Promise<Issue[]> {
  const currency = adv.currencyCode as CurrencyCode;
  const vctx = await buildContext(
    staticLoader(ctx.simNow, {
      advertiser: adv,
      ...(stored ? { original: storedInput(stored, currency) } : {}),
    }),
    'campaign',
    { advertiserId: adv.id, ...(stored ? { id: stored.id } : {}) },
    { userId: ctx.user.id, role: roleOf(ctx.user) },
  );
  return validate('campaign', toValidationInput(wire, currency), vctx, { trigger: 'save' });
}

const soft = (issues: Issue[]): WireIssue[] =>
  toWireIssues(issues.filter((i) => !i.blocking && i.message));

function detailOf(ctx: ServiceCtx, c: CampaignFull, adv: Advertiser): CampaignDetail {
  const today = todayIn(ctx.simNow, adv.timeZone);
  const start = fromDbDate(c.plannedStart);
  return {
    id: c.id,
    publicId: c.publicId.toString(),
    advertiserId: c.advertiserId,
    version: c.version,
    archived: c.status === 'ARCHIVED',
    startLocked: !!start && start <= today,
    value: campaignToWire(c),
    currency: adv.currencyCode as CurrencyCode,
    timeZone: adv.timeZone,
  };
}

// ---------------------------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------------------------

/** A1: campaigns of one advertiser. Numbers come from getGridMetrics only (build-plan 4.11 item 6). */
export async function listCampaigns(
  user: SessionUser,
  aid: string,
  query: ListQuery = {},
): Promise<ListResult<CampaignRow>> {
  const ctx = await serviceCtx(user);
  assertRead(ctx);
  const { adv, campaigns, alerts, segments } = await withSandbox(ctx.sandboxId, async (tx) => {
    const adv = await loadAdvertiser(tx, aid);
    const statuses = statusFilter(query.status);
    const q = query.q?.trim() ?? '';
    const idQuery = /^\d{1,18}$/.test(q) ? BigInt(q) : null;
    const campaigns = await tx.campaign.findMany({
      where: {
        advertiserId: adv.id,
        ...(statuses ? { status: { in: statuses } } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' as const } },
                ...(idQuery !== null ? [{ publicId: idQuery }] : []),
              ],
            }
          : {}),
      },
      orderBy: { name: 'asc' },
    });
    const ids = campaigns.map((c) => c.id);
    const alerts = await tx.alert.findMany({
      where: { campaignId: { in: ids }, state: 'OPEN' },
      select: { campaignId: true, severity: true },
    });
    const segments = await tx.budgetSegment.findMany({
      where: {
        io: { campaignId: { in: ids }, status: { not: 'ARCHIVED' }, budgetUnit: 'CURRENCY' },
      },
      select: { amount: true, io: { select: { campaignId: true } } },
    });
    return { adv, campaigns, alerts, segments };
  });
  const currency = adv.currencyCode as CurrencyCode;
  const range = rangeFromParam(query.d, todayIn(ctx.simNow, adv.timeZone));
  const metrics = await getGridMetrics({
    level: 'campaign',
    ids: campaigns.map((c) => c.id),
    range,
    sandboxId: ctx.sandboxId,
  });
  const budgetBy = new Map<string, number>();
  for (const s of segments) {
    const cid = s.io.campaignId;
    budgetBy.set(cid, (budgetBy.get(cid) ?? 0) + Number(s.amount.toString()));
  }
  let rows: CampaignRow[] = campaigns.map((c) => {
    const m = metrics[c.id];
    const own = alerts.filter((a) => a.campaignId === c.id);
    const km = {
      impressions: m?.impressions ?? 0,
      clicks: m?.clicks ?? 0,
      conversions: m?.conversions ?? 0,
      revenue: m?.revenue ?? 0,
    };
    return {
      id: c.id,
      publicId: c.publicId.toString(),
      name: c.name,
      status: c.status === 'SCHEDULED_FOR_DELETION' ? 'ARCHIVED' : c.status,
      alertCount: own.length,
      alertSeverity: own.some((a) => a.severity === 'CRITICAL')
        ? 'critical'
        : own.length
          ? 'warning'
          : null,
      budget: budgetBy.get(c.id) ?? null,
      spent: km.revenue,
      kpiGoal: kpiGoalText(c.kpi, decimalToNumber(c.kpiValue), currency),
      kpiActual: kpiActualText(c.kpi, km, currency),
      kpiActualTrueView: kpiActualTrueViewText(c.kpi, km, currency),
    };
  });
  const sort = query.sort;
  if (sort && ['name', 'spent', 'budget'].includes(sort.field)) {
    const dir = sort.dir === 'desc' ? -1 : 1;
    rows = [...rows].sort((a, b) => {
      if (sort.field === 'name') return a.name.localeCompare(b.name) * dir;
      const key = sort.field as 'spent' | 'budget';
      return ((a[key] ?? -1) - (b[key] ?? -1)) * dir;
    });
  }
  const pageSize = query.pageSize ?? 20;
  const page = Math.max(1, query.page ?? 1);
  return {
    rows: rows.slice((page - 1) * pageSize, page * pageSize),
    total: rows.length,
    page,
    pageSize,
    asOf: ctx.simNow.toISOString(),
  };
}

/** A2 */
export async function getCampaign(user: SessionUser, cid: string): Promise<CampaignDetail> {
  const ctx = await serviceCtx(user);
  assertRead(ctx);
  return withSandbox(ctx.sandboxId, async (tx) => {
    const c = await loadCampaign(tx, cid);
    return detailOf(ctx, c, await advertiserOf(tx, c.advertiserId));
  });
}

/** A13 (DLG-10): the settings Copy settings can take, only those asked for (V-06-15). */
export async function getCopySource(
  user: SessionUser,
  cid: string,
  settings: readonly CopySetting[] = ['frequencyCap', 'goal', 'creativeTypes'],
): Promise<CampaignCopySource> {
  const { value } = await getCampaign(user, cid);
  const out: CampaignCopySource = {};
  if (settings.includes('frequencyCap')) out.frequencyCap = value.frequencyCap;
  if (settings.includes('goal')) {
    out.goal = value.goal;
    out.kpi = value.kpi;
  }
  if (settings.includes('creativeTypes')) out.creativeTypes = value.creativeTypes;
  return out;
}

/** A3: live validation with the server context (debounced by the form). */
export async function validateCampaign(
  user: SessionUser,
  aid: string,
  wire: CampaignWire,
  cid?: string,
): Promise<WireIssue[]> {
  const ctx = await serviceCtx(user);
  assertRead(ctx);
  return withSandbox(ctx.sandboxId, async (tx) => {
    const adv = await loadAdvertiser(tx, aid);
    const stored = cid ? await loadCampaign(tx, cid) : undefined;
    return toWireIssues(await campaignIssues(ctx, adv, wire, stored));
  });
}

// ---------------------------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------------------------

/** A4: create. Redirect target is `[C]` (routes.md 6.3). */
export async function createCampaign(
  user: SessionUser,
  aid: string,
  wire: CampaignWire,
  meta: WriteMeta = {},
): Promise<Result<{ id: string; publicId: string }>> {
  return asResult(async () => {
    const ctx = await serviceCtx(user);
    assertWrite(ctx);
    return withSandbox(ctx.sandboxId, async (tx) => {
      const adv = await loadAdvertiser(tx, aid);
      const issues = await campaignIssues(ctx, adv, wire);
      if (issues.some((i) => i.blocking)) throw invalid(issues);
      const status = wire.status === 'PAUSED' ? 'PAUSED' : 'ACTIVE';
      const created = await withChangeLog(
        changeCtx(ctx, tx, { note: meta.changeNote ?? '' }),
        { type: 'CAMPAIGN', chain: { advertiserId: adv.id } },
        async (t) => {
          const c = await t.campaign.create({
            data: { sandboxId: ctx.sandboxId, advertiserId: adv.id, status, ...campaignData(wire) },
            select: { id: true, publicId: true },
          });
          const rows = budgetRows(wire).map(({ id: _id, ...b }) => ({
            ...b,
            sandboxId: ctx.sandboxId,
            campaignId: c.id,
          }));
          if (rows.length) await t.campaignBudget.createMany({ data: rows });
          return c;
        },
      );
      return {
        data: { id: created.id, publicId: created.publicId.toString() },
        warnings: soft(issues),
      };
    });
  });
}

/** A5: update with optimistic lock (`expectedVersion`, DLG-11 on CONFLICT). */
export async function updateCampaign(
  user: SessionUser,
  cid: string,
  wire: CampaignWire,
  meta: WriteMeta = {},
): Promise<Result<CampaignDetail>> {
  return asResult(async () => {
    const ctx = await serviceCtx(user);
    assertWrite(ctx);
    return withSandbox(ctx.sandboxId, async (tx) => {
      const stored = await loadCampaign(tx, cid);
      const adv = await advertiserOf(tx, stored.advertiserId);
      if (meta.expectedVersion !== undefined && meta.expectedVersion !== stored.version)
        throw conflict();
      const issues = await campaignIssues(ctx, adv, wire, stored);
      if (issues.some((i) => i.blocking)) throw invalid(issues);
      const status =
        wire.status === 'ACTIVE' || wire.status === 'PAUSED' ? wire.status : stored.status;
      await withChangeLog(
        changeCtx(ctx, tx, { note: meta.changeNote ?? '' }),
        { type: 'CAMPAIGN', id: stored.id, chain: { advertiserId: stored.advertiserId } },
        async (t) => {
          const n = await t.campaign.updateMany({
            where: { id: stored.id, version: stored.version },
            data: { ...campaignData(wire), status, version: { increment: 1 } },
          });
          if (n.count === 0) throw conflict();
          const rows = budgetRows(wire);
          const keep = new Set(rows.map((r) => r.id).filter((id): id is string => !!id));
          await t.campaignBudget.deleteMany({
            where: { campaignId: stored.id, id: { notIn: [...keep] } },
          });
          for (const { id, ...row } of rows) {
            if (id && stored.budgets.some((b) => b.id === id)) {
              await t.campaignBudget.update({ where: { id }, data: row });
            } else {
              await t.campaignBudget.create({
                data: { ...row, sandboxId: ctx.sandboxId, campaignId: stored.id },
              });
            }
          }
          return { id: stored.id };
        },
      );
      const fresh = await loadCampaign(tx, stored.id);
      return { data: detailOf(ctx, fresh, adv), warnings: soft(issues) };
    });
  });
}

function statusIssue(message: string): WireIssue[] {
  return [{ path: 'status', severity: 'error', code: 'STATE', message }];
}

/** A6: row hover Activate / Pause (VAL 4.2). Children keep their own status. */
export async function setCampaignStatus(
  user: SessionUser,
  cid: string,
  to: 'ACTIVE' | 'PAUSED',
): Promise<Result<{ status: 'ACTIVE' | 'PAUSED'; version: number }>> {
  return asResult(async () => {
    const ctx = await serviceCtx(user);
    assertWrite(ctx);
    return withSandbox(ctx.sandboxId, async (tx) => {
      const c = await loadCampaign(tx, cid);
      if (c.status === to) return { data: { status: to, version: c.version } };
      const check = canTransition('campaign', c.status, to, { role: roleOf(user) });
      if (!check.ok) {
        if (check.reason === 'ROLE' || check.reason === 'LIMITED_ACCESS') throw forbidden();
        throw new ServiceFailure(
          'INVALID',
          statusIssue("This status change isn't available for this campaign."),
        );
      }
      const updated = await withChangeLog(
        changeCtx(ctx, tx),
        { type: 'CAMPAIGN', id: c.id, chain: { advertiserId: c.advertiserId } },
        (t) =>
          t.campaign.update({
            where: { id: c.id },
            data: { status: to, version: { increment: 1 } },
            select: { id: true, version: true },
          }),
      );
      return { data: { status: to, version: updated.version } };
    });
  });
}

/**
 * A8 (archive with cascade, after DLG-03): one BulkJob, then one ChangeGroup per campaign, IO and line item,
 * all with source BULK_EDIT and the job id (V-06-14).
 */
export async function archiveCampaigns(
  user: SessionUser,
  cids: string[],
): Promise<Result<{ jobId: string; campaigns: number } & CascadeResult>> {
  return asResult(async () => {
    const ctx = await serviceCtx(user);
    assertWrite(ctx);
    return withSandbox(ctx.sandboxId, async (tx) => {
      const campaigns: CampaignFull[] = [];
      for (const cid of cids) campaigns.push(await loadCampaign(tx, cid));
      const first = campaigns[0];
      if (!first) throw notFound();
      const partner = await tx.advertiser.findUnique({
        where: { id: first.advertiserId },
        select: { partnerId: true },
      });
      const actor = ctx.user.actor ?? ctx.user;
      const job = await tx.bulkJob.create({
        data: {
          sandboxId: ctx.sandboxId,
          advertiserId: first.advertiserId,
          partnerId: partner?.partnerId ?? '',
          requestedById: actor.id,
          source: 'BULK_EDIT',
          action: 'ARCHIVE',
          description: `Archived ${campaigns.length} ${campaigns.length === 1 ? 'campaign' : 'campaigns'}`,
          status: 'COMPLETED',
          selectionCount: campaigns.length,
        },
        select: { id: true },
      });
      const cctx = { ...changeCtx(ctx, tx, { source: 'BULK_EDIT', bulkJobId: job.id }), tx };
      const total: CascadeResult = { insertionOrders: 0, lineItems: 0 };
      let archived = 0;
      for (const c of campaigns) {
        if (c.status !== 'ARCHIVED') {
          const check = canTransition('campaign', c.status, 'ARCHIVED', { role: roleOf(user) });
          if (!check.ok) throw forbidden();
          await withChangeLog(
            cctx,
            { type: 'CAMPAIGN', id: c.id, chain: { advertiserId: c.advertiserId } },
            (t) =>
              t.campaign.update({
                where: { id: c.id },
                data: { status: 'ARCHIVED', version: { increment: 1 } },
                select: { id: true },
              }),
          );
          archived += 1;
        }
        const r = await archiveCampaignChildren(cctx, c);
        total.insertionOrders += r.insertionOrders;
        total.lineItems += r.lineItems;
      }
      return { data: { jobId: job.id, campaigns: archived, ...total } };
    });
  });
}

/** Whether the person may create and edit here (New campaign button, inline menus). */
export async function campaignAccess(user: SessionUser): Promise<{ canWrite: boolean }> {
  if (!user.sandboxId) return { canWrite: false };
  return { canWrite: canWrite(user, user.sandboxId) };
}

export { campaignSnapshotOf };
