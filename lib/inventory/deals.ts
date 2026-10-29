import 'server-only';
// Deal services (module 13 4.1): Orders and deals list, deal page, status and access changes, bulk status, packages
// and deal groups. Reads run in the viewer's sandbox; every write goes through withChangeLog (4.6) and checks INV-010.
import { Prisma } from '@prisma/client';
import type { SessionUser } from '@/lib/auth/types';
import { withChangeLog, historyWhere, renderLine } from '@/lib/changelog';
import { dealRegistry } from '@/lib/changelog/registries/deal';
import type { Tx } from '@/lib/db';
import {
  asResult,
  changeCtx,
  conflict,
  forbidden,
  notFound,
  ServiceFailure,
  type Result,
  type ServiceCtx,
} from '@/lib/campaigns/service-kit';
import type { WireIssue } from '@/lib/campaigns/wire';
import type { HistoryRow } from '@/lib/creatives/types';
import { liPath } from '@/lib/routes/paths';
import { MSG } from '@/lib/validation/messages';
import {
  DEAL_CURRENCY,
  deliveryByDeal,
  exchangeInfo,
  lineItemsByDeal,
  loadConverter,
  round2,
  toDealRow,
  type StoredDeal,
} from './data';
import { canWriteInventory, loadAdvertiser, parseIdRef, readCtx, whereId, writeCtx } from './guard';
import { INV_MSG } from './messages';
import { dealGroupIssues } from './rules';
import {
  checkDealAction,
  DEFAULT_DEAL_STATUSES,
  effectiveDealStatus,
  type DealAction,
  type DealStatusKey,
} from './transitions';
import type {
  BulkResponse,
  DealGroupRow,
  DealLineItemRow,
  DealRow,
  DealView,
  FrequencyCapView,
  OrderRow,
  OrdersDeals,
  OrdersDealsQuery,
  PackageRow,
} from './types';

const issue = (
  path: string,
  code: string,
  message: string,
  severity: WireIssue['severity'] = 'error',
): WireIssue => ({
  path,
  severity,
  code,
  message,
});
const fail = (...issues: WireIssue[]) => new ServiceFailure('INVALID', issues);

// ---------------------------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------------------------

async function campaignLineItemIds(
  tx: Tx,
  campaignRef: string | undefined,
): Promise<Set<string> | undefined> {
  if (!campaignRef) return undefined;
  const ref = parseIdRef(campaignRef);
  if (!ref) throw notFound();
  const c = await tx.campaign.findFirst({ where: whereId(ref), select: { id: true } });
  if (!c) throw notFound();
  const lis = await tx.lineItem.findMany({ where: { campaignId: c.id }, select: { id: true } });
  return new Set(lis.map((l) => l.id));
}

