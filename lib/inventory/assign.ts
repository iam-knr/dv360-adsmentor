import 'server-only';
// Assignment of deals, packages and deal groups to line items (module 13 4.1 `assignInventoryToLineItems`,
// `assignMarketplaceItem`). One core, `assignToLineItems`, serves the line item form rows, the Marketplace Assign
// button and Bulk assign. Format checks use the MX-09 extension (INV-017); a second assignment is a warning (INV-041).
import type { InventoryFormat, LineItemType } from '@prisma/client';
import type { SessionUser } from '@/lib/auth/types';
import { withChangeLog } from '@/lib/changelog';
import type { Tx } from '@/lib/db';
import {
  asResult,
  changeCtx,
  notFound,
  ServiceFailure,
  type Result,
  type ServiceCtx,
} from '@/lib/campaigns/service-kit';
import type { WireIssue } from '@/lib/campaigns/wire';
import { MSG } from '@/lib/validation/messages';
import { formatFitsLineItem, LINE_ITEM_TYPE_LABEL } from './format-compat';
import { loadAdvertiser, writeCtx, type AdvertiserRow } from './guard';
import { INV_MSG, packageCantAssign } from './messages';
import type { AssignInventoryItem, BulkResponse, LineItemChoice } from './types';

const wire = (path: string, code: string, message: string, severity: WireIssue['severity'] = 'error'): WireIssue => ({
  path,
  severity,
  code,
  message,
});

export interface AssignOutcome {
  assigned: number;
  alreadyAssigned: number;
  /** Per line item failure, e.g. INV-017. */
  errors: { id: string; message: string; ruleId: string }[];
  warnings: WireIssue[];
}

interface Target {
  id: string;
  name: string;
  type: LineItemType;
  fixedBidCpm: number | null;
}

async function loadTargets(tx: Tx, adv: AdvertiserRow, ids: string[]): Promise<Target[]> {
  const unique = [...new Set(ids)];
  const rows = await tx.lineItem.findMany({
    where: { id: { in: unique }, advertiser: { partnerId: adv.partnerId } },
    select: { id: true, name: true, type: true, fixedBidCpm: true },
  });
  if (rows.length !== unique.length) throw notFound();
  return rows.map((r) => ({ id: r.id, name: r.name, type: r.type, fixedBidCpm: r.fixedBidCpm === null ? null : Number(r.fixedBidCpm) }));
}

interface ItemInfo {
  kind: AssignInventoryItem['kind'];
  id: string;
  name: string;
  format: InventoryFormat | null;
  /** Deals only: rate for INV-019, and whether the deal is guaranteed. */
  rate: number | null;
  guaranteed: boolean;
}

async function loadItems(tx: Tx, adv: AdvertiserRow, items: AssignInventoryItem[]): Promise<ItemInfo[]> {
  const byKind = (k: AssignInventoryItem['kind']) => [...new Set(items.filter((i) => i.kind === k).map((i) => i.id))];
  const [deals, packages, groups] = await Promise.all([
    tx.inventorySourceDeal.findMany({
      where: { id: { in: byKind('DEAL') }, partnerId: adv.partnerId },
      select: { id: true, name: true, format: true, rate: true, commitment: true },
    }),
    tx.inventoryPackage.findMany({
      where: { id: { in: byKind('PACKAGE') }, partnerId: adv.partnerId },
      select: { id: true, name: true, format: true },
    }),
    tx.dealGroup.findMany({ where: { id: { in: byKind('GROUP') }, advertiserId: adv.id }, select: { id: true, name: true } }),
  ]);
  if (deals.length !== byKind('DEAL').length || packages.length !== byKind('PACKAGE').length || groups.length !== byKind('GROUP').length)
    throw notFound();
  const out: ItemInfo[] = [];
  for (const i of items) {
    const d = deals.find((x) => x.id === i.id && i.kind === 'DEAL');
    const p = packages.find((x) => x.id === i.id && i.kind === 'PACKAGE');
    const g = groups.find((x) => x.id === i.id && i.kind === 'GROUP');
    if (d) out.push({ kind: 'DEAL', id: d.id, name: d.name, format: d.format, rate: Number(d.rate), guaranteed: d.commitment === 'GUARANTEED' });
    else if (p) out.push({ kind: 'PACKAGE', id: p.id, name: p.name, format: p.format, rate: null, guaranteed: false });
    else if (g) out.push({ kind: 'GROUP', id: g.id, name: g.name, format: null, rate: null, guaranteed: false });
  }
  return out;
}

