// Writes one TickOutput (engine.md 9.1 write path, 3.5, 3.7). Additive upserts: counters are added to the stored row,
// so re-running a tick would double count; the caller guards that with SimTickLog (locks.ts). Money is stored once in
// the advertiser currency (RC-025): the core's integer micros divide by 1e6 into the Decimal(20,6) columns.
import type { Tx } from '@/lib/db';
import { newId } from '@/lib/db';
import { CONVERSION_KEYS, COUNT_KEYS, MONEY_KEYS, type MetricKey, type Metrics } from '../metrics';
import type { TickOutput } from '../output';
import type { AlertDecision } from '../diagnostics';
import type { AlertCode } from '../world';
import { alertTypeOf } from './map';
import type { AdvertiserWorld } from './types';

export interface PersistCtx {
  sandboxId: string;
  classroomId: string;
  adv: AdvertiserWorld;
}

export interface PersistResult {
  rows: number;
  raised: string[];
}

type Cast = 'text' | 'date' | 'timestamp' | 'bigint' | 'numeric' | 'DiagStage';
interface Col {
  name: string;
  cast: Cast;
}

const MAX_PARAMS = 30_000;
const COUNT_SET = new Set<string>(COUNT_KEYS);
const CONV_SET = new Set<string>(CONVERSION_KEYS);
const MONEY_SET = new Set<string>(MONEY_KEYS);
const METRIC_COLS: Col[] = [...COUNT_KEYS, ...CONVERSION_KEYS, ...MONEY_KEYS].map((name) => ({
  name,
  cast: COUNT_SET.has(name) ? 'bigint' : 'numeric',
}));

export function metricParam(key: MetricKey, v: number): string {
  if (COUNT_SET.has(key)) return String(Math.round(v));
  if (MONEY_SET.has(key)) return (Math.round(v) / 1e6).toFixed(6);
  if (CONV_SET.has(key)) return v.toFixed(6);
  return String(v);
}

const metricValues = (m: Metrics): string[] =>
  METRIC_COLS.map((c) => metricParam(c.name as MetricKey, m[c.name as MetricKey] ?? 0));
const isZero = (m: Metrics): boolean => METRIC_COLS.every((c) => !(m[c.name as MetricKey] ?? 0));

async function upsertAdditive(
  tx: Tx,
  table: string,
  conflict: string[],
  cols: Col[],
  rows: string[][],
  additive: string[],
): Promise<number> {
  if (rows.length === 0) return 0;
  const per = Math.max(1, Math.floor(MAX_PARAMS / cols.length));
  const colSql = cols.map((c) => `"${c.name}"`).join(', ');
  const set = additive.map((c) => `"${c}" = "${table}"."${c}" + EXCLUDED."${c}"`).join(', ');
  for (let i = 0; i < rows.length; i += per) {
    const chunk = rows.slice(i, i + per);
    const values = chunk
      .map(
        (_, r) =>
          `(${cols.map((c, k) => `$${r * cols.length + k + 1}::${c.cast === 'DiagStage' ? '"DiagStage"' : c.cast}`).join(', ')})`,
      )
      .join(', ');
    await tx.$executeRawUnsafe(
      `INSERT INTO "${table}" (${colSql}) VALUES ${values} ON CONFLICT (${conflict.map((c) => `"${c}"`).join(', ')}) DO UPDATE SET ${set}`,
      ...chunk.flat(),
    );
  }
  return rows.length;
}

const TITLES: Record<AlertCode, string> = {
  NO_SPEND_LI: "1 line item hasn't spent anything today or yesterday",
  NO_SPEND_IO: "1 insertion order hasn't spent anything today or yesterday",
  UNDERPACING_IO: '1 insertion order is underpacing',
  CONFLICT_IO:
    '1 insertion order has conflicting settings which may prevent your budget from being spent',
  CONFLICT_LI:
    '1 line item has conflicting settings which may prevent your budget from being spent',
  LIMITED_AUDIENCE_LI: '1 line item has a very limited audience',
  UNDERPERFORMING_IO: '1 insertion order is underperforming',
  RESTRICTED_AUDIENCE_LIST_LI: '1 line item uses restricted audience lists',
  CREATIVE_REJECTED: '1 creative rejected',
  CREATIVE_RESTRICTED: '1 creative restricted',
  SPEND_THRESHOLD: 'Advertiser spent more than the threshold yesterday',
};