export async function listOrdersDeals(
  user: SessionUser,
  aid: string,
  q: OrdersDealsQuery = {},
): Promise<OrdersDeals> {
  return readCtx(user, async (tx, ctx) => {
    const adv = await loadAdvertiser(tx, ctx, aid);
    const [exchanges, convert, campaignLis] = await Promise.all([
      exchangeInfo(tx, adv.partnerId),
      loadConverter(tx, ctx.simNow),
      campaignLineItemIds(tx, q.campaignId),
    ]);
    const search = q.q?.trim();
    const stored = await tx.inventorySourceDeal.findMany({
      where: {
        partnerId: adv.partnerId,
        ...(q.exchange?.length ? { exchangeId: { in: q.exchange } } : {}),
        ...(q.commitment?.length ? { commitment: { in: q.commitment } } : {}),
        ...(q.dealType?.length ? { dealType: { in: q.dealType as never[] } } : {}),
        ...(q.format?.length ? { format: { in: q.format } } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' as const } },
                { dealId: { contains: search } },
                ...(/^\d+$/.test(search) ? [{ publicId: BigInt(search) }] : []),
              ],
            }
          : {}),
        // access: partner wide, or this advertiser is listed
        OR: [{ allAdvertisers: true }, { access: { some: { advertiserId: adv.id } } }],
      },
      include: { order: true },
      orderBy: [{ startAt: 'desc' }, { publicId: 'asc' }],
    });
    const ids = stored.map((d) => d.id);
    const [delivery, liIds] = await Promise.all([
      deliveryByDeal(tx, ids),
      lineItemsByDeal(tx, ids),
    ]);
    const rows = stored.map((d) =>
      toDealRow(d, {
        simNow: ctx.simNow,
        currency: adv.currencyCode,
        convert,
        exchanges,
        delivery,
        liIds,
        ...(campaignLis ? { campaignLiIds: campaignLis } : {}),
      }),
    );
    const wanted = new Set<DealStatusKey>(q.status?.length ? q.status : DEFAULT_DEAL_STATUSES);
    const visible = rows.filter((r) => wanted.has(r.status));
    const actionRequired = visible.filter((r) => r.actionRequired);
    const rest = visible.filter((r) => !r.actionRequired);
    const orders = new Map<string, OrderRow>();
    const out: (OrderRow | DealRow)[] = [];
    const orderOf = new Map(
      stored.filter((d) => d.order).map((d) => [d.orderId as string, d.order!]),
    );
    for (const d of rest) {
      if (!d.orderId) {
        out.push(d);
        continue;
      }
      let o = orders.get(d.orderId);
      if (!o) {
        const src = orderOf.get(d.orderId);
        o = {
          kind: 'ORDER',
          id: d.orderId,
          publicId: src ? src.publicId.toString() : d.orderId,
          name: src?.name ?? 'Order',
          externalCode: src?.externalCode ?? '',
          sellerName: src?.sellerName ?? d.sellerName,
          exchangeName: d.exchangeName,
          status: src?.status ?? 'ACTIVE',
          children: [],
        };
        orders.set(d.orderId, o);
        out.push(o);
      }
      o.children.push(d);
    }
    return {
      actionRequired,
      rest: out,
      asOf: ctx.simNow.toISOString(),
      currencyCode: adv.currencyCode,
      canWrite: canWriteInventory(user),
      total: visible.length,
    };
  });
}

async function loadDeal(tx: Tx, partnerId: string, tid: string): Promise<StoredDeal> {
  const ref = parseIdRef(tid);
  if (!ref) throw notFound();
  const d = await tx.inventorySourceDeal.findFirst({
    where: { ...whereId(ref), partnerId },
    include: { order: true },
  });
  if (!d) throw notFound();
  return d;
}

function capView(raw: unknown): FrequencyCapView | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === 'number' ? v : null);
  return {
    enabled: o.enabled === true,
    maxImpressions: num(o.maxImpressions),
    periodCount: num(o.periodCount),
    period: o.period === 'DAYS' || o.period === 'WEEKS' || o.period === 'MONTHS' ? o.period : null,
  };
}

