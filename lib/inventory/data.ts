import 'server-only';
// Shared readers of the inventory services: exchange names and enablement, currency conversion, delivery per deal,
// line item use, and the mapper from a deal row to the wire `DealRow`.
import type { Prisma } from '@prisma/client';
import type { Tx } from '@/lib/db';
import { fxRate, loadFxTable, type FxTable } from '@/lib/metrics/fx';
import { FX_PER_USD } from '@/lib/seed/reference';
import { effectiveDealStatus } from './transitions';
import type { Commitment, DealRow } from './types';

export const DEAL_TYPE_LABEL: Record<string, string> = {
  PROGRAMMATIC_GUARANTEED: 'Programmatic Guaranteed',
  PREFERRED_DEAL: 'Preferred deal',
  PRIVATE_AUCTION: 'Private auction',
  INSTANT_DEAL: 'Instant deal',
};

export const COMMITMENT_LABEL: Record<Commitment, string> = {
  GUARANTEED: 'Guaranteed',
  NON_GUARANTEED: 'Non-guaranteed',
};

/** Deal rates are stored in INR, the partner currency of the simulator (README). */
export const DEAL_CURRENCY = 'INR';

export type Converter = (amount: number, from: string, to: string) => number;

export async function loadConverter(tx: Tx, asOf: Date): Promise<Converter> {
  let table: FxTable = new Map();
  try {
    table = await loadFxTable(tx, asOf);
  } catch {
    table = new Map();
  }
  return (amount, from, to) => {
    if (from === to) return amount;
    try {
      return amount * fxRate(table, from, to);
    } catch {
      const a = FX_PER_USD[from];
      const b = FX_PER_USD[to];
      return a && b ? (amount / a) * b : amount;
    }
  };
}

export const round2 = (n: number): number => Math.round(n * 100) / 100;

export async function exchangeInfo(
  tx: Tx,
  partnerId: string,
): Promise<{ names: Map<string, string>; disabled: Set<string> }> {
  const [exchanges, partnerRows] = await Promise.all([
    tx.exchange.findMany({ select: { id: true, name: true } }),
    tx.partnerExchange.findMany({
      where: { partnerId, enabled: false },
      select: { exchangeId: true },
    }),
  ]);
  return {
    names: new Map(exchanges.map((e) => [e.id, e.name])),
    disabled: new Set(partnerRows.map((r) => r.exchangeId)),
  };
}

export interface Delivery {
  impressions: number;
  spend: number;
  bids: number;
}

/** Sum of the `deal` slice rows (engine 9.3). The engine writes none yet, so seeded sandboxes read as "no delivery". */
export async function deliveryByDeal(tx: Tx, dealIds: string[]): Promise<Map<string, Delivery>> {
  const out = new Map<string, Delivery>();
  if (dealIds.length === 0) return out;
  const rows = await tx.simDailyMetric.groupBy({
    by: ['dealId'],
    where: { dealId: { in: dealIds }, sliceKind: 'deal' },
    _sum: { impressions: true, revenue: true, bidsSubmitted: true },
  });
  for (const r of rows) {
    if (!r.dealId) continue;
    out.set(r.dealId, {
      impressions: Number(r._sum.impressions ?? 0n),
      spend: Number(r._sum.revenue ?? 0),
      bids: Number(r._sum.bidsSubmitted ?? 0n),
    });
  }
  return out;
}

