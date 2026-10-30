import 'server-only';
// Chart data (module 11 K17): series from `SimDailyMetric` day rows, summed per x. Money is in advertiser major units.
import type { SessionUser } from '@/lib/auth/types';
import { withSandbox, type Tx } from '@/lib/db';
import {
  assertRead,
  asResult,
  serviceCtx,
  ServiceFailure,
  type Result,
} from '@/lib/campaigns/service-kit';
import { parseIdRef, whereId } from '@/lib/routes/params';
import {
  METRIC_LABEL,
  type ChartCardSpec,
  type ChartDimension,
  type ChartScope,
  type MetricKey,
} from './spec';

export interface ChartSeries {
  key: string;
  label: string;
  points: { x: string | number; y: number; size?: number }[];
}
export interface ChartData {
  series: ChartSeries[];
  unit: string;
  asOf: string;
}

interface Acc {
  impressions: number;
  clicks: number;
  revenue: number;
  cost: number;
  conversions: number;
  viewable: number;
  measurable: number;
  views: number;
  engagements: number;
}
const zero = (): Acc => ({
  impressions: 0,
  clicks: 0,
  revenue: 0,
  cost: 0,
  conversions: 0,
  viewable: 0,
  measurable: 0,
  views: 0,
  engagements: 0,
});
const div = (a: number, b: number) => (b > 0 ? a / b : 0);

export function metricOf(a: Acc, m: MetricKey): number {
  switch (m) {
    case 'IMPRESSIONS':
      return a.impressions;
    case 'CLICKS':
      return a.clicks;
    case 'REVENUE':
      return a.revenue;
    case 'COST':
      return a.cost;
    case 'CONVERSIONS':
      return a.conversions;
    case 'VIDEO_VIEWS':
      return a.views;
    case 'ENGAGEMENTS':
      return a.engagements;
    case 'CTR':
      return div(a.clicks, a.impressions) * 100;
    case 'CPM':
      return div(a.revenue, a.impressions) * 1000;
    case 'CPC':
      return div(a.revenue, a.clicks);
    case 'CPA':
      return div(a.revenue, a.conversions);
    case 'CPV':
      return div(a.revenue, a.views);
    case 'VIEWABILITY':
      return div(a.viewable, a.measurable) * 100;
    case 'VTR':
      return div(a.views, a.impressions) * 100;
  }
}

const round = (n: number) => Math.round(n * 100) / 100;
const PERCENT: MetricKey[] = ['CTR', 'VIEWABILITY', 'VTR'];

async function lineItemIds(tx: Tx, scope: ChartScope, scopeId: string, advertiserId?: string) {
  const ref = parseIdRef(scopeId);
  if (!ref) throw new ServiceFailure('NOT_FOUND');
  if (scope === 'LI') {
    const li = await tx.lineItem.findFirst({ where: whereId(ref), select: { id: true } });
    return li ? [li.id] : [];
  }
  if (scope === 'IO') {
    const io = await tx.insertionOrder.findFirst({ where: whereId(ref), select: { id: true } });
    return io
      ? (await tx.lineItem.findMany({ where: { ioId: io.id }, select: { id: true } })).map(
          (l) => l.id,
        )
      : [];
  }
  if (scope === 'CAMPAIGN') {
    const c = await tx.campaign.findFirst({ where: whereId(ref), select: { id: true } });
    return c
      ? (await tx.lineItem.findMany({ where: { campaignId: c.id }, select: { id: true } })).map(
          (l) => l.id,
        )
      : [];
  }
  const adv = await tx.advertiser.findFirst({
    where: advertiserId ? { id: advertiserId } : whereId(ref),
    select: { id: true },
  });
  return adv
    ? (await tx.lineItem.findMany({ where: { advertiserId: adv.id }, select: { id: true } })).map(
        (l) => l.id,
      )
    : [];
}

