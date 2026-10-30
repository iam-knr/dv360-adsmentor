// Database helpers shared by the experiment services, the engine lifecycle and the seed (module 17 3 and 5).
// No `server-only` import: the seed runs under tsx. All reads take a transaction the caller opened.
import type { ExperimentChannelScope, ExperimentTarget, LineItemType, Prisma, PrismaClient } from '@prisma/client';
import { scopeOf, type AbEntityInfo } from './rules';

export type Db = PrismaClient | Prisma.TransactionClient;

export const YT_LI_TYPES: LineItemType[] = ['YT_VIDEO', 'YT_AUDIO', 'YT_ON_CTV'];

export function scopeOfLiType(t: LineItemType): ExperimentChannelScope {
  if (YT_LI_TYPES.includes(t)) return 'YOUTUBE';
  if (t === 'DEMAND_GEN') return 'DEMAND_GEN';
  return 'CROSS_EXCHANGE';
}

const num = (v: unknown): number => (v === null || v === undefined ? 0 : Number(v));

export interface EntityRow extends AbEntityInfo {
  id: string;
  publicId: string;
  parent?: string | undefined;
  parentId?: string | undefined;
}

/** IOs or line items of an advertiser as picker rows with the facts the rules need. Archived entities are left out. */
export async function loadEntityRows(
  db: Db,
  advertiserId: string,
  target: ExperimentTarget,
  ids?: string[],
): Promise<EntityRow[]> {
  const ios = await db.insertionOrder.findMany({
    where: { advertiserId, ...(target === 'INSERTION_ORDER' && ids ? { id: { in: ids } } : {}) },
    orderBy: { publicId: 'asc' },
    select: {
      id: true,
      publicId: true,
      name: true,
      status: true,
      segments: { select: { amount: true } },
      lineItems: {
        where: { status: { not: 'ARCHIVED' } },
        select: { id: true, type: true, status: true, budgetMode: true, budgetAmount: true },
      },
    },
  });
  if (target === 'INSERTION_ORDER') {
    return ios
      .filter((io) => io.status !== 'ARCHIVED' || ids?.includes(io.id))
      .map((io) => {
        const scopes = io.lineItems.map((l) => scopeOfLiType(l.type));
        const ioBudget = io.segments.reduce((s, x) => s + num(x.amount), 0);
        const liBudget = io.lineItems.reduce((s, l) => s + (l.budgetMode === 'FIXED' ? num(l.budgetAmount) : 0), 0);
        return {
          id: io.id,
          publicId: io.publicId.toString(),
          kind: 'IO' as const,
          name: io.name,
          scope: scopeOf(scopes),
          budgetWarning: ioBudget > 0 && liBudget > ioBudget,
          inactive: io.status === 'DRAFT' || io.status === 'ARCHIVED',
          liftable: io.lineItems.some((l) => scopeOfLiType(l.type) !== 'CROSS_EXCHANGE'),
        };
      });
  }
  const ioName = new Map(ios.map((i) => [i.id, i.name]));
  const lis = await db.lineItem.findMany({
    where: {
      advertiserId,
      ...(ids ? { id: { in: ids } } : { status: { not: 'ARCHIVED' } }),
    },
    orderBy: { publicId: 'asc' },
    select: { id: true, publicId: true, name: true, type: true, status: true, ioId: true },
  });
  return lis.map((l) => ({
    id: l.id,
    publicId: l.publicId.toString(),
    kind: 'LI' as const,
    name: l.name,
    parent: ioName.get(l.ioId),
    parentId: l.ioId,
    scope: scopeOfLiType(l.type),
    budgetWarning: false,
    inactive: l.status === 'DRAFT' || l.status === 'ARCHIVED',
    liftable: false,
  }));
}

