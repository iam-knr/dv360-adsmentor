import 'server-only';
// Insertion order services (module 07 4.1: B1, B2, B5, B6, B7, B8, B9, B10, B15). Every write: can() first, then
// lib/validation with the campaign and line item context, then withChangeLog in the sandbox transaction.
import type { Campaign, LineItem } from '@prisma/client';
import type { SessionUser } from '@/lib/auth/types';
import { withChangeLog } from '@/lib/changelog';
import { withSandbox, type Tx } from '@/lib/db';
import { getGridMetrics } from '@/lib/metrics/grid-metrics';
import { toMinor, type CurrencyCode } from '@/lib/money';
import { parseIdRef, whereId } from '@/lib/routes/params';
import {
  canTransition,
  validate,
  type Issue,
  type LineItemSnapshot,
  type ValidateOptions,
} from '@/lib/validation';
import { todayIn } from '@/lib/validation/primitives';
import { buildContext } from '@/lib/validation/server/context';
import type { BidStrategy } from '@/lib/validation/constants/io-matrix';
import { archiveIoCascade, lineItemRegistry, type CascadeResult } from '@/lib/campaigns/cascade';
import { kpiGoalText } from '@/lib/campaigns/kpi';
import { campaignSnapshotOf, frequencyFromRow } from '@/lib/campaigns/mapping';
import { rangeFromParam } from '@/lib/campaigns/range';
import { statusFilter, type ListQuery, type ListResult } from '@/lib/campaigns/service';
import {
  ADVERTISER_CTX_SELECT,
  assertRead,
  assertWrite,
  asResult,
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
} from '@/lib/campaigns/service-kit';
import { toWireIssues, type WireIssue, type WriteMeta } from '@/lib/campaigns/wire';
import { feeRows, ioData, ioToWire, segmentRows, type IoFull } from './mapping';
import { automationPatch, needsPropagation } from './propagation';
import { toIoValidationInput, type IoDetail, type IoRow, type IoWire } from './wire';

type Advertiser = {
  id: string;
  currencyCode: string;
  timeZone: string;
  status: string;
  demandGenFloodlightOptimization: boolean;
  googleInventoryEnabled: boolean;
};

const IO_INCLUDE = {
  segments: { orderBy: { ordinal: 'asc' as const } },
  fees: { orderBy: [{ kind: 'asc' as const }, { slot: 'asc' as const }] },
};

function idOrThrow(seg: string) {
  const ref = parseIdRef(seg);
  if (!ref) throw notFound();
  return whereId(ref);
}

async function loadIo(tx: Tx, ioId: string): Promise<IoFull> {
  const io = await tx.insertionOrder.findFirst({ where: idOrThrow(ioId), include: IO_INCLUDE });
  if (!io) throw notFound();
  return io;
}

async function loadCampaignRow(tx: Tx, where: { id: string } | { publicId: bigint }) {
  const c = await tx.campaign.findFirst({ where });
  if (!c) throw notFound();
  return c;
}

async function advertiserOf(tx: Tx, id: string): Promise<Advertiser> {
  const adv = await tx.advertiser.findUnique({ where: { id }, select: ADVERTISER_CTX_SELECT });
  if (!adv) throw notFound();
  return adv;
}

function liSnapshot(li: LineItem, currency: CurrencyCode): LineItemSnapshot {
  return {
    id: li.id,
    type: li.type,
    status: li.status === 'SCHEDULED_FOR_DELETION' ? 'ARCHIVED' : li.status,
    budgetAmount:
      li.budgetMode === 'UNLIMITED_UP_TO_IO' || li.budgetAmount === null
        ? null
        : toMinor(Number(li.budgetAmount.toString()), currency),
    flight: {
      mode: li.flightMode === 'CUSTOM' ? 'CUSTOM' : 'SAME_AS_IO',
      startDate: li.flightStart ? li.flightStart.toISOString().slice(0, 10) : null,
      endDate: li.flightEnd ? li.flightEnd.toISOString().slice(0, 10) : null,
    },
    pacingType: li.pacingType,
    bidMode: li.bidKind,
    optimizedTowards: li.bidGoal ?? null,
  };
}

