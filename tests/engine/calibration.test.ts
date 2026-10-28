// Calibration against the benchmark ranges of engine.md 11.3. The bands come from
// engine/params.json (params.calibration); a failure prints observed values next to the band.
import { describe, expect, it } from 'vitest';
import { loadParams } from '@/lib/engine';
import { benchmarkWorld, SIM_START_MS } from '@/lib/engine/testing/fixtures';
import {
  benchmark,
  ctr,
  flightWorld,
  mediaCpm,
  run,
  viewableRate,
  winRateAt,
} from '@/lib/engine/testing/calibration';
import type { Format } from '@/lib/engine/types';
import { params } from './helpers';

const band = params.params.calibration;
const inBand = (name: string, v: number, [lo, hi]: readonly [number, number]): void => {
  expect(v >= lo && v <= hi, `${name}: observed ${v}, band [${lo}, ${hi}]`).toBe(true);
};

describe('11.3 benchmark advertiser, seven sim days', () => {
  const b = benchmark(168);
  const formats: Format[] = ['display', 'native', 'video_instream', 'ctv', 'audio', 'youtube'];

  it('every format delivers', () => {
    for (const f of formats) expect(b.byFormat[f]!.impressions, f).toBeGreaterThan(10_000);
  });

  it('average media CPM per format is inside the p10 to p90 of table 2.5', () => {
    for (const f of formats) inBand(`CPM ${f}`, mediaCpm(b.byFormat[f]!), band.cpmBand[f]!);
  });

  it('CTR is inside the band: display 0.0008 to 0.0035, other formats from the table', () => {
    inBand('CTR display', ctr(b.byFormat.display!), band.ctrBand);
    for (const f of formats.filter((x) => x !== 'display'))
      inBand(`CTR ${f}`, ctr(b.byFormat[f]!), band.ctrBandByFormat[f]!);
  });

  it('viewable rate of measurable impressions is inside the band', () => {
    for (const [f, r] of Object.entries(band.viewabilityBand))
      inBand(`viewable ${f}`, viewableRate(b.byFormat[f]!), r);
  });

  it('video completion and view rates are inside the bands', () => {
    for (const f of ['video_instream', 'ctv', 'audio'] as const) {
      const m = b.byFormat[f]!;
      inBand(
        `completion ${f}`,
        m.videoCompletions / m.videoStarts,
        f === 'video_instream' ? band.videoCompletionBand : [0.8, 0.99],
      );
    }
    for (const [f, r] of Object.entries(band.viewRateBand))
      inBand(`view rate ${f}`, b.byFormat[f]!.videoViews / b.byFormat[f]!.billableImpressions, r);
  });

  it('funnel is plausible: internal losses and other external drops', () => {
    const d = run(benchmarkWorld({ formats: ['display'] }), 48);
    const bids = d.funnel.get('M.BIDS_SUBMITTED')!;
    const responses = d.funnel.get('M.BID_RESPONSES')!;
    const internal =
      (d.funnel.get('A.LOST_INTERNAL') ?? 0) + (d.funnel.get('A.LOST_INTERNAL:OWN_LINE_ITEM') ?? 0);
    inBand('A.LOST_INTERNAL share of bids', internal / bids, band.lostInternalShare);
    inBand('E.OTHER share of responses', d.funnel.get('E.OTHER')! / responses, band.eOtherShare);
  });

  it('a single-region line item has 55% to 95% of requests filtered by targeting', () => {
    const w = benchmarkWorld({ formats: ['display'] });
    w.lineItems[0] = {
      ...w.lineItems[0]!,
      targeting: { formats: ['display'], geo: { includeRegions: ['IN-MH'] } },
      creativeIds: ['cr-display'],
    };
    const r = run(w, 24);
    const A = r.funnel.get('M.AVAILABLE')!;
    let t = 0;
    for (const [code, n] of r.funnel) if (code.startsWith('T.')) t += n;
    inBand('targeting filtered share', t / A, band.targetingFilteredSingleRegion);
  });
});

describe('11.3 win rate against the bid', () => {
  it('40% to 55% at the clearing median, 8% to 22% at 0.6 x, above 75% at 1.5 x', () => {
    inBand('win rate at 1.0 x', winRateAt(1.0), band.winRateAtClear);
    inBand('win rate at 0.6 x', winRateAt(0.6), band.winRateAt06);
    expect(winRateAt(1.5), 'win rate at 1.5 x').toBeGreaterThan(band.winRateAt15Min);
  });

  it('win rate is also sensible for video and CTV', () => {
    inBand('video at 1.0 x', winRateAt(1.0, 24, 'video_instream'), band.winRateAtClear);
    inBand('ctv at 1.0 x', winRateAt(1.0, 24, 'ctv'), band.winRateAtClear);
  });
});

describe('11.3 pacing over a 30 day segment', () => {
  const lite = loadParams({ aggregation: { dailySliceKinds: ['total'] } });
  const cumulativeByDay = (type: 'EVEN' | 'AHEAD') => {
    const r = run(flightWorld(type), 24 * 30, lite);
    const days: number[] = [];
    let acc = 0;
    r.outputs.forEach((o, i) => {
      acc += o.daily
        .filter((d) => d.sliceKind === 'total')
        .reduce((a, d) => a + d.metrics.revenue / 1e6, 0);
      if (i % 24 === 23) days.push(acc);
    });
    return days;
  };

  it('Flight Even reaches 97% to 103% of the budget', () => {
    const days = cumulativeByDay('EVEN');
    inBand('Flight Even spend share', days[29]! / 300_000, band.flightEvenPct);
    expect(days[29]!).toBeLessThanOrEqual(300_000 + 1e-6);
    // and it paces: about a third of the budget after ten days
    expect(days[9]! / 300_000).toBeGreaterThan(0.31);
    expect(days[9]! / 300_000).toBeLessThan(0.36);
  });

  it('Flight Ahead runs ahead of Even every day and finishes the budget on the last day', () => {
    const ahead = cumulativeByDay('AHEAD');
    const even = cumulativeByDay('EVEN');
    // engine.md 7.3 recomputes the Ahead target each day from the remaining budget, so the budget
    // is nearly gone by day 27 (about 94%) and exhausted on the last day
    inBand('Ahead share by day 27', ahead[26]! / 300_000, band.aheadShareByDay27);
    expect(ahead[29]! / 300_000).toBeGreaterThan(0.99);
    expect(ahead[29]!).toBeLessThanOrEqual(300_000 + 1e-6);
    ahead.slice(0, 29).forEach((v, i) => expect(v).toBeGreaterThan(even[i]!));
  });
});

describe('11.3 other markets', () => {
  it('US display CPM is India x 8.5 within +/- 10%, CTR index applied within +/- 10%', () => {
    const india = run(benchmarkWorld({ formats: ['display'] }), 24).byFormat.display!;
    // the bid scales with the market so both buys sit at the same point of their price distribution
    const w = benchmarkWorld({ formats: ['display'], bidMultiple: 1.2 * 8.5 });
    const us = run({ ...w, country: 'US', simStartMs: SIM_START_MS }, 24).byFormat.display!;
    const tol = band.marketPriceTolerance;
    expect(mediaCpm(us) / mediaCpm(india)).toBeGreaterThan(8.5 * (1 - tol));
    expect(mediaCpm(us) / mediaCpm(india)).toBeLessThan(8.5 * (1 + tol));
    const idx = params.params.markets.US!.ctrIdx;
    expect(ctr(us) / ctr(india)).toBeGreaterThan(idx * (1 - tol));
    expect(ctr(us) / ctr(india)).toBeLessThan(idx * (1 + tol));
  });
});