/** Direct assignments of deals to line items, plus assignments through a group the deal belongs to. */
export async function lineItemsByDeal(
  tx: Tx,
  dealIds: string[],
): Promise<Map<string, Set<string>>> {
  const out = new Map<string, Set<string>>(dealIds.map((d) => [d, new Set()]));
  if (dealIds.length === 0) return out;
  const direct = await tx.lineItemInventory.findMany({
    where: { kind: 'DEAL', refId: { in: dealIds }, mode: 'INCLUDE' },
    select: { refId: true, lineItemId: true },
  });
  for (const r of direct) out.get(r.refId)?.add(r.lineItemId);
  const members = await tx.dealGroupMember.findMany({
    where: { memberKind: 'DEAL', memberId: { in: dealIds } },
    select: { memberId: true, groupId: true },
  });
  if (members.length) {
    const viaGroup = await tx.lineItemInventory.findMany({
      where: {
        kind: 'GROUP',
        refId: { in: [...new Set(members.map((m) => m.groupId))] },
        mode: 'INCLUDE',
      },
      select: { refId: true, lineItemId: true },
    });
    for (const m of members)
      for (const g of viaGroup) if (g.refId === m.groupId) out.get(m.memberId)?.add(g.lineItemId);
  }
  return out;
}

export type StoredDeal = Prisma.InventorySourceDealGetPayload<{ include: { order: true } }>;

export function toDealRow(
  d: StoredDeal,
  o: {
    simNow: Date;
    currency: string;
    convert: Converter;
    exchanges: { names: Map<string, string>; disabled: Set<string> };
    delivery: Map<string, Delivery>;
    liIds: Map<string, Set<string>>;
    campaignLiIds?: Set<string>;
  },
): DealRow {
  const delivered = o.delivery.get(d.id);
  const lis = o.liIds.get(d.id) ?? new Set<string>();
  const commitment = d.commitment;
  const status = effectiveDealStatus(
    {
      status: d.status,
      endAt: d.endAt,
      exchangeEnabled: !o.exchanges.disabled.has(d.exchangeId),
      commitment,
      quantityImpressions: d.quantityImpressions,
      deliveredImpressions: delivered?.impressions ?? null,
    },
    o.simNow,
  );
  const unassignedPg =
    commitment === 'GUARANTEED' && lis.size === 0 && (status === 'ACTIVE' || status === 'DRAFT');
  const actionRequired = status === 'DRAFT' || status === 'NOT_SERVABLE' || unassignedPg;
  const actionReason =
    status === 'DRAFT'
      ? 'This deal needs your action: activate it to let line items use it.'
      : status === 'NOT_SERVABLE'
        ? "This deal's exchange is disabled for the partner."
        : unassignedPg
          ? "This deal isn't assigned to a line item."
          : null;
  return {
    kind: 'DEAL',
    id: d.id,
    publicId: d.publicId.toString(),
    dealId: d.dealId,
    name: d.name,
    orderId: d.orderId,
    status: status,
    dealType: d.dealType,
    dealTypeLabel: DEAL_TYPE_LABEL[d.dealType] ?? d.dealType,
    commitment,
    commitmentLabel: COMMITMENT_LABEL[commitment],
    deliveryMethod: d.deliveryMethod === 'TAGGED' ? 'Tagged' : 'Programmatic',
    centralPartnerDeal: d.centralPartnerDeal,
    rate: d.rate === null ? null : round2(o.convert(Number(d.rate), DEAL_CURRENCY, o.currency)),
    rateType: d.rateType,
    bidRatioPct: d.bidRatioPct === null ? null : Number(d.bidRatioPct),
    sizes: d.sizes,
    startAt: d.startAt.toISOString(),
    endAt: d.endAt.toISOString(),
    quantity: d.quantityImpressions === null ? null : Number(d.quantityImpressions),
    impressions: delivered ? delivered.impressions : null,
    spend: delivered ? round2(o.convert(delivered.spend, DEAL_CURRENCY, o.currency)) : null,
    winRate:
      delivered && delivered.bids > 0
        ? round2((delivered.impressions / delivered.bids) * 100)
        : null,
    format: d.format,
    exchangeId: d.exchangeId,
    exchangeName: o.exchanges.names.get(d.exchangeId) ?? d.sellerName,
    sellerName: d.sellerName,
    lineItemCount: lis.size,
    allowPausing: d.allowPausing,
    actionRequired,
    actionReason,
    notUsedInCampaign: o.campaignLiIds ? ![...lis].some((l) => o.campaignLiIds?.has(l)) : false,
  };
}