/** IO ids to the ids of their line items (all statuses but archived); line item ids are returned as they are. */
export async function lineItemIdsOf(
  db: Db,
  target: ExperimentTarget,
  entityIds: string[],
): Promise<string[]> {
  if (entityIds.length === 0) return [];
  if (target === 'LINE_ITEM') return entityIds;
  const rows = await db.lineItem.findMany({
    where: { ioId: { in: entityIds }, status: { not: 'ARCHIVED' } },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

export interface RawSums {
  impressions: number;
  clicks: number;
  conversions: number;
  engagements: number;
  videoStarts: number;
  videoCompletions: number;
  videoViews: number;
  audibleVisibleComplete: number;
  customImpressionValue: number;
  viewableImpressions: number;
  measurableImpressions: number;
  mediaCost: number;
  revenue: number;
}

export const emptySums = (): RawSums => ({
  impressions: 0,
  clicks: 0,
  conversions: 0,
  engagements: 0,
  videoStarts: 0,
  videoCompletions: 0,
  videoViews: 0,
  audibleVisibleComplete: 0,
  customImpressionValue: 0,
  viewableImpressions: 0,
  measurableImpressions: 0,
  mediaCost: 0,
  revenue: 0,
});

const SUM_SELECT = {
  impressions: true,
  clicks: true,
  convTotal: true,
  engagements: true,
  videoStarts: true,
  videoCompletions: true,
  videoViews: true,
  audibleVisibleComplete: true,
  customImpressionValue: true,
  viewableImpressions: true,
  measurableImpressions: true,
  mediaCost: true,
  revenue: true,
} as const;

type SumRow = { [K in keyof typeof SUM_SELECT]?: unknown };

function toSums(s: SumRow): RawSums {
  return {
    impressions: num(s.impressions),
    clicks: num(s.clicks),
    conversions: num(s.convTotal),
    engagements: num(s.engagements),
    videoStarts: num(s.videoStarts),
    videoCompletions: num(s.videoCompletions),
    videoViews: num(s.videoViews),
    audibleVisibleComplete: num(s.audibleVisibleComplete),
    customImpressionValue: num(s.customImpressionValue),
    viewableImpressions: num(s.viewableImpressions),
    measurableImpressions: num(s.measurableImpressions),
    mediaCost: num(s.mediaCost),
    revenue: num(s.revenue),
  };
}

const dbDay = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);

/** Total-slice counters of some line items over a closed sim date range. */
export async function sumMetrics(db: Db, lineItemIds: string[], from: string, to: string): Promise<RawSums> {
  if (lineItemIds.length === 0 || to < from) return emptySums();
  const a = await db.simDailyMetric.aggregate({
    where: { lineItemId: { in: lineItemIds }, sliceKind: 'total', simDate: { gte: dbDay(from), lte: dbDay(to) } },
    _sum: SUM_SELECT,
  });
  return toSums(a._sum);
}

/** The same per sim day (the report's time series). */
export async function dailyMetrics(
  db: Db,
  lineItemIds: string[],
  from: string,
  to: string,
): Promise<Map<string, RawSums>> {
  const out = new Map<string, RawSums>();
  if (lineItemIds.length === 0 || to < from) return out;
  const rows = await db.simDailyMetric.groupBy({
    by: ['simDate'],
    where: { lineItemId: { in: lineItemIds }, sliceKind: 'total', simDate: { gte: dbDay(from), lte: dbDay(to) } },
    _sum: SUM_SELECT,
    orderBy: { simDate: 'asc' },
  });
  for (const r of rows) out.set(r.simDate.toISOString().slice(0, 10), toSums(r._sum));
  return out;
}

/** Lifetime reached users of line items as of a date (latest snapshot per line item, summed). */
export async function reachedUsers(db: Db, lineItemIds: string[], to: string): Promise<number> {
  if (lineItemIds.length === 0) return 0;
  const rows = await db.simReachSnapshot.findMany({
    where: { scopeType: 'LINE_ITEM', scopeId: { in: lineItemIds }, windowDays: 0, simDate: { lte: dbDay(to) } },
    orderBy: { simDate: 'desc' },
    distinct: ['scopeId'],
    select: { impressionReach: true },
  });
  return rows.reduce((s, r) => s + num(r.impressionReach), 0);
}

/** Reach with a fallback for line items without a snapshot: impressions at a frequency of 2.4. */
export const estimateReach = (reached: number, impressions: number): number =>
  reached > 0 ? reached : Math.round(impressions / 2.4);
