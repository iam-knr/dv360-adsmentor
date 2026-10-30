// History mode (engine.md 10.3, docs/gaps/eng-ff.md): the outputs of a whole batch of ticks are merged into one
// TickOutput so the io layer writes them with one set of statements instead of one set per tick. Additive rows (hourly,
// daily, funnel) are kept or summed, state rows (pacing, reach) keep the latest value of each key, alert decisions keep
// the latest decision of each alert, and recommendations come from the last tick only. The merged output carries the
// last tick's clock fields, so side effects that depend on "now" (audience, experiment, lift steps) run once at the
// end of the batch.
import { CONVERSION_KEYS, METRIC_KEYS, type Metrics } from '../metrics';
import type { DailyRow, HourlyRow, TickOutput } from '../output';

const roundTo = (x: number, digits: number): number => {
  const f = 10 ** digits;
  return Math.round(x * f) / f;
};

/**
 * What the database stores for a delta: the value is sent as a six-decimal string (toFixed) and Postgres rounds that
 * decimal half away from zero to the column scale. Integer micros avoid the double rounding errors of x * 10^n.
 */
function toScale(x: number, scale: number): number {
  const micros = Math.round(Number(x.toFixed(6)) * 1e6);
  if (scale >= 6) return micros / 1e6;
  const unit = 10 ** (6 - scale);
  return (Math.sign(micros) * Math.floor((Math.abs(micros) + unit / 2) / unit)) / 10 ** scale;
}

/** Decimal scale of the stored conversion columns: Decimal(20,4) for counts, Decimal(20,6) for revenue. */
const CONV_SCALE: Record<(typeof CONVERSION_KEYS)[number], number> = {
  convPostClick: 4,
  convPostView: 4,
  convTotal: 4,
  convRevenue: 6,
  convTransactions: 4,
  convItems: 4,
};

function addInto(target: Metrics, delta: Metrics): void {
  for (const k of METRIC_KEYS) target[k] += delta[k];
}

/**
 * The per-tick path writes each delta as a six-decimal string and the database rounds it to the column scale before
 * it adds it to the stored row. Round each delta the same way so the merged sums agree to the last digit.
 */
function rounded(m: Metrics): Metrics {
  const out = { ...m };
  for (const k of CONVERSION_KEYS) out[k] = toScale(out[k], CONV_SCALE[k]);
  return out;
}

export interface MergeOptions {
  /** Hourly rows with `hourStartMs` below this are dropped (outside the 14 day retention window). */
  hourlyFromMs?: number;
}

/** Merges the applied outputs of consecutive ticks of one advertiser. Returns null when none was applied. */
export function mergeOutputs(
  outputs: readonly TickOutput[],
  options: MergeOptions = {},
): TickOutput | null {
  const applied = outputs.filter((o) => o.applied);
  const last = applied[applied.length - 1];
  if (!last) return null;
  const hourlyFrom = options.hourlyFromMs ?? Number.NEGATIVE_INFINITY;

  const hourly: HourlyRow[] = [];
  const daily = new Map<string, DailyRow>();
  const pacing = new Map<string, TickOutput['pacing'][number]>();
  const reach = new Map<string, TickOutput['reach'][number]>();
  const alerts = new Map<string, TickOutput['alerts'][number]>();
  for (const o of applied) {
    for (const h of o.hourly) if (h.hourStartMs >= hourlyFrom) hourly.push(h);
    for (const d of o.daily) {
      const key = `${d.lineItemId}|${d.date}|${d.sliceKind}|${d.sliceKey}`;
      const hit = daily.get(key);
      if (hit) {
        addInto(hit.metrics, rounded(d.metrics));
        for (const k of CONVERSION_KEYS) hit.metrics[k] = roundTo(hit.metrics[k], CONV_SCALE[k]);
      } else daily.set(key, { ...d, metrics: rounded(d.metrics) });
    }
    for (const p of o.pacing) pacing.set(`${p.scopeKind}|${p.scopeId}|${p.segmentId}|${p.date}`, p);
    for (const r of o.reach) reach.set(`${r.lineItemId}|${r.date}`, r);
    for (const a of o.alerts) {
      const key = `${a.code}|${a.scopeKind}|${a.scopeId}`;
      alerts.delete(key); // keep the order of the latest decisions
      alerts.set(key, a);
    }
  }
  return {
    tick: last.tick,
    applied: true,
    hourStartMs: last.hourStartMs,
    date: last.date,
    hour: last.hour,
    funnel: applied.flatMap((o) => o.funnel),
    hourly,
    daily: [...daily.values()],
    liveStatus: last.liveStatus,
    alerts: [...alerts.values()],
    recommendations: last.recommendations,
    pacing: [...pacing.values()],
    reach: [...reach.values()],
    learning: last.learning,
  };
}