/** An alert type switched off in Advertiser settings is never created (engine.md 3.7). */
function suppressed(adv: AdvertiserWorld, code: AlertCode): boolean {
  const v = adv.world.advertiser.alertPrefs.enabled?.[code];
  return code === 'SPEND_THRESHOLD' ? v !== true : v === false;
}

async function persistAlerts(
  tx: Tx,
  ctx: PersistCtx,
  decisions: readonly AlertDecision[],
  hourStartMs: number,
): Promise<{ rows: number; raised: string[] }> {
  let rows = 0;
  const raised: string[] = [];
  const at = new Date(hourStartMs);
  const advertiserId = ctx.adv.advertiserId;
  for (const d of decisions) {
    const scope =
      d.scopeKind === 'LINE_ITEM'
        ? {
            lineItemId: d.scopeId,
            ioId: ctx.adv.ioOfLi.get(d.scopeId) ?? null,
          }
        : d.scopeKind === 'INSERTION_ORDER'
          ? { lineItemId: null, ioId: d.scopeId }
          : { lineItemId: null, ioId: null };
    const campaignId = scope.ioId ? (ctx.adv.campaignOfIo.get(scope.ioId) ?? null) : null;
    const where = {
      sandboxId: ctx.sandboxId,
      advertiserId,
      diagnosticCode: d.code,
      lineItemId: scope.lineItemId,
      ioId: scope.ioId,
      state: 'OPEN' as const,
    };
    if (d.action === 'RAISE') {
      if (suppressed(ctx.adv, d.code)) continue;
      const open = await tx.alert.findFirst({ where, select: { id: true } });
      if (open) {
        await tx.alert.update({ where: { id: open.id }, data: { lastSeenAt: at } });
      } else {
        const { type, category } = alertTypeOf(d.code);
        await tx.alert.create({
          data: {
            id: newId(),
            sandboxId: ctx.sandboxId,
            advertiserId,
            campaignId,
            ioId: scope.ioId,
            lineItemId: scope.lineItemId,
            type,
            severity: d.severity,
            category,
            title: TITLES[d.code],
            diagnosticCode: d.code,
            payload: d.params,
            firstSeenAt: at,
            lastSeenAt: at,
          },
        });
        raised.push(d.code);
      }
      rows++;
    } else {
      const res = await tx.alert.updateMany({
        where,
        data: { state: 'RESOLVED', resolvedAt: at, lastSeenAt: at },
      });
      rows += res.count;
    }
  }
  return { rows, raised };
}