export async function getDeal(
  user: SessionUser,
  aid: string,
  tid: string,
  campaignId?: string,
): Promise<DealView> {
  return readCtx(user, async (tx, ctx) => {
    const adv = await loadAdvertiser(tx, ctx, aid);
    const d = await loadDeal(tx, adv.partnerId, tid);
    const [exchanges, convert, partner, advertisers, access, campaignLis] = await Promise.all([
      exchangeInfo(tx, adv.partnerId),
      loadConverter(tx, ctx.simNow),
      tx.partner.findUnique({ where: { id: adv.partnerId }, select: { name: true } }),
      tx.advertiser.findMany({
        where: { partnerId: adv.partnerId },
        select: { id: true, name: true },
        orderBy: { publicId: 'asc' },
      }),
      tx.dealAccess.findMany({ where: { dealId: d.id }, select: { advertiserId: true } }),
      campaignLineItemIds(tx, campaignId),
    ]);
    const [delivery, liIds] = await Promise.all([
      deliveryByDeal(tx, [d.id]),
      lineItemsByDeal(tx, [d.id]),
    ]);
    const row = toDealRow(d, {
      simNow: ctx.simNow,
      currency: adv.currencyCode,
      convert,
      exchanges,
      delivery,
      liIds,
      ...(campaignLis ? { campaignLiIds: campaignLis } : {}),
    });
    const daily = await tx.simDailyMetric.groupBy({
      by: ['simDate'],
      where: { dealId: d.id, sliceKind: 'deal' },
      _sum: { impressions: true, revenue: true },
      orderBy: { simDate: 'asc' },
    });
    const accessIds = new Set(access.map((a) => a.advertiserId).filter((v): v is string => !!v));
    const canWriteAll = canWriteInventory(user);
    const delivered = delivery.get(d.id)?.impressions ?? null;
    const committed = d.quantityImpressions === null ? null : Number(d.quantityImpressions);
    return {
      row,
      canWriteAll,
      viewOnly: !canWriteAll,
      sellerName: d.sellerName,
      description: d.description,
      exchangeName: row.exchangeName,
      advertiserAccess: {
        allAdvertisers: d.allAdvertisers,
        partnerName: partner?.name ?? '',
        advertisers: advertisers.filter((a) => accessIds.has(a.id)),
      },
      allAdvertisers: advertisers,
      frequencyCap: capView(d.frequencyCap),
      pgDirect: d.pgDirect,
      cost:
        d.cost === null ? null : round2(convert(Number(d.cost), DEAL_CURRENCY, adv.currencyCode)),
      durationSeconds: d.durationSeconds,
      creativeSource: d.creativeSource,
      committed,
      delivered,
      shortfall:
        d.commitment === 'GUARANTEED' && committed !== null
          ? d.shortfallImpressions !== null
            ? Number(d.shortfallImpressions)
            : Math.max(0, committed - (delivered ?? 0))
          : null,
      version: d.version,
      dailySeries: daily.map((r) => ({
        date: r.simDate.toISOString().slice(0, 10),
        impressions: Number(r._sum.impressions ?? 0n),
        spend: round2(convert(Number(r._sum.revenue ?? 0), DEAL_CURRENCY, adv.currencyCode)),
      })),
      currencyCode: adv.currencyCode,
    };
  });
}

export async function getDealLineItems(
  user: SessionUser,
  aid: string,
  tid: string,
  pid: string,
): Promise<DealLineItemRow[]> {
  return readCtx(user, async (tx, ctx) => {
    const adv = await loadAdvertiser(tx, ctx, aid);
    const d = await loadDeal(tx, adv.partnerId, tid);
    const liIds = [...((await lineItemsByDeal(tx, [d.id])).get(d.id) ?? [])];
    if (liIds.length === 0) return [];
    const [lis, metrics] = await Promise.all([
      tx.lineItem.findMany({
        where: { id: { in: liIds } },
        select: {
          id: true,
          publicId: true,
          name: true,
          type: true,
          status: true,
          campaign: { select: { publicId: true, advertiser: { select: { publicId: true } } } },
          io: { select: { publicId: true } },
        },
        orderBy: { publicId: 'asc' },
      }),
      tx.simDailyMetric.groupBy({
        by: ['lineItemId'],
        where: { dealId: d.id, sliceKind: 'deal', lineItemId: { in: liIds } },
        _sum: { impressions: true, revenue: true },
      }),
    ]);
    const m = new Map(metrics.map((r) => [r.lineItemId, r._sum]));
    return lis.map((l) => ({
      id: l.id,
      publicId: l.publicId.toString(),
      name: l.name,
      type: l.type,
      status: l.status,
      impressions: Number(m.get(l.id)?.impressions ?? 0n),
      spend: round2(Number(m.get(l.id)?.revenue ?? 0)),
      href: liPath(
        pid,
        l.campaign.advertiser.publicId.toString(),
        l.campaign.publicId.toString(),
        l.io.publicId.toString(),
        l.publicId.toString(),
      ),
    }));
  });
}