export async function chartData(
  user: SessionUser,
  req: { scope: ChartScope; scopeId: string; spec: ChartCardSpec; from?: string; to?: string },
): Promise<Result<ChartData>> {
  return asResult(async () => {
    const ctx = await serviceCtx(user);
    assertRead(ctx);
    const { spec } = req;
    if (!spec.metrics)
      throw new ServiceFailure('INVALID', [
        { path: 'spec', severity: 'error', code: 'CHART', message: 'Choose a metric.' },
      ]);
    const dimension: ChartDimension = spec.dimension ?? 'DATE';
    const out = await withSandbox(ctx.sandboxId, async (tx) => {
      const ids = await lineItemIds(tx, req.scope, req.scopeId);
      const dateWhere = {
        ...(req.from ? { gte: new Date(`${req.from}T00:00:00Z`) } : {}),
        ...(req.to ? { lte: new Date(`${req.to}T00:00:00Z`) } : {}),
      };
      const slice =
        dimension === 'EXCHANGE' ? 'exchange' : dimension === 'DEVICE' ? 'device' : 'total';
      const rows = await tx.simDailyMetric.findMany({
        where: {
          lineItemId: { in: ids },
          sliceKind: slice,
          ...(Object.keys(dateWhere).length ? { simDate: dateWhere } : {}),
        },
        select: {
          lineItemId: true,
          simDate: true,
          sliceKey: true,
          impressions: true,
          clicks: true,
          revenue: true,
          totalMediaCost: true,
          convTotal: true,
          viewableImpressions: true,
          measurableImpressions: true,
          videoViews: true,
          engagements: true,
          exchangeId: true,
          deviceType: true,
        },
      });
      const lis = await tx.lineItem.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          name: true,
          ioId: true,
          campaignId: true,
          io: { select: { name: true } },
          campaign: { select: { name: true } },
        },
      });
      const exchanges =
        dimension === 'EXCHANGE'
          ? await tx.exchange.findMany({ select: { id: true, name: true } })
          : [];
      return { rows, lis, exchanges };
    });
    const liById = new Map(out.lis.map((l) => [l.id, l]));
    const exName = new Map(out.exchanges.map((e) => [e.id, e.name]));
    const groups = new Map<string, { label: string; acc: Acc }>();
    const add = (key: string, label: string, r: (typeof out.rows)[number]) => {
      const g = groups.get(key) ?? { label, acc: zero() };
      g.acc.impressions += Number(r.impressions);
      g.acc.clicks += Number(r.clicks);
      g.acc.revenue += Number(r.revenue);
      g.acc.cost += Number(r.totalMediaCost);
      g.acc.conversions += Number(r.convTotal);
      g.acc.viewable += Number(r.viewableImpressions);
      g.acc.measurable += Number(r.measurableImpressions);
      g.acc.views += Number(r.videoViews);
      g.acc.engagements += Number(r.engagements);
      groups.set(key, g);
    };
    for (const r of out.rows) {
      const li = liById.get(r.lineItemId);
      switch (dimension) {
        case 'DATE':
          add(r.simDate.toISOString().slice(0, 10), r.simDate.toISOString().slice(0, 10), r);
          break;
        case 'LINE_ITEM':
          add(r.lineItemId, li?.name ?? r.lineItemId, r);
          break;
        case 'INSERTION_ORDER':
          add(li?.ioId ?? '', li?.io.name ?? '', r);
          break;
        case 'CAMPAIGN':
          add(li?.campaignId ?? '', li?.campaign.name ?? '', r);
          break;
        case 'EXCHANGE':
          add(r.exchangeId ?? r.sliceKey, exName.get(r.exchangeId ?? '') ?? r.sliceKey, r);
          break;
        case 'DEVICE':
          add(r.deviceType ?? r.sliceKey, r.deviceType ?? r.sliceKey, r);
          break;
      }
    }
    let entries = [...groups.entries()];
    if (dimension === 'DATE') entries.sort((a, b) => a[0].localeCompare(b[0]));
    if (spec.topN) {
      entries.sort((a, b) => metricOf(b[1].acc, spec.topN!.by) - metricOf(a[1].acc, spec.topN!.by));
      entries = entries.slice(0, spec.topN.n);
    }
    const m = spec.metrics;
    const val = (acc: Acc, k: MetricKey) => round(metricOf(acc, k));
    let series: ChartSeries[];
    if (spec.kind === 'BUBBLE') {
      series = [
        {
          key: 'bubble',
          label: METRIC_LABEL[m.y],
          points: entries.map(
            ([, g]) =>
              ({
                x: val(g.acc, m.x ?? 'IMPRESSIONS'),
                y: val(g.acc, m.y),
                size: val(g.acc, m.size ?? 'REVENUE'),
                label: g.label,
              }) as ChartSeries['points'][number],
          ),
        },
      ];
    } else {
      const keys = [m.y, ...(m.extra ?? [])];
      series = keys.map((k) => ({
        key: k,
        label: METRIC_LABEL[k],
        points: entries.map(([, g]) => ({ x: g.label, y: val(g.acc, k) })),
      }));
    }
    const unit = PERCENT.includes(m.y)
      ? '%'
      : ['REVENUE', 'COST', 'CPM', 'CPC', 'CPA', 'CPV'].includes(m.y)
        ? 'currency'
        : 'count';
    return { data: { series, unit, asOf: new Date().toISOString() } };
  });
}