export async function persistTick(
  tx: Tx,
  ctx: PersistCtx,
  out: TickOutput,
): Promise<PersistResult> {
  if (!out.applied) return { rows: 0, raised: [] };
  let rows = 0;
  const { sandboxId, classroomId } = ctx;

  // 1. hourly totals (one row per line item and sim hour)
  const hourCols: Col[] = [
    { name: 'sandboxId', cast: 'text' },
    { name: 'lineItemId', cast: 'text' },
    { name: 'simHour', cast: 'timestamp' },
    ...METRIC_COLS,
  ];
  const hourly = out.hourly
    .filter((h) => !isZero(h.metrics))
    .map((h) => [
      sandboxId,
      h.lineItemId,
      new Date(h.hourStartMs).toISOString(),
      ...metricValues(h.metrics),
    ]);
  rows += await upsertAdditive(
    tx,
    'SimHourlyMetric',
    ['lineItemId', 'adGroupId', 'simHour'],
    hourCols,
    hourly,
    METRIC_COLS.map((c) => c.name),
  );

  // 2. daily totals and slices
  const dayCols: Col[] = [
    { name: 'sandboxId', cast: 'text' },
    { name: 'classroomId', cast: 'text' },
    { name: 'lineItemId', cast: 'text' },
    { name: 'simDate', cast: 'date' },
    { name: 'sliceKind', cast: 'text' },
    { name: 'sliceKey', cast: 'text' },
    ...METRIC_COLS,
  ];
  const daily = out.daily
    .filter((d) => !isZero(d.metrics))
    .map((d) => [
      sandboxId,
      classroomId,
      d.lineItemId,
      d.date,
      d.sliceKind,
      d.sliceKey,
      ...metricValues(d.metrics),
    ]);
  rows += await upsertAdditive(
    tx,
    'SimDailyMetric',
    ['lineItemId', 'simDate', 'sliceKind', 'sliceKey'],
    dayCols,
    daily,
    METRIC_COLS.map((c) => c.name),
  );

  // 3. funnel counts (DeliveryDiagnostic), merged per key first so one statement never hits a key twice
  const diagMap = new Map<string, { row: string[]; count: number }>();
  for (const f of out.funnel) {
    if (f.count <= 0) continue;
    const k = `${f.lineItemId}|${f.date}|${f.exchangeId}|${f.reasonCode}`;
    const hit = diagMap.get(k);
    if (hit) hit.count += f.count;
    else
      diagMap.set(k, {
        row: [sandboxId, f.lineItemId, f.date, f.exchangeId, f.stage, f.reasonCode],
        count: f.count,
      });
  }
  const diagCols: Col[] = [
    { name: 'sandboxId', cast: 'text' },
    { name: 'lineItemId', cast: 'text' },
    { name: 'date', cast: 'date' },
    { name: 'exchangeId', cast: 'text' },
    { name: 'stage', cast: 'DiagStage' },
    { name: 'reasonCode', cast: 'text' },
    { name: 'count', cast: 'bigint' },
  ];
  rows += await upsertAdditive(
    tx,
    'DeliveryDiagnostic',
    ['lineItemId', 'adGroupId', 'date', 'exchangeId', 'reasonCode'],
    diagCols,
    [...diagMap.values()].map((v) => [...v.row, String(Math.round(v.count))]),
    ['count'],
  );

  // 4. pacing snapshots (state, not deltas: set the day's values)
  for (const p of out.pacing) {
    if (p.scopeKind !== 'INSERTION_ORDER' || !p.segmentId) continue;
    const end = ctx.adv.segmentEnds.get(p.segmentId);
    const daysLeft = end
      ? Math.max(0, Math.round((Date.parse(end) - Date.parse(p.date)) / 86_400_000))
      : 0;
    const planned = p.pacingPct > 0 ? p.spentToDate / p.pacingPct : 0;
    const data = {
      plannedSpendToDate: planned.toFixed(4),
      actualSpendToDate: p.spentToDate.toFixed(4),
      remainingBudget: p.budgetRemaining.toFixed(4),
      pacingPct: p.pacingPct.toFixed(4),
      budgetAtRisk: (p.budgetAtRisk ?? 0).toFixed(4),
      daysLeft,
      likelyToSpendPct: (p.segmentBudget > 0 && p.projected !== null
        ? (p.projected / p.segmentBudget) * 100
        : 0
      ).toFixed(4),
      underpacing: p.underpacing,
    };
    await tx.simPacingSnapshot.upsert({
      where: {
        budgetSegmentId_simDate: {
          budgetSegmentId: p.segmentId,
          simDate: new Date(`${p.date}T00:00:00Z`),
        },
      },
      create: {
        id: newId(),
        sandboxId,
        ioId: p.scopeId,
        budgetSegmentId: p.segmentId,
        simDate: new Date(`${p.date}T00:00:00Z`),
        ...data,
      },
      update: data,
    });
    rows++;
  }

  // 5. reach (lifetime, windowDays 0)
  for (const r of out.reach) {
    const date = new Date(`${r.date}T00:00:00Z`);
    const data = {
      impressionReach: BigInt(Math.round(r.impressionReach)),
      avgFrequency: r.avgFrequency.toFixed(4),
    };
    await tx.simReachSnapshot.upsert({
      where: {
        scopeType_scopeId_simDate_windowDays: {
          scopeType: 'LINE_ITEM',
          scopeId: r.lineItemId,
          simDate: date,
          windowDays: 0,
        },
      },
      create: {
        id: newId(),
        sandboxId,
        scopeType: 'LINE_ITEM',
        scopeId: r.lineItemId,
        simDate: date,
        windowDays: 0,
        ...data,
      },
      update: data,
    });
    rows++;
  }

  // 6. alerts
  const alerts = await persistAlerts(tx, ctx, out.alerts, out.hourStartMs);
  return { rows: rows + alerts.rows, raised: alerts.raised };
}