export async function getDealHistory(
  user: SessionUser,
  aid: string,
  tid: string,
  q: { page?: number; pageSize?: number; user?: string; field?: string } = {},
): Promise<{ rows: HistoryRow[]; total: number; page: number; pageSize: number }> {
  return readCtx(user, async (tx, ctx) => {
    const adv = await loadAdvertiser(tx, ctx, aid);
    const d = await loadDeal(tx, adv.partnerId, tid);
    const page = Math.max(1, q.page ?? 1);
    const pageSize = Math.min(q.pageSize ?? 25, 100);
    const where: Prisma.ChangeGroupWhereInput = {
      ...historyWhere({
        sandboxId: ctx.sandboxId,
        scope: { entityType: 'DEAL', entityId: d.id },
        includeSystem: true,
      }),
      ...(q.user ? { actorLabel: { contains: q.user, mode: 'insensitive' as const } } : {}),
      ...(q.field
        ? { entries: { some: { label: { contains: q.field, mode: 'insensitive' as const } } } }
        : {}),
    };
    const [total, groups] = await Promise.all([
      tx.changeGroup.count({ where }),
      tx.changeGroup.findMany({
        where,
        include: { entries: { orderBy: { sortOrder: 'asc' } } },
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    const defs = new Map(dealRegistry.fields.map((f) => [f.path, f]));
    return {
      total,
      page,
      pageSize,
      rows: groups.map((g) => ({
        id: g.id,
        date: g.occurredAt.toISOString(),
        user: g.actorType === 'SYSTEM' ? (g.systemActor ?? 'System') : (g.actorLabel ?? 'Unknown'),
        summary: g.summary,
        lines: g.entries.map((e) => renderLine(e, defs.get(e.fieldPath))),
      })),
    };
  });
}

// ---------------------------------------------------------------------------------------------
// Writes: status, frequency cap, advertiser access
// ---------------------------------------------------------------------------------------------

const ACTION_BY_TARGET = (
  from: DealStatusKey,
  target: 'ACTIVE' | 'PAUSED' | 'ARCHIVED',
): DealAction => {
  if (target === 'ACTIVE') return 'ACTIVATE';
  if (target === 'ARCHIVED') return 'ARCHIVE';
  return from === 'ARCHIVED' ? 'UNARCHIVE' : 'PAUSE';
};

async function currentStatus(
  tx: Tx,
  partnerId: string,
  d: StoredDeal,
  simNow: Date,
): Promise<DealStatusKey> {
  const ex = await exchangeInfo(tx, partnerId);
  return effectiveDealStatus(
    {
      status: d.status,
      endAt: d.endAt,
      exchangeEnabled: !ex.disabled.has(d.exchangeId),
      commitment: d.commitment,
    },
    simNow,
  );
}

async function activeLineItemUse(tx: Tx, dealId: string): Promise<number> {
  const ids = [...((await lineItemsByDeal(tx, [dealId])).get(dealId) ?? [])];
  if (ids.length === 0) return 0;
  return tx.lineItem.count({ where: { id: { in: ids }, status: 'ACTIVE' } });
}

const TARGET_STATUS: Record<DealAction, 'ACTIVE' | 'PAUSED' | 'ARCHIVED'> = {
  ACTIVATE: 'ACTIVE',
  PAUSE: 'PAUSED',
  ARCHIVE: 'ARCHIVED',
  UNARCHIVE: 'PAUSED',
};

async function applyAction(
  tx: Tx,
  ctx: ServiceCtx,
  user: SessionUser,
  partnerId: string,
  advertiserId: string,
  d: StoredDeal,
  action: DealAction,
  extra: { bulkJobId?: string; note?: string } = {},
): Promise<WireIssue[]> {
  const from = await currentStatus(tx, partnerId, d, ctx.simNow);
  const check = checkDealAction(from, action, {
    allowPausing: d.allowPausing,
    canWriteAll: canWriteInventory(user),
  });
  if (!check.ok) throw fail(issue('status', check.ruleId, check.message));
  const warnings: WireIssue[] = [];
  if (action === 'ARCHIVE') {
    const n = await activeLineItemUse(tx, d.id);
    if (n > 0)
      warnings.push(
        issue(
          'status',
          'INV-013',
          `${n} line ${n === 1 ? 'item uses' : 'items use'} this deal.`,
          'warning',
        ),
      );
  }
  await withChangeLog(
    changeCtx(ctx, tx, {
      ...(extra.bulkJobId ? { bulkJobId: extra.bulkJobId, source: 'BULK_EDIT' as const } : {}),
      ...(extra.note ? { note: extra.note } : {}),
    }),
    { type: 'DEAL', id: d.id, chain: { advertiserId } },
    (t) =>
      t.inventorySourceDeal.update({
        where: { id: d.id },
        data: { status: TARGET_STATUS[action], version: { increment: 1 } },
        select: { id: true },
      }),
  );
  return warnings;
}

export interface UpdateDealInput {
  status?: 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
  frequencyCap?: FrequencyCapView | null;
  /** Row ids of the advertisers that may use the deal; `null` = all advertisers of the partner. */
  advertiserAccess?: string[] | null;
  expectedVersion?: number;
  note?: string;
}

function capIssues(cap: FrequencyCapView): WireIssue[] {
  if (!cap.enabled) return [];
  const out: WireIssue[] = [];
  const whole = (v: number | null) => v !== null && Number.isInteger(v) && v >= 1;
  if (!whole(cap.maxImpressions))
    out.push(issue('frequencyCap.maxImpressions', 'FRQ-001', MSG.ENTER_POSITIVE));
  if (!whole(cap.periodCount))
    out.push(issue('frequencyCap.periodCount', 'FRQ-001', MSG.ENTER_POSITIVE));
  if (!cap.period) out.push(issue('frequencyCap.period', 'FRQ-001', MSG.SELECTION_REQUIRED));
  return out;
}

export async function updateDeal(
  user: SessionUser,
  aid: string,
  tid: string,
  input: UpdateDealInput,
): Promise<Result<{ version: number }>> {
  return asResult(() =>
    writeCtx(user, async (tx, ctx) => {
      const adv = await loadAdvertiser(tx, ctx, aid);
      const d = await loadDeal(tx, adv.partnerId, tid);
      if (!canWriteInventory(user)) throw forbidden();
      if (input.expectedVersion !== undefined && input.expectedVersion !== d.version)
        throw conflict();
      const warnings: WireIssue[] = [];
      if (input.frequencyCap) {
        const bad = capIssues(input.frequencyCap);
        if (bad.length) throw fail(...bad);
      }
      let accessIds: string[] | null | undefined;
      if (input.advertiserAccess !== undefined) {
        if (input.advertiserAccess === null) accessIds = null;
        else {
          if (input.advertiserAccess.length === 0)
            throw fail(issue('advertiserAccess', 'INV-005', INV_MSG.SELECT_ADVERTISER));
          const own = await tx.advertiser.findMany({
            where: { partnerId: adv.partnerId, id: { in: input.advertiserAccess } },
            select: { id: true },
          });
          if (own.length !== new Set(input.advertiserAccess).size) throw notFound();
          accessIds = own.map((a) => a.id);
        }
      }
      if (input.status) {
        const from = await currentStatus(tx, adv.partnerId, d, ctx.simNow);
        if (from !== input.status) {
          const w = await applyAction(
            tx,
            ctx,
            user,
            adv.partnerId,
            adv.id,
            d,
            ACTION_BY_TARGET(from, input.status),
            { ...(input.note ? { note: input.note } : {}) },
          );
          warnings.push(...w);
        }
      }
      if (input.frequencyCap !== undefined || accessIds !== undefined) {
        await withChangeLog(
          changeCtx(ctx, tx, { ...(input.note ? { note: input.note } : {}) }),
          { type: 'DEAL', id: d.id, chain: { advertiserId: adv.id } },
          async (t) => {
            if (accessIds !== undefined) {
              await t.dealAccess.deleteMany({ where: { dealId: d.id } });
              if (accessIds === null) {
                await t.dealAccess.create({
                  data: {
                    sandboxId: ctx.sandboxId,
                    dealId: d.id,
                    partnerId: adv.partnerId,
                    advertiserId: null,
                  },
                });
              } else {
                await t.dealAccess.createMany({
                  data: accessIds.map((advertiserId) => ({
                    sandboxId: ctx.sandboxId,
                    dealId: d.id,
                    advertiserId,
                  })),
                });
              }
            }
            return t.inventorySourceDeal.update({
              where: { id: d.id },
              data: {
                ...(input.frequencyCap !== undefined
                  ? {
                      frequencyCap:
                        input.frequencyCap === null
                          ? Prisma.JsonNull
                          : (input.frequencyCap as object),
                    }
                  : {}),
                ...(accessIds !== undefined ? { allAdvertisers: accessIds === null } : {}),
                version: { increment: 1 },
              },
              select: { id: true },
            });
          },
        );
      }
      const fresh = await tx.inventorySourceDeal.findUnique({
        where: { id: d.id },
        select: { version: true },
      });
      return { data: { version: fresh?.version ?? d.version }, warnings };
    }),
  );
}

export async function bulkDealStatus(
  user: SessionUser,
  aid: string,
  req: { ids: string[]; action: DealAction },
): Promise<Result<BulkResponse>> {
  return asResult(() =>
    writeCtx(user, async (tx, ctx) => {
      const adv = await loadAdvertiser(tx, ctx, aid);
      const ids = [...new Set(req.ids)];
      if (ids.length === 0) throw fail(issue('ids', 'INV-040', MSG.SELECTION_REQUIRED));
      const deals = await tx.inventorySourceDeal.findMany({
        where: { id: { in: ids }, partnerId: adv.partnerId },
        include: { order: true },
      });
      if (deals.length !== ids.length) throw notFound();
      const actor = ctx.user.actor ?? ctx.user;
      const job = await tx.bulkJob.create({
        data: {
          sandboxId: ctx.sandboxId,
          advertiserId: adv.id,
          partnerId: adv.partnerId,
          requestedById: actor.id,
          source: 'BULK_EDIT',
          action: req.action,
          description: `Status edited on ${deals.length} ${deals.length === 1 ? 'deal' : 'deals'}`,
          status: 'COMPLETED',
          selectionCount: deals.length,
        },
        select: { id: true },
      });
      const errors: BulkResponse['errors'] = [];
      let done = 0;
      for (const d of deals) {
        try {
          await applyAction(tx, ctx, user, adv.partnerId, adv.id, d, req.action, {
            bulkJobId: job.id,
          });
          await tx.bulkJobItem.create({
            data: {
              sandboxId: ctx.sandboxId,
              jobId: job.id,
              entityType: 'DEAL',
              entityId: d.id,
              status: 'OK',
            },
          });
          done += 1;
        } catch (e) {
          if (!(e instanceof ServiceFailure)) throw e;
          const first = e.issues[0];
          errors.push({ id: d.id, message: first?.message ?? 'Not allowed.' });
          await tx.bulkJobItem.create({
            data: {
              sandboxId: ctx.sandboxId,
              jobId: job.id,
              entityType: 'DEAL',
              entityId: d.id,
              status: 'FAILED',
              message: first?.message ?? null,
              ruleId: first?.code ?? null,
            },
          });
        }
      }
      return { data: { jobId: job.id, done, failed: errors.length, errors } };
    }),
  );
}

// ---------------------------------------------------------------------------------------------
// Packages and deal groups
// ---------------------------------------------------------------------------------------------

export async function listPackages(
  user: SessionUser,
  aid: string,
  campaignId?: string,
): Promise<PackageRow[]> {
  return readCtx(user, async (tx, ctx) => {
    const adv = await loadAdvertiser(tx, ctx, aid);
    const [exchanges, convert, campaignLis] = await Promise.all([
      exchangeInfo(tx, adv.partnerId),
      loadConverter(tx, ctx.simNow),
      campaignLineItemIds(tx, campaignId),
    ]);
    const pkgs = await tx.inventoryPackage.findMany({
      where: { partnerId: adv.partnerId, status: { not: 'ARCHIVED' } },
      orderBy: [{ startAt: 'desc' }, { publicId: 'asc' }],
    });
    const uses = await tx.lineItemInventory.findMany({
      where: { kind: 'PACKAGE', refId: { in: pkgs.map((p) => p.id) }, mode: 'INCLUDE' },
      select: { refId: true, lineItemId: true },
    });
    return pkgs.map((p) => {
      const lis = uses.filter((u) => u.refId === p.id).map((u) => u.lineItemId);
      return {
        id: p.id,
        publicId: p.publicId.toString(),
        packageUuid: p.packageUuid,
        name: p.name,
        format: p.format,
        exchangeName: exchanges.names.get(p.exchangeId) ?? '',
        dealType: p.dealType,
        rate: round2(convert(Number(p.rate), p.currencyCode, adv.currencyCode)),
        rateOriginal:
          p.rateCurrencyOriginal &&
          p.rateOriginal !== null &&
          p.rateCurrencyOriginal !== adv.currencyCode
            ? { currency: p.rateCurrencyOriginal, amount: Number(p.rateOriginal) }
            : null,
        currencyCode: adv.currencyCode,
        bidRatioPct: p.bidRatioPct === null ? null : Number(p.bidRatioPct),
        startAt: p.startAt.toISOString(),
        assignedLineItems: lis.length,
        notUsedInCampaign: campaignLis ? !lis.some((l) => campaignLis.has(l)) : false,
      };
    });
  });
}

/** Remove a package: archive it and drop its line item assignments. */
export async function removePackage(
  user: SessionUser,
  aid: string,
  packageId: string,
): Promise<Result<void>> {
  return asResult(() =>
    writeCtx(user, async (tx, ctx) => {
      const adv = await loadAdvertiser(tx, ctx, aid);
      const p = await tx.inventoryPackage.findFirst({
        where: { id: packageId, partnerId: adv.partnerId },
      });
      if (!p) throw notFound();
      await tx.lineItemInventory.deleteMany({ where: { kind: 'PACKAGE', refId: p.id } });
      await tx.dealGroupMember.deleteMany({ where: { memberKind: 'PACKAGE', memberId: p.id } });
      await tx.inventoryPackage.update({
        where: { id: p.id },
        data: { status: 'ARCHIVED', version: { increment: 1 } },
      });
      return { data: undefined };
    }),
  );
}

async function groupRows(tx: Tx, advertiserId: string): Promise<DealGroupRow[]> {
  const groups = await tx.dealGroup.findMany({
    where: { advertiserId },
    include: { members: true },
    orderBy: { publicId: 'asc' },
  });
  const dealIds = groups.flatMap((g) =>
    g.members.filter((m) => m.memberKind === 'DEAL').map((m) => m.memberId),
  );
  const pkgIds = groups.flatMap((g) =>
    g.members.filter((m) => m.memberKind === 'PACKAGE').map((m) => m.memberId),
  );
  const [deals, pkgs] = await Promise.all([
    tx.inventorySourceDeal.findMany({
      where: { id: { in: dealIds } },
      select: { id: true, name: true },
    }),
    tx.inventoryPackage.findMany({
      where: { id: { in: pkgIds } },
      select: { id: true, name: true },
    }),
  ]);
  const name = new Map([...deals, ...pkgs].map((r) => [r.id, r.name]));
  return groups.map((g) => ({
    id: g.id,
    publicId: g.publicId.toString(),
    name: g.name,
    kind: g.kind,
    members: g.members.map((m) => ({
      kind: m.memberKind,
      id: m.memberId,
      name: name.get(m.memberId) ?? m.memberId,
    })),
  }));
}

export async function listDealGroups(user: SessionUser, aid: string): Promise<DealGroupRow[]> {
  return readCtx(user, async (tx, ctx) => {
    const adv = await loadAdvertiser(tx, ctx, aid);
    return groupRows(tx, adv.id);
  });
}

export interface DealGroupInput {
  name: string;
  type: 'DEAL_GROUP' | 'PREFERRED_DEAL_GROUP' | null;
  members: { kind: 'DEAL' | 'PACKAGE'; id: string }[];
}

async function checkMembers(
  tx: Tx,
  partnerId: string,
  members: DealGroupInput['members'],
): Promise<void> {
  const dealIds = members.filter((m) => m.kind === 'DEAL').map((m) => m.id);
  const pkgIds = members.filter((m) => m.kind === 'PACKAGE').map((m) => m.id);
  const [d, p] = await Promise.all([
    tx.inventorySourceDeal.count({ where: { id: { in: dealIds }, partnerId } }),
    tx.inventoryPackage.count({ where: { id: { in: pkgIds }, partnerId } }),
  ]);
  if (d !== new Set(dealIds).size || p !== new Set(pkgIds).size) throw notFound();
}

function groupFailure(input: DealGroupInput): { errors: WireIssue[]; warnings: WireIssue[] } {
  const all = dealGroupIssues({
    name: input.name,
    type: input.type,
    memberCount: input.members.length,
  });
  const wire = (i: (typeof all)[number]) => issue(i.path, i.ruleId, i.message, i.severity);
  return {
    errors: all.filter((i) => i.blocking).map(wire),
    warnings: all.filter((i) => !i.blocking).map(wire),
  };
}

export async function createDealGroup(
  user: SessionUser,
  aid: string,
  input: DealGroupInput,
): Promise<Result<{ id: string }>> {
  return asResult(() =>
    writeCtx(user, async (tx, ctx) => {
      const adv = await loadAdvertiser(tx, ctx, aid);
      const { errors, warnings } = groupFailure(input);
      if (errors.length) throw fail(...errors);
      await checkMembers(tx, adv.partnerId, input.members);
      const g = await tx.dealGroup.create({
        data: {
          sandboxId: ctx.sandboxId,
          advertiserId: adv.id,
          name: input.name.trim(),
          kind: input.type as 'DEAL_GROUP' | 'PREFERRED_DEAL_GROUP',
          members: {
            create: [...new Map(input.members.map((m) => [`${m.kind}:${m.id}`, m])).values()].map(
              (m) => ({
                sandboxId: ctx.sandboxId,
                memberKind: m.kind,
                memberId: m.id,
              }),
            ),
          },
        },
        select: { id: true },
      });
      return { data: { id: g.id }, warnings };
    }),
  );
}

export async function updateDealGroup(
  user: SessionUser,
  aid: string,
  groupId: string,
  input: DealGroupInput,
): Promise<Result<void>> {
  return asResult(() =>
    writeCtx(user, async (tx, ctx) => {
      const adv = await loadAdvertiser(tx, ctx, aid);
      const g = await tx.dealGroup.findFirst({ where: { id: groupId, advertiserId: adv.id } });
      if (!g) throw notFound();
      const { errors, warnings } = groupFailure(input);
      if (errors.length) throw fail(...errors);
      await checkMembers(tx, adv.partnerId, input.members);
      await tx.dealGroupMember.deleteMany({ where: { groupId: g.id } });
      await tx.dealGroup.update({
        where: { id: g.id },
        data: {
          name: input.name.trim(),
          kind: input.type as 'DEAL_GROUP' | 'PREFERRED_DEAL_GROUP',
        },
      });
      // members are written apart: a nested create inside an update does not accept the composite `sandboxId`
      await tx.dealGroupMember.createMany({
        data: [...new Map(input.members.map((m) => [`${m.kind}:${m.id}`, m])).values()].map(
          (m) => ({
            sandboxId: ctx.sandboxId,
            groupId: g.id,
            memberKind: m.kind,
            memberId: m.id,
          }),
        ),
      });
      return { data: undefined, warnings };
    }),
  );
}

/** Hard delete (data-model 7.3). Line item assignments that referenced the group stay and are reported. */
export async function deleteDealGroup(
  user: SessionUser,
  aid: string,
  groupId: string,
): Promise<Result<void>> {
  return asResult(() =>
    writeCtx(user, async (tx, ctx) => {
      const adv = await loadAdvertiser(tx, ctx, aid);
      const g = await tx.dealGroup.findFirst({ where: { id: groupId, advertiserId: adv.id } });
      if (!g) throw notFound();
      const used = await tx.lineItemInventory.count({ where: { kind: 'GROUP', refId: g.id } });
      await tx.dealGroup.delete({ where: { id: g.id } });
      return {
        data: undefined,
        warnings: used
          ? [
              issue(
                'group',
                'INV-016',
                `${used} line ${used === 1 ? 'item references' : 'items reference'} this group.`,
                'warning',
              ),
            ]
          : [],
      };
    }),
  );
}

export type { OrdersDeals };
