import 'server-only';
// Archive cascade (module 06 4.2, module 07 B15, VAL Q19, RC-040): archiving a campaign archives its insertion orders
// and line items, archiving an IO archives its line items. One ChangeGroup per touched entity, all sharing the
// bulk job id and source BULK_EDIT (module 05 4.1.3).
import type { EntityType } from '@prisma/client';
import { withChangeLog, type ChangeCtx, type EntityRegistry } from '@/lib/changelog';
import { REGISTRIES } from '@/lib/changelog/registries';
import type { Tx } from '@/lib/db';

/**
 * Line item fields this module may change (status by the cascade, pacing and bid by IO automation, IO-053).
 * The full LINE_ITEM registry belongs to P3-06c; it is used instead whenever it is registered.
 */
export const lineItemBaseRegistry: EntityRegistry = {
  entityType: 'LINE_ITEM',
  model: 'LineItem',
  noun: 'line item',
  version: 1,
  fields: [
    { path: 'name', label: 'Name', kind: 'text', ignore: true },
    { path: 'status', label: 'Status', kind: 'enum' },
    { path: 'pacingPeriod', label: 'Pacing period', kind: 'enum' },
    { path: 'pacingType', label: 'Pacing type', kind: 'enum' },
    { path: 'bidKind', label: 'Bid strategy type', kind: 'enum' },
    { path: 'bidGoal', label: 'Bid strategy', kind: 'enum' },
  ],
};

export function lineItemRegistry(): EntityRegistry {
  return REGISTRIES.LINE_ITEM ?? lineItemBaseRegistry;
}

export interface CascadeResult {
  insertionOrders: number;
  lineItems: number;
}

async function archiveOne(
  ctx: ChangeCtx,
  type: EntityType,
  id: string,
  chain: { advertiserId: string; campaignId?: string; ioId?: string; lineItemId?: string },
  update: (tx: Tx) => Promise<unknown>,
  registry?: EntityRegistry,
): Promise<void> {
  await withChangeLog(
    ctx,
    { type, id, chain },
    async (tx) => {
      await update(tx);
      return { id };
    },
    registry ? { registry } : {},
  );
}

/** Archive the line items of one IO that are not archived yet. */
export async function archiveLineItemsOf(
  ctx: ChangeCtx & { tx: Tx },
  io: { id: string; campaignId: string; advertiserId: string },
): Promise<number> {
  const lis = await ctx.tx.lineItem.findMany({
    where: { ioId: io.id, status: { not: 'ARCHIVED' } },
    select: { id: true },
    orderBy: { publicId: 'asc' },
  });
  for (const li of lis) {
    await archiveOne(
      ctx,
      'LINE_ITEM',
      li.id,
      { advertiserId: io.advertiserId, campaignId: io.campaignId, ioId: io.id, lineItemId: li.id },
      (tx) =>
        tx.lineItem.update({
          where: { id: li.id },
          data: { status: 'ARCHIVED', version: { increment: 1 } },
        }),
      lineItemRegistry(),
    );
  }
  return lis.length;
}

/** Archive one IO (if needed) and its line items. */
export async function archiveIoCascade(
  ctx: ChangeCtx & { tx: Tx },
  io: { id: string; campaignId: string; advertiserId: string; status: string },
): Promise<CascadeResult> {
  let ios = 0;
  if (io.status !== 'ARCHIVED') {
    await archiveOne(
      ctx,
      'INSERTION_ORDER',
      io.id,
      { advertiserId: io.advertiserId, campaignId: io.campaignId, ioId: io.id },
      (tx) =>
        tx.insertionOrder.update({
          where: { id: io.id },
          data: { status: 'ARCHIVED', version: { increment: 1 } },
        }),
    );
    ios = 1;
  }
  const lineItems = await archiveLineItemsOf(ctx, io);
  return { insertionOrders: ios, lineItems };
}

/** Archive the IOs and line items of one campaign. The campaign row itself is archived by the caller. */
export async function archiveCampaignChildren(
  ctx: ChangeCtx & { tx: Tx },
  campaign: { id: string; advertiserId: string },
): Promise<CascadeResult> {
  const ios = await ctx.tx.insertionOrder.findMany({
    where: { campaignId: campaign.id },
    select: { id: true, campaignId: true, advertiserId: true, status: true },
    orderBy: { publicId: 'asc' },
  });
  const total: CascadeResult = { insertionOrders: 0, lineItems: 0 };
  for (const io of ios) {
    const r = await archiveIoCascade(ctx, io);
    total.insertionOrders += r.insertionOrders;
    total.lineItems += r.lineItems;
  }
  return total;
}
