import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { computeCellMoney } from '@/lib/engine/costs';
import {
  convertMicros,
  consumptionLinear,
  fxToCurrency,
  invoicedParts,
  netOfFees,
  resolveFees,
  revenueLinear,
  type FeeSchedule,
} from '@/lib/engine/economics';
import type { CellOutcome } from '@/lib/engine/outcomes';
import { baseWorld, creativeFor, ioOf, liOf } from '@/lib/engine/testing/fixtures';
import { indexWorld } from '@/lib/engine/world';
import { params, property } from './helpers';

const P = params.params;

function outcome(over: {
  media: number;
  W: number;
  billable?: number;
  invalid?: number;
}): CellOutcome {
  return {
    ca: { media: over.media, W: over.W },
    imp: { impressions: over.W, billable: over.billable ?? over.W, invalid: over.invalid ?? 0 },
  } as unknown as CellOutcome;
}

const schedule = (over: Partial<FeeSchedule> = {}): FeeSchedule => ({
  cpm: [{ amount: 5, invoiced: true }],
  media: [
    { pct: 0.1, invoiced: true },
    { pct: 0.05, invoiced: true },
  ],
  dataCpm: 0,
  verificationCpm: 5.71,
  adServingCpm: 0,
  revenue: { type: 'TOTAL_MEDIA_COST_MARKUP', markup: 0.2, cpm: 0 },
  ...over,
});

describe('costs worked example (engine.md 8.6)', () => {
  const m = computeCellMoney(outcome({ media: 650, W: 10_000 }), schedule(), 1, P);

  it('10,000 billable impressions at Rs 65 media CPM', () => {
    expect(m.mediaCost).toBe(650_000_000);
    expect(m.cpmFee1).toBe(50_000_000);
    expect(m.mediaFee2).toBe(32_500_000);
    expect(m.mediaFee1).toBe(65_000_000);
    expect(m.verificationCost).toBe(57_100_000);
    expect(m.dataCost).toBe(0);
    expect(m.totalMediaCost).toBe(854_600_000);
    expect(m.revenue).toBe(1_025_520_000);
    expect(m.profit).toBe(170_920_000);
    expect(m.profit / m.revenue).toBeCloseTo(0.1667, 3);
    expect((m.totalMediaCost / 10_000) * 1000).toBeCloseTo(85_460_000, 0);
    expect(m.clientCost).toBe(m.revenue);
  });

  it('non-invoiced fees reduce profit but not revenue', () => {
    const s = schedule({
      cpm: [{ amount: 5, invoiced: false }],
      revenue: { type: 'TOTAL_MEDIA_COST_MARKUP', markup: 0, cpm: 0 },
    });
    const x = computeCellMoney(outcome({ media: 650, W: 10_000 }), s, 1, P);
    expect(x.revenue).toBe(650_000_000 + 65_000_000 + 32_500_000 + 57_100_000);
    expect(x.profit).toBe(-50_000_000);
  });

  it('media cost markup applies to media only; invoiced fees pass through', () => {
    const s = schedule({ revenue: { type: 'MEDIA_COST_MARKUP', markup: 0.2, cpm: 0 } });
    const x = computeCellMoney(outcome({ media: 650, W: 10_000 }), s, 1, P);
    expect(x.revenue).toBe(780_000_000 + 50_000_000 + 32_500_000 + 65_000_000 + 57_100_000);
  });

  it('CPM revenue model bills billable impressions', () => {
    const s = schedule({ revenue: { type: 'CPM_VALUE', markup: 0, cpm: 100 } });
    const x = computeCellMoney(outcome({ media: 650, W: 10_000 }), s, 1, P);
    expect(x.revenue).toBe(1_000_000_000);
  });

  it('refunds invalid impressions: media cost net of the refund drives the fees', () => {
    const x = computeCellMoney(
      outcome({ media: 650, W: 10_000, billable: 9_000, invalid: 1_000 }),
      schedule({ cpm: [], verificationCpm: 0, media: [{ pct: 0.1, invoiced: true }] }),
      1,
      P,
    );
    expect(x.refund).toBe(65_000_000);
    expect(x.mediaCost).toBe(650_000_000);
    expect(x.mediaFee1).toBe(58_500_000);
    expect(x.totalMediaCost).toBe(585_000_000 + 58_500_000);
  });

  it('converts the computing currency to the advertiser currency', () => {
    const fx = fxToCurrency(P, 'USD');
    expect(fx).toBeCloseTo(1 / 88, 9);
    const x = computeCellMoney(
      outcome({ media: 650, W: 10_000 }),
      schedule({
        cpm: [],
        verificationCpm: 0,
        media: [{ pct: 0, invoiced: true }],
        revenue: { type: 'TOTAL_MEDIA_COST_MARKUP', markup: 0, cpm: 0 },
      }),
      fx,
      P,
    );
    expect(x.mediaCost).toBe(Math.round((650 / 88) * 1e6));
  });
});

