// Calibration runs of the benchmark advertiser (engine.md 11.3). The tests assert outcomes against
// the bands in params.calibration; nothing here reads a band.

import { defaultParams, loadParams, newSimState, runTick } from '../index';
import type { LoadedParams, TickOutput, World } from '../index';
import { emptyMetrics, METRIC_KEYS, type Metrics } from '../metrics';
import type { Format } from '../types';
import { benchmarkWorld, ioOf, liOf, creativeFor, baseWorld, purchase } from './fixtures';

export interface RunResult {
  outputs: TickOutput[];
  /** Day-total metrics summed over the run, per format slice. */
  byFormat: Record<string, Metrics>;
  total: Metrics;
  /** Funnel counts by reason code summed over the run. */
  funnel: Map<string, number>;
}

export function run(
  world: World,
  ticks: number,
  loaded: LoadedParams = defaultParams(),
): RunResult {
  let state = newSimState();
  const outputs: TickOutput[] = [];
  for (let t = 0; t < ticks; t++) {
    const r = runTick(world, state, loaded, t);
    state = r.state;
    outputs.push(r.output);
  }
  const byFormat: Record<string, Metrics> = {};
  const total = emptyMetrics();
  const funnel = new Map<string, number>();
  for (const o of outputs) {
    for (const d of o.daily) {
      const target =
        d.sliceKind === 'format'
          ? (byFormat[d.sliceKey] ??= emptyMetrics())
          : d.sliceKind === 'total'
            ? total
            : null;
      if (target) for (const k of METRIC_KEYS) target[k] += d.metrics[k];
    }
    for (const f of o.funnel) funnel.set(f.reasonCode, (funnel.get(f.reasonCode) ?? 0) + f.count);
  }
  return { outputs, byFormat, total, funnel };
}

/** Average media CPM (net of refunds, per billable impression). */
export const mediaCpm = (m: Metrics): number =>
  ((m.mediaCost - m.refund) / 1e6 / m.billableImpressions) * 1000;
export const ctr = (m: Metrics): number => m.clicks / m.billableImpressions;
export const viewableRate = (m: Metrics): number => m.viewableImpressions / m.measurableImpressions;

/** The seven day benchmark: one line item per format at 1.2 x the clearing median. */
export function benchmark(ticks = 168, loaded?: LoadedParams): RunResult {
  return run(benchmarkWorld(), ticks, loaded ?? formatSlicesOnly);
}

/** The calibration reads the format slice only; the other slices would cost a quarter of the run time. */
const formatSlicesOnly = loadParams({ aggregation: { dailySliceKinds: ['total', 'format'] } });

/** Display only at a multiple of the clearing median, for win rate checks. */
export function winRateAt(multiple: number, ticks = 48, format: Format = 'display'): number {
  const r = run(benchmarkWorld({ formats: [format], bidMultiple: multiple }), ticks);
  return (r.funnel.get('M.WON') ?? 0) / (r.funnel.get('M.BID_RESPONSES') ?? 1);
}

/** A single-region display line item with a 30 day Rs 3,00,000 segment, for the pacing bands. */
export function flightWorld(type: 'EVEN' | 'AHEAD', budget = 300_000): World {
  const d = liOf(
    'li1',
    'display',
    {
      pacing: { period: 'FLIGHT', type: 'EVEN' },
      bid: { kind: 'FIXED', fixedCpm: 100 },
      inventoryQuality: 'ALL',
    },
    { exchanges: ['index_exchange'], geo: { includeRegions: ['IN-MH', 'IN-DL', 'IN-REST'] } },
  );
  return baseWorld({
    partner: { id: 'p1', currency: 'INR', enabledExchanges: ['index_exchange'] },
    insertionOrders: [
      ioOf({
        segments: [{ id: 'seg1', amount: budget, startDay: '2026-11-01', endDay: '2026-11-30' }],
        pacing: { period: 'FLIGHT', type },
      }),
    ],
    lineItems: [d],
    creatives: [
      { ...creativeFor('display'), size: '300x250' },
      { ...creativeFor('display', 'cr-display-2'), size: '320x50' },
    ],
    floodlightActivities: [purchase],
  });
}
