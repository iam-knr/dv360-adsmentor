import 'server-only';
// Brand controls page service (module 15 S1, 4.4): reads line item facts and locked advertiser / partner rows, then
// hands them to the pure computation. Brand controls are computed at read time and never stored.
import type { SessionUser } from '@/lib/auth/types';
import { withSandbox, type Tx } from '@/lib/db';
import { assertResourceRead, loadAdvertiser, loadPartner, serviceCtx } from './kit';
import {
  computeBrandControls,
  ivtSeries,
  type BrandInputs,
  type BrandLineItem,
  type TargetFact,
} from './brand-controls';
import type { BrandControlsView } from './wire';

const DIMENSIONS = [
  'DIGITAL_CONTENT_LABEL',
  'APPS_AND_URLS',
  'KEYWORD',
  'NEGATIVE_KEYWORD_LIST',
  'THIRD_PARTY_VERIFIER',
] as const;

async function loadFacts(
  tx: Tx,
  scope: { advertiserId: string } | { partnerId: string },
): Promise<{ inputs: BrandInputs; lineItemIds: string[] }> {
  const advWhere =
    'advertiserId' in scope
      ? { advertiserId: scope.advertiserId }
      : { advertiser: { partnerId: scope.partnerId } };
  const lis = await tx.lineItem.findMany({
    where: advWhere,
    select: {
      id: true,
      name: true,
      status: true,
      type: true,
      inventoryQuality: true,
      advertiserId: true,
    },
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
  });
  const ids = lis.map((l) => l.id);
  const advertiserIds = [...new Set(lis.map((l) => l.advertiserId))];
  const rows = ids.length
    ? await tx.targetingAssignment.findMany({
        where: { lineItemId: { in: ids }, dimension: { in: [...DIMENSIONS] } },
        select: { lineItemId: true, dimension: true, mode: true, refType: true },
      })
    : [];
  const byLi = new Map<string, TargetFact[]>();
  for (const r of rows) {
    if (!r.lineItemId) continue;
    const list = byLi.get(r.lineItemId) ?? [];
    list.push({ dimension: r.dimension, mode: r.mode, refType: r.refType });
    byLi.set(r.lineItemId, list);
  }
  const owned = await tx.targetingAssignment.findMany({
    where: {
      OR: [
        { ownerType: 'ADVERTISER', advertiserId: { in: advertiserIds } },
        { ownerType: 'PARTNER', ...('partnerId' in scope ? { partnerId: scope.partnerId } : {}) },
      ],
      dimension: { in: [...DIMENSIONS] },
    },
    select: { ownerType: true, dimension: true, mode: true, refType: true },
  });
  const fact = (r: (typeof owned)[number]): TargetFact => ({
    dimension: r.dimension,
    mode: r.mode,
    refType: r.refType,
  });
  const lineItems: BrandLineItem[] = lis.map((l) => ({
    id: l.id,
    name: l.name,
    status: l.status,
    type: l.type,
    inventoryQuality: l.inventoryQuality,
    targets: byLi.get(l.id) ?? [],
  }));
  return {
    lineItemIds: ids,
    inputs: {
      lineItems,
      advertiserRows: owned.filter((r) => r.ownerType === 'ADVERTISER').map(fact),
      partnerRows: owned.filter((r) => r.ownerType === 'PARTNER').map(fact),
    },
  };
}

async function ivt(tx: Tx, lineItemIds: string[]) {
  if (lineItemIds.length === 0) return [];
  const rows = await tx.simDailyMetric.groupBy({
    by: ['simDate'],
    where: { lineItemId: { in: lineItemIds }, sliceKind: 'total' },
    _sum: { blockedImpressions: true, impressions: true },
    orderBy: { simDate: 'asc' },
  });
  return ivtSeries(
    rows.map((r) => ({
      date: r.simDate.toISOString().slice(0, 10),
      blocked: Number(r._sum.blockedImpressions ?? 0),
      impressions: Number(r._sum.impressions ?? 0),
    })),
  );
}

export async function getBrandControls(
  user: SessionUser,
  scope: { level: 'advertiser' | 'partner'; id: string },
  tab: 'display' | 'youtube' = 'display',
  filter: 'active' | 'all' = 'active',
): Promise<BrandControlsView> {
  const ctx = await serviceCtx(user);
  assertResourceRead(ctx);
  return withSandbox(ctx.sandboxId, async (tx) => {
    const target =
      scope.level === 'advertiser'
        ? { advertiserId: (await loadAdvertiser(tx, scope.id)).id }
        : { partnerId: (await loadPartner(tx, scope.id)).id };
    const { inputs, lineItemIds } = await loadFacts(tx, target);
    const computed = computeBrandControls(inputs, tab, filter, scope.level);
    return {
      tab,
      filter,
      rows: computed.rows,
      breakdown: computed.breakdown,
      ivt: await ivt(tx, lineItemIds),
      totalLineItems: computed.total,
    };
  });
}