/** Spend per segment so far, in the budget unit (major money or impressions). Numbers come from getGridMetrics. */
async function segmentSpend(
  ctx: ServiceCtx,
  io: IoFull,
  today: string,
): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const s of io.segments) {
    const start = fromDbDate(s.startDate) ?? today;
    const end = fromDbDate(s.endDate) ?? today;
    if (start > today) {
      out[s.id] = 0;
      continue;
    }
    const m = await getGridMetrics({
      level: 'io',
      ids: [io.id],
      range: { from: start, to: end < today ? end : today },
      sandboxId: ctx.sandboxId,
    });
    const row = m[io.id];
    out[s.id] = io.budgetUnit === 'IMPRESSIONS' ? (row?.impressions ?? 0) : (row?.revenue ?? 0);
  }
  return out;
}

function spentMinor(spent: Record<string, number>, io: IoFull, currency: CurrencyCode) {
  if (io.budgetUnit === 'IMPRESSIONS') return spent;
  return Object.fromEntries(Object.entries(spent).map(([k, v]) => [k, toMinor(v, currency)]));
}

interface IoParts {
  adv: Advertiser;
  campaign: Campaign;
  lineItems: LineItem[];
  stored?: IoFull;
  spent?: Record<string, number>;
}

async function ioIssues(
  ctx: ServiceCtx,
  parts: IoParts,
  wire: IoWire,
  options: ValidateOptions = {},
): Promise<Issue[]> {
  const currency = parts.adv.currencyCode as CurrencyCode;
  const stored = parts.stored;
  const vctx = await buildContext(
    staticLoader(ctx.simNow, {
      advertiser: parts.adv,
      campaign: campaignSnapshotOf(parts.campaign),
      lineItems: parts.lineItems.map((li) => liSnapshot(li, currency)),
      ...(stored
        ? {
            original: toIoValidationInput(
              ioToWire(stored),
              currency,
              spentMinor(parts.spent ?? {}, stored, currency),
            ),
          }
        : {}),
    }),
    'insertionOrder',
    {
      advertiserId: parts.adv.id,
      campaignId: parts.campaign.id,
      ...(stored ? { id: stored.id } : {}),
    },
    { userId: ctx.user.id, role: roleOf(ctx.user) },
  );
  return validate('insertionOrder', toIoValidationInput(wire, currency), vctx, {
    trigger: 'save',
    ...options,
  });
}

const soft = (issues: Issue[]): WireIssue[] =>
  toWireIssues(issues.filter((i) => !i.blocking && i.message));

async function detailOf(
  ctx: ServiceCtx,
  tx: Tx,
  io: IoFull,
  adv: Advertiser,
  campaign: Campaign,
): Promise<IoDetail> {
  const today = todayIn(ctx.simNow, adv.timeZone);
  const spent = await segmentSpend(ctx, io, today);
  const lis = await tx.lineItem.findMany({
    where: { ioId: io.id, status: { not: 'ARCHIVED' } },
    select: { type: true, status: true },
  });
  const byType: Record<string, number> = {};
  for (const li of lis) byType[li.type] = (byType[li.type] ?? 0) + 1;
  const value = ioToWire(io);
  return {
    id: io.id,
    publicId: io.publicId.toString(),
    campaignId: io.campaignId,
    campaignPublicId: campaign.publicId.toString(),
    advertiserId: io.advertiserId,
    version: io.version,
    archived: io.status === 'ARCHIVED',
    value,
    segments: value.budget.segments.map((s) => {
      const amount = Number(s.amount) || 0;
      const used = s.id ? (spent[s.id] ?? 0) : 0;
      return {
        ...s,
        spent: used,
        remaining: Math.max(0, amount - used),
        startLocked: !!s.startDate && s.startDate <= today,
      };
    }),
    campaignFrequencyCap: frequencyFromRow(campaign),
    lineItemCounts: {
      total: lis.length,
      active: lis.filter((l) => l.status === 'ACTIVE').length,
      byType,
    },
    currency: adv.currencyCode as CurrencyCode,
    timeZone: adv.timeZone,
  };
}

// ---------------------------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------------------------

export type IoListScope = { advertiserId: string } | { campaignId: string };