/**
 * Create the `LineItemInventory` rows for every (item, line item) pair. A pair whose format does not fit the line item
 * type is reported (INV-017) and nothing is created for it; an existing row is counted, not duplicated (INV-041).
 */
export async function assignToLineItems(
  tx: Tx,
  ctx: ServiceCtx,
  adv: AdvertiserRow,
  req: { lineItemIds: string[]; items: AssignInventoryItem[]; replace?: boolean },
  extra: { bulkJobId?: string; note?: string } = {},
): Promise<AssignOutcome> {
  const targets = await loadTargets(tx, adv, req.lineItemIds);
  const items = await loadItems(tx, adv, req.items);
  const mode = new Map(req.items.map((i) => [`${i.kind}:${i.id}`, i.mode]));
  const out: AssignOutcome = { assigned: 0, alreadyAssigned: 0, errors: [], warnings: [] };

  if (req.replace) {
    await tx.lineItemInventory.deleteMany({ where: { lineItemId: { in: targets.map((t) => t.id) } } });
  }
  for (const item of items) {
    const rowMode = mode.get(`${item.kind}:${item.id}`) ?? 'INCLUDE';
    for (const li of targets) {
      if (item.format && !formatFitsLineItem(item.format, li.type)) {
        out.errors.push({ id: li.id, ruleId: 'INV-017', message: packageCantAssign(LINE_ITEM_TYPE_LABEL[li.type]) });
        continue;
      }
      const existing = await tx.lineItemInventory.findUnique({
        where: { lineItemId_kind_refId: { lineItemId: li.id, kind: item.kind, refId: item.id } },
        select: { id: true },
      });
      if (existing) {
        out.alreadyAssigned += 1;
        continue;
      }
      const create = () =>
        tx.lineItemInventory.create({
          data: { sandboxId: ctx.sandboxId, lineItemId: li.id, kind: item.kind, refId: item.id, mode: rowMode },
          select: { id: true },
        });
      if (item.kind === 'DEAL') {
        // the deal's History shows "Line items" added (registry list field)
        await withChangeLog(
          changeCtx(ctx, tx, { ...(extra.bulkJobId ? { bulkJobId: extra.bulkJobId, source: 'BULK_EDIT' as const } : {}), ...(extra.note ? { note: extra.note } : {}) }),
          { type: 'DEAL', id: item.id, chain: { advertiserId: adv.id } },
          async () => {
            await create();
            return { id: item.id };
          },
        );
        if (!item.guaranteed && item.rate !== null && li.fixedBidCpm !== null && li.fixedBidCpm < item.rate)
          out.warnings.push(wire(`lineItem.${li.id}`, 'INV-019', `${li.name}: ${INV_MSG.BID_BELOW_RATE}`, 'warning'));
      } else {
        await create();
      }
      out.assigned += 1;
    }
  }
  return out;
}

function assertSelection(lineItemCount: number, itemCount: number): void {
  if (lineItemCount === 0 || itemCount === 0)
    throw new ServiceFailure('INVALID', [wire('target', 'INV-040', MSG.SELECTION_REQUIRED)]);
}