describe('currency triplets (engine.md 8.7, RC-025)', () => {
  property(
    'converting there and back stays within a micro of rounding',
    [
      fc.integer({ min: 0, max: 1e12 }),
      fc.constantFrom('INR', 'USD', 'SGD', 'GBP', 'EUR', 'AUD', 'AED'),
    ],
    (micros, cur) => {
      const there = convertMicros(micros, 'INR', cur, P);
      const back = convertMicros(there, cur, 'INR', P);
      const f = P.fx.perUSD.INR! / P.fx.perUSD[cur]!;
      // one micro of rounding in the target currency is worth `f` micros of INR
      expect(Math.abs(back - micros)).toBeLessThanOrEqual(Math.max(1, Math.ceil(f)) + 1);
    },
  );

  it('derived amounts satisfy |A / fx - U| <= 1 micro', () => {
    const inr = 123_456_789;
    const usd = convertMicros(inr, 'INR', 'USD', P);
    expect(Math.abs(inr / (P.fx.perUSD.INR! / P.fx.perUSD.USD!) - usd)).toBeLessThanOrEqual(1);
  });
});

describe('fee schedule resolution (engine.md 8.2 to 8.4)', () => {
  const w = baseWorld({
    insertionOrders: [
      ioOf({ partnerCosts: [{ kind: 'CPM_FEE', slot: 1, amount: 3, invoiced: true }] }),
    ],
    creatives: [{ ...creativeFor('display'), advancedAdServingCpm: 2 }],
    audiences: [{ id: 'tp', type: 'custom', dataCpm: 35, sizeFraction: 0.02 }],
  });
  const idx = indexWorld(w);
  const io = w.insertionOrders[0]!;
  const inputs = (li = liOf('l', 'display')) => ({
    li,
    io,
    params: P,
    currency: 'INR',
    audiences: idx.audiences,
    creatives: idx.creatives,
  });

  it('inherits IO partner costs unless the line item overrides them', () => {
    expect(resolveFees(inputs()).cpm).toEqual([{ amount: 3, invoiced: true }]);
    const li = {
      ...liOf('l', 'display'),
      partnerCosts: [
        { kind: 'MEDIA_FEE' as const, slot: 2 as const, amount: 0.04, invoiced: false },
      ],
    };
    const s = resolveFees(inputs(li));
    expect(s.cpm).toEqual([]);
    expect(s.media).toEqual([
      { pct: 0.1, invoiced: true },
      { pct: 0.04, invoiced: false },
    ]);
  });

  it('adds data, verification and ad serving costs', () => {
    const li = {
      ...liOf('l', 'display'),
      creativeIds: ['cr-display'],
      targeting: {
        audiences: { includeGroups: [['tp']] },
        verification: ['dv_brand_safety', 'dv_fraud'],
      },
    };
    const s = resolveFees(inputs(li));
    expect(s.dataCpm).toBe(35);
    expect(s.verificationCpm).toBeCloseTo(5.71 + 5.71, 9);
    expect(s.adServingCpm).toBe(2);
  });

  it('ABS replaces the standard brand safety and fraud options', () => {
    const li = {
      ...liOf('l', 'display'),
      targeting: { verification: ['dv_abs', 'dv_brand_safety', 'dv_fraud'] },
    };
    expect(resolveFees(inputs(li)).verificationCpm).toBeCloseTo(20.95, 9);
  });

  it('turns fees into a linear revenue and a net media bid', () => {
    const s = schedule();
    const lin = revenueLinear(s);
    expect(lin.a).toBeCloseTo(1.2 * 1.15, 9);
    expect(lin.b).toBeCloseTo((1.2 * (5 + 5.71)) / 1000, 9);
    expect(invoicedParts(s).pct).toBeCloseTo(0.15, 9);
    // a bid worth 100 per mille of revenue buys less media once fees and markup are taken out
    const net = netOfFees(100, s, 1);
    expect(net).toBeLessThan(100);
    expect(lin.a * net + lin.b * 1000).toBeCloseTo(100, 6);
    expect(netOfFees(0.5, s, 1)).toBe(0);
    expect(consumptionLinear('IMPRESSIONS', s)).toEqual({ a: 0, b: 1 });
  });
});