/** B1: IO list at advertiser or campaign scope. Numbers come from getGridMetrics only. */
export async function listInsertionOrders(
  user: SessionUser,
  scope: IoListScope,
  query: ListQuery & { type?: string[] } = {},
): Promise<ListResult<IoRow>> {
  const ctx = await serviceCtx(user);
  assertRead(ctx);
  const data = await withSandbox(ctx.sandboxId, async (tx) => {
    let advertiserId: string;
    let campaignId: string | undefined;
    if ('campaignId' in scope) {
      const c = await loadCampaignRow(tx, idOrThrow(scope.campaignId));
      advertiserId = c.advertiserId;
      campaignId = c.id;
    } else {
      const a = await tx.advertiser.findFirst({
        where: idOrThrow(scope.advertiserId),
        select: { id: true },
      });
      if (!a) throw notFound();
      advertiserId = a.id;
    }
    const adv = await advertiserOf(tx, advertiserId);
    const statuses = statusFilter(query.status);
    const types = (query.type ?? []).filter((t): t is IoRow['type'] =>
      ['STANDARD', 'CTV_OTT', 'DOOH'].includes(t),
    );
    const q = query.q?.trim() ?? '';
    const idQuery = /^\d{1,18}$/.test(q) ? BigInt(q) : null;
    const ios = await tx.insertionOrder.findMany({
      where: {
        advertiserId,
        ...(campaignId ? { campaignId } : {}),
        ...(statuses ? { status: { in: statuses } } : {}),
        ...(types.length ? { type: { in: types } } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' as const } },
                ...(idQuery !== null ? [{ publicId: idQuery }] : []),
              ],
            }
          : {}),
      },
      include: { segments: { orderBy: { ordinal: 'asc' } }, campaign: true },
      orderBy: { name: 'asc' },
    });
    const alerts = await tx.alert.findMany({
      where: { ioId: { in: ios.map((i) => i.id) }, state: 'OPEN' },
      select: { ioId: true },
    });
    return { adv, ios, alerts };
  });
  const { adv, ios, alerts } = data;
  const currency = adv.currencyCode as CurrencyCode;
  const today = todayIn(ctx.simNow, adv.timeZone);
  const metrics = await getGridMetrics({
    level: 'io',
    ids: ios.map((i) => i.id),
    range: rangeFromParam(query.d, today),
    sandboxId: ctx.sandboxId,
  });
  let rows: IoRow[] = ios.map((io) => {
    const m = metrics[io.id];
    const total = io.segments.reduce((s, seg) => s + Number(seg.amount.toString()), 0);
    const current =
      io.segments.find((s) => (fromDbDate(s.endDate) ?? '') >= today) ??
      io.segments[io.segments.length - 1];
    const custom =
      m && m.customImpressionCost > 0 ? m.customImpressionValue / m.customImpressionCost : null;
    return {
      id: io.id,
      publicId: io.publicId.toString(),
      campaignId: io.campaignId,
      campaignPublicId: io.campaign.publicId.toString(),
      name: io.name,
      status: io.status === 'SCHEDULED_FOR_DELETION' ? 'ARCHIVED' : io.status,
      alertCount: alerts.filter((a) => a.ioId === io.id).length,
      type: io.type,
      budget: io.segments.length ? total : null,
      budgetUnit: io.budgetUnit,
      editableSegment: current
        ? { id: current.id, amount: Number(current.amount.toString()), spent: 0 }
        : null,
      goal: kpiGoalText(io.kpi, decimalToNumber(io.kpiValue), currency),
      impressions: m?.impressions ?? 0,
      revenue: m?.revenue ?? 0,
      interactions: m?.interactions ?? 0,
      conversions: m?.conversions ?? 0,
      cpa: m && m.conversions > 0 ? m.cpa : null,
      customImpressionValueCost: custom,
      parentPaused: io.campaign.status === 'PAUSED' || io.campaign.status === 'ARCHIVED',
    };
  });
  const sort = query.sort;
  if (sort) {
    const dir = sort.dir === 'desc' ? -1 : 1;
    const key = sort.field as keyof IoRow;
    rows = [...rows].sort((a, b) => {
      const x = a[key];
      const y = b[key];
      if (typeof x === 'string' && typeof y === 'string') return x.localeCompare(y) * dir;
      return ((Number(x) || 0) - (Number(y) || 0)) * dir;
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

/** B2 */
export async function getInsertionOrder(user: SessionUser, ioId: string): Promise<IoDetail> {
  const ctx = await serviceCtx(user);
  assertRead(ctx);
  return withSandbox(ctx.sandboxId, async (tx) => {
    const io = await loadIo(tx, ioId);
    const campaign = await loadCampaignRow(tx, { id: io.campaignId });
    return detailOf(ctx, tx, io, await advertiserOf(tx, io.advertiserId), campaign);
  });
}

/** Campaign context a new IO form needs: currency, today and the campaign's frequency cap (IO-061). */
export async function newIoContext(user: SessionUser, cid: string) {
  const ctx = await serviceCtx(user);
  assertRead(ctx);
  return withSandbox(ctx.sandboxId, async (tx) => {
    const c = await loadCampaignRow(tx, idOrThrow(cid));
    const adv = await advertiserOf(tx, c.advertiserId);
    return {
      campaignId: c.id,
      campaignFrequencyCap: frequencyFromRow(c),
      currency: adv.currencyCode as CurrencyCode,
      timeZone: adv.timeZone,
      today: todayIn(ctx.simNow, adv.timeZone),
      simNow: ctx.simNow.toISOString(),
    };
  });
}

/** B5 */
export async function validateInsertionOrder(
  user: SessionUser,
  cid: string,
  wire: IoWire,
  ioId?: string,
): Promise<WireIssue[]> {
  const ctx = await serviceCtx(user);
  assertRead(ctx);
  return withSandbox(ctx.sandboxId, async (tx) => {
    const stored = ioId ? await loadIo(tx, ioId) : undefined;
    const campaign = await loadCampaignRow(tx, stored ? { id: stored.campaignId } : idOrThrow(cid));
    const adv = await advertiserOf(tx, campaign.advertiserId);
    const lineItems = stored
      ? await tx.lineItem.findMany({ where: { ioId: stored.id, status: { not: 'ARCHIVED' } } })
      : [];
    const spent = stored
      ? await segmentSpend(ctx, stored, todayIn(ctx.simNow, adv.timeZone))
      : undefined;
    return toWireIssues(
      await ioIssues(ctx, { adv, campaign, lineItems, ...(stored ? { stored, spent } : {}) }, wire),
    );
  });
}

// ---------------------------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------------------------

/** B6: create. Media fee 1 (system) is always written. Redirect target `[IO]/explorerlis` (routes.md 6.3). */
export async function createInsertionOrder(
  user: SessionUser,
  cid: string,
  wire: IoWire,
  meta: WriteMeta = {},
): Promise<Result<{ id: string; publicId: string }>> {
  return asResult(async () => {
    const ctx = await serviceCtx(user);
    assertWrite(ctx);
    return withSandbox(ctx.sandboxId, async (tx) => {
      const campaign = await loadCampaignRow(tx, idOrThrow(cid));
      const adv = await advertiserOf(tx, campaign.advertiserId);
      const issues = await ioIssues(
        ctx,
        { adv, campaign, lineItems: [] },
        wire,
        wire.status === 'ACTIVE' ? { targetStatus: 'ACTIVE' } : {},
      );
      if (issues.some((i) => i.blocking)) throw invalid(issues);
      const created = await withChangeLog(
        changeCtx(ctx, tx, { note: meta.changeNote ?? '' }),
        {
          type: 'INSERTION_ORDER',
          chain: { advertiserId: adv.id, campaignId: campaign.id },
        },
        async (t) => {
          const io = await t.insertionOrder.create({
            data: {
              sandboxId: ctx.sandboxId,
              campaignId: campaign.id,
              advertiserId: adv.id,
              status: wire.status === 'ACTIVE' ? 'ACTIVE' : 'DRAFT',
              type: wire.type ?? 'STANDARD',
              objective: wire.objective ?? 'NONE',
              budgetUnit: wire.budget.type ?? 'CURRENCY',
              ...ioData(wire),
            },
            select: { id: true, publicId: true },
          });
          await t.budgetSegment.createMany({
            data: segmentRows(wire).map(({ id: _id, ...s }) => ({
              ...s,
              sandboxId: ctx.sandboxId,
              ioId: io.id,
            })),
          });
          await t.partnerCost.createMany({
            data: feeRows(wire).map((f) => ({ ...f, sandboxId: ctx.sandboxId, ioId: io.id })),
          });
          return io;
        },
      );
      return {
        data: { id: created.id, publicId: created.publicId.toString() },
        warnings: soft(issues),
      };
    });
  });
}

/** IO-053: give each line item of an automated IO Flight + ASAP pacing and the IO's strategy (SYSTEM entries). */
async function propagateAutomation(
  ctx: ServiceCtx,
  tx: Tx,
  io: { id: string; campaignId: string; advertiserId: string },
  optimizedTowards: BidStrategy | null,
): Promise<number> {
  const lis = await tx.lineItem.findMany({
    where: { ioId: io.id, status: { not: 'ARCHIVED' } },
    select: { id: true, pacingPeriod: true, pacingType: true, bidKind: true, bidGoal: true },
    orderBy: { publicId: 'asc' },
  });
  let touched = 0;
  for (const li of lis) {
    const patch = automationPatch(li, optimizedTowards);
    if (!patch) continue;
    await withChangeLog(
      {
        sandboxId: ctx.sandboxId,
        classroomId: ctx.classroomId,
        actor: { type: 'SYSTEM', systemActor: 'SIM_ENGINE' },
        tx,
      },
      {
        type: 'LINE_ITEM',
        id: li.id,
        chain: {
          advertiserId: io.advertiserId,
          campaignId: io.campaignId,
          ioId: io.id,
          lineItemId: li.id,
        },
      },
      async (t) => {
        await t.lineItem.update({
          where: { id: li.id },
          data: {
            pacingPeriod: patch.pacingPeriod,
            pacingType: patch.pacingType,
            bidKind: patch.bidKind,
            bidGoal: patch.bidGoal as LineItem['bidGoal'],
            version: { increment: 1 },
          },
        });
        return { id: li.id };
      },
      { registry: lineItemRegistry() },
    );
    touched += 1;
  }
  return touched;
}

/** B7 (and B8 when the objective goes to "Insertion order without objective"). */
export async function updateInsertionOrder(
  user: SessionUser,
  ioId: string,
  wire: IoWire,
  meta: WriteMeta = {},
): Promise<Result<IoDetail>> {
  return asResult(async () => {
    const ctx = await serviceCtx(user);
    assertWrite(ctx);
    return withSandbox(ctx.sandboxId, async (tx) => {
      const stored = await loadIo(tx, ioId);
      if (meta.expectedVersion !== undefined && meta.expectedVersion !== stored.version)
        throw conflict();
      const campaign = await loadCampaignRow(tx, { id: stored.campaignId });
      const adv = await advertiserOf(tx, stored.advertiserId);
      const lineItems = await tx.lineItem.findMany({
        where: { ioId: stored.id, status: { not: 'ARCHIVED' } },
      });
      const spent = await segmentSpend(ctx, stored, todayIn(ctx.simNow, adv.timeZone));
      const activating = wire.status === 'ACTIVE' && stored.status !== 'ACTIVE';
      const issues = await ioIssues(
        ctx,
        { adv, campaign, lineItems, stored, spent },
        wire,
        activating ? { targetStatus: 'ACTIVE' } : {},
      );
      if (issues.some((i) => i.blocking)) throw invalid(issues);
      const before = ioToWire(stored).optimization;
      const objective = wire.objective === 'NONE' ? 'NONE' : stored.objective;
      const next: IoWire = { ...wire, type: stored.type, objective };
      const status =
        wire.status === 'ACTIVE' || wire.status === 'PAUSED' || wire.status === 'DRAFT'
          ? wire.status
          : stored.status;
      await withChangeLog(
        changeCtx(ctx, tx, { note: meta.changeNote ?? '' }),
        {
          type: 'INSERTION_ORDER',
          id: stored.id,
          chain: { advertiserId: stored.advertiserId, campaignId: stored.campaignId },
        },
        async (t) => {
          const n = await t.insertionOrder.updateMany({
            where: { id: stored.id, version: stored.version },
            data: { ...ioData(next), objective, status, version: { increment: 1 } },
          });
          if (n.count === 0) throw conflict();
          const rows = segmentRows(next);
          const keep = new Set(rows.map((r) => r.id).filter((id): id is string => !!id));
          await t.budgetSegment.deleteMany({
            where: { ioId: stored.id, id: { notIn: [...keep] } },
          });
          for (const { id, ...row } of rows) {
            if (id && stored.segments.some((s) => s.id === id)) {
              await t.budgetSegment.update({ where: { id }, data: row });
            } else {
              await t.budgetSegment.create({
                data: { ...row, sandboxId: ctx.sandboxId, ioId: stored.id },
              });
            }
          }
          await t.partnerCost.deleteMany({ where: { ioId: stored.id } });
          await t.partnerCost.createMany({
            data: feeRows(next).map((f) => ({ ...f, sandboxId: ctx.sandboxId, ioId: stored.id })),
          });
          return { id: stored.id };
        },
      );
      const savedMode = ioData(next).bidBudgetControl;
      const chosen =
        savedMode === 'IO_AUTOMATED' ? (next.optimization.optimizedTowards ?? null) : null;
      if (
        needsPropagation(
          {
            mode: before.mode ?? 'LI_CONTROLLED',
            optimizedTowards: before.optimizedTowards ?? null,
          },
          { mode: savedMode, optimizedTowards: chosen },
        )
      ) {
        await propagateAutomation(ctx, tx, stored, chosen);
      }
      const fresh = await loadIo(tx, stored.id);
      return { data: await detailOf(ctx, tx, fresh, adv, campaign), warnings: soft(issues) };
    });
  });
}

/** B8: one-way switch to "Insertion order without objective" (IO-005). */
export async function setIoObjectiveToNone(
  user: SessionUser,
  ioId: string,
  meta: WriteMeta = {},
): Promise<Result<IoDetail>> {
  const detail = await getInsertionOrder(user, ioId);
  return updateInsertionOrder(
    user,
    ioId,
    { ...detail.value, objective: 'NONE' },
    {
      expectedVersion: meta.expectedVersion ?? detail.version,
      ...(meta.changeNote ? { changeNote: meta.changeNote } : {}),
    },
  );
}

/** B10: inline Activate / Pause (VAL 4.3; Pause is not offered for Draft). Activation runs IO-090..092. */
export async function setIoStatus(
  user: SessionUser,
  ioId: string,
  to: 'ACTIVE' | 'PAUSED',
): Promise<Result<{ status: 'ACTIVE' | 'PAUSED'; version: number }>> {
  return asResult(async () => {
    const ctx = await serviceCtx(user);
    assertWrite(ctx);
    return withSandbox(ctx.sandboxId, async (tx) => {
      const io = await loadIo(tx, ioId);
      if (io.status === to) return { data: { status: to, version: io.version } };
      const campaign = await loadCampaignRow(tx, { id: io.campaignId });
      const check = canTransition(
        'insertionOrder',
        io.status,
        to,
        { role: roleOf(user) },
        {
          campaignArchived: campaign.status === 'ARCHIVED',
        },
      );
      if (!check.ok) {
        if (check.reason === 'ROLE' || check.reason === 'LIMITED_ACCESS') throw forbidden();
        const message =
          check.ruleId === 'IO-091'
            ? 'Unarchive the campaign before activating this insertion order.'
            : "This status change isn't available for this insertion order.";
        throw new ServiceFailure('INVALID', [
          { path: 'status', severity: 'error', code: check.ruleId ?? 'STATE', message },
        ]);
      }
      if (to === 'ACTIVE') {
        const adv = await advertiserOf(tx, io.advertiserId);
        const lineItems = await tx.lineItem.findMany({
          where: { ioId: io.id, status: { not: 'ARCHIVED' } },
        });
        const issues = await ioIssues(
          ctx,
          { adv, campaign, lineItems },
          { ...ioToWire(io), status: 'ACTIVE' },
          { targetStatus: 'ACTIVE' },
        );
        if (issues.some((i) => i.blocking)) throw invalid(issues);
      }
      const updated = await withChangeLog(
        changeCtx(ctx, tx),
        {
          type: 'INSERTION_ORDER',
          id: io.id,
          chain: { advertiserId: io.advertiserId, campaignId: io.campaignId },
        },
        (t) =>
          t.insertionOrder.update({
            where: { id: io.id },
            data: { status: to, version: { increment: 1 } },
            select: { id: true, version: true },
          }),
      );
      return { data: { status: to, version: updated.version } };
    });
  });
}

/** B9: inline Budget cell edit on one segment (IO-021..IO-023, IO-026, IO-100). */
export async function patchIoBudget(
  user: SessionUser,
  ioId: string,
  segmentId: string,
  amount: number | string,
): Promise<Result<{ budget: number; amount: number }>> {
  return asResult(async () => {
    const ctx = await serviceCtx(user);
    assertWrite(ctx);
    return withSandbox(ctx.sandboxId, async (tx) => {
      const io = await loadIo(tx, ioId);
      const seg = io.segments.find((s) => s.id === segmentId);
      if (!seg) throw notFound();
      const campaign = await loadCampaignRow(tx, { id: io.campaignId });
      const adv = await advertiserOf(tx, io.advertiserId);
      const spent = await segmentSpend(ctx, io, todayIn(ctx.simNow, adv.timeZone));
      const wire = ioToWire(io);
      const next: IoWire = {
        ...wire,
        budget: {
          ...wire.budget,
          segments: wire.budget.segments.map((s) => (s.id === segmentId ? { ...s, amount } : s)),
        },
      };
      const issues = (
        await ioIssues(ctx, { adv, campaign, lineItems: [], stored: io, spent }, next)
      ).filter((i) => i.path.startsWith('budget.segments'));
      if (issues.some((i) => i.blocking)) throw invalid(issues);
      await withChangeLog(
        changeCtx(ctx, tx),
        {
          type: 'INSERTION_ORDER',
          id: io.id,
          chain: { advertiserId: io.advertiserId, campaignId: io.campaignId },
        },
        async (t) => {
          await t.budgetSegment.update({
            where: { id: segmentId },
            data: { amount: String(amount).trim() },
          });
          await t.insertionOrder.update({
            where: { id: io.id },
            data: { version: { increment: 1 } },
          });
          return { id: io.id };
        },
      );
      const fresh = await loadIo(tx, io.id);
      const budget = fresh.segments.reduce((s, x) => s + Number(x.amount.toString()), 0);
      return { data: { budget, amount: Number(amount) } };
    });
  });
}

/** B15: archive IOs with their line items (after DLG-03). One BulkJob; groups share its id. */
export async function archiveInsertionOrders(
  user: SessionUser,
  ioIds: string[],
): Promise<Result<{ jobId: string } & CascadeResult>> {
  return asResult(async () => {
    const ctx = await serviceCtx(user);
    assertWrite(ctx);
    return withSandbox(ctx.sandboxId, async (tx) => {
      const ios: IoFull[] = [];
      for (const id of ioIds) ios.push(await loadIo(tx, id));
      const first = ios[0];
      if (!first) throw notFound();
      const adv = await tx.advertiser.findUnique({
        where: { id: first.advertiserId },
        select: { partnerId: true },
      });
      const actor = ctx.user.actor ?? ctx.user;
      const job = await tx.bulkJob.create({
        data: {
          sandboxId: ctx.sandboxId,
          advertiserId: first.advertiserId,
          partnerId: adv?.partnerId ?? '',
          requestedById: actor.id,
          source: 'BULK_EDIT',
          action: 'ARCHIVE',
          description: `Archived ${ios.length} ${ios.length === 1 ? 'insertion order' : 'insertion orders'}`,
          status: 'COMPLETED',
          selectionCount: ios.length,
        },
        select: { id: true },
      });
      const cctx = { ...changeCtx(ctx, tx, { source: 'BULK_EDIT', bulkJobId: job.id }), tx };
      const total: CascadeResult = { insertionOrders: 0, lineItems: 0 };
      for (const io of ios) {
        const r = await archiveIoCascade(cctx, io);
        total.insertionOrders += r.insertionOrders;
        total.lineItems += r.lineItems;
      }
      return { data: { jobId: job.id, ...total } };
    });
  });
}