/** Service used by the line item form rows and the deal Overview "Assign" link (module 13 M13-11). */
export async function assignInventoryToLineItems(
  user: SessionUser,
  aid: string,
  req: { lineItemIds: string[]; items: AssignInventoryItem[]; replace?: boolean },
): Promise<Result<{ assigned: number; alreadyAssigned: number }>> {
  return asResult(() =>
    writeCtx(user, async (tx, ctx) => {
      const adv = await loadAdvertiser(tx, ctx, aid);
      if (!req.replace) assertSelection(req.lineItemIds.length, req.items.length);
      const o = await assignToLineItems(tx, ctx, adv, req);
      const warnings = [...o.warnings];
      if (o.alreadyAssigned > 0) warnings.push(wire('target', 'INV-041', INV_MSG.ALREADY_ASSIGNED, 'warning'));
      if (o.errors.length && o.assigned === 0 && o.alreadyAssigned === 0)
        throw new ServiceFailure('INVALID', o.errors.map((e) => wire(`lineItem.${e.id}`, e.ruleId, e.message)));
      return { data: { assigned: o.assigned, alreadyAssigned: o.alreadyAssigned }, warnings };
    }),
  );
}

/** Line items an assignment dialog can offer: the partner's, with their path, optionally only those a format fits. */
export async function listAssignableLineItems(
  user: SessionUser,
  aid: string,
  format?: InventoryFormat,
): Promise<LineItemChoice[]> {
  return writeCtx(user, async (tx, ctx) => {
    const adv = await loadAdvertiser(tx, ctx, aid);
    const rows = await tx.lineItem.findMany({
      where: { advertiserId: adv.id, status: { not: 'ARCHIVED' } },
      select: {
        id: true,
        publicId: true,
        name: true,
        type: true,
        campaign: { select: { name: true } },
        io: { select: { name: true } },
      },
      orderBy: { publicId: 'asc' },
      take: 300,
    });
    return rows
      .filter((r) => !format || formatFitsLineItem(format, r.type))
      .map((r) => ({
        id: r.id,
        publicId: r.publicId.toString(),
        name: r.name,
        type: r.type,
        campaignName: r.campaign.name,
        ioName: r.io.name,
        advertiserName: adv.name,
      }));
  });
}

/** Bulk wrapper: one BulkJob for two or more line items (module 13 4.6). */
export async function bulkAssign(
  tx: Tx,
  ctx: ServiceCtx,
  adv: AdvertiserRow,
  req: { lineItemIds: string[]; items: AssignInventoryItem[] },
  description: string,
): Promise<{ response: BulkResponse; outcome: AssignOutcome }> {
  const actor = ctx.user.actor ?? ctx.user;
  const job = await tx.bulkJob.create({
    data: {
      sandboxId: ctx.sandboxId,
      advertiserId: adv.id,
      partnerId: adv.partnerId,
      requestedById: actor.id,
      source: 'BULK_EDIT',
      action: 'EDIT_SETTINGS',
      description,
      status: 'COMPLETED',
      selectionCount: req.lineItemIds.length,
    },
    select: { id: true },
  });
  const outcome = await assignToLineItems(tx, ctx, adv, req, { bulkJobId: job.id });
  const failed = new Set(outcome.errors.map((e) => e.id));
  for (const id of new Set(req.lineItemIds)) {
    const err = outcome.errors.find((e) => e.id === id);
    await tx.bulkJobItem.create({
      data: {
        sandboxId: ctx.sandboxId,
        jobId: job.id,
        entityType: 'LINE_ITEM',
        entityId: id,
        status: failed.has(id) ? 'FAILED' : 'OK',
        message: err?.message ?? null,
        ruleId: err?.ruleId ?? null,
      },
    });
  }
  const response: BulkResponse = {
    jobId: job.id,
    done: new Set(req.lineItemIds).size - failed.size,
    failed: failed.size,
    errors: outcome.errors.map((e) => ({ id: e.id, message: e.message })),
  };
  return { response, outcome };
}
