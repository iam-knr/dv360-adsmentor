import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { activeSegment, remainingDays } from '@/lib/engine/pacing/budgetState';
import { waterFill } from '@/lib/engine/pacing/allocation';
import {
  dailyTarget,
  evaluateUnderpacing,
  hourlyAllowance,
  pacingKind,
} from '@/lib/engine/pacing/targets';
import { throttle } from '@/lib/engine/pacing/throttle';
import { params, property } from './helpers';

const P = params.params;

describe('daily target and hourly allowance (engine.md 7.3 worked examples)', () => {
  it('Flight Even: Rs 2,10,000 left over 20 days is Rs 10,500 a day', () => {
    const T = dailyTarget('FLIGHT_EVEN', 210_000, 20, undefined, P);
    expect(T).toBe(10_500);
    expect(hourlyAllowance('FLIGHT_EVEN', T, 0, 16)).toBeCloseTo(656.25, 2); // 08:00
    expect(hourlyAllowance('FLIGHT_EVEN', T, 1800, 14)).toBeCloseTo(621.43, 2); // 10:00
  });

  it('Flight Ahead is 17.6% above even, capped at twice the even target', () => {
    const T = dailyTarget('FLIGHT_AHEAD', 210_000, 20, undefined, P);
    expect(T).toBeCloseTo(12_352.94, 1);
    expect(T / 10_500 - 1).toBeCloseTo(0.1765, 3);
    expect(dailyTarget('FLIGHT_AHEAD', 100_000, 2, undefined, P)).toBeLessThanOrEqual(2 * 50_000);
    expect(dailyTarget('FLIGHT_AHEAD', 12_345, 1, undefined, P)).toBe(12_345);
  });

  it('Daily Even with a Rs 12,000 amount', () => {
    const T = dailyTarget('DAILY_EVEN', 1_000_000, 30, 12_000, P);
    expect(T).toBe(12_000);
    expect(hourlyAllowance('DAILY_EVEN', T, 0, 24)).toBe(500);
    expect(hourlyAllowance('DAILY_EVEN', T, 3000, 14)).toBeCloseTo(642.86, 2);
    expect(dailyTarget('DAILY_EVEN', 5_000, 30, 12_000, P)).toBe(5_000);
  });

  it('ASAP is not paced inside the day', () => {
    expect(hourlyAllowance('FLIGHT_ASAP', 300_000, 0, 24)).toBe(Infinity);
    expect(hourlyAllowance('DAILY_ASAP', 12_000, 5_000, 10)).toBe(Infinity);
    expect(dailyTarget('FLIGHT_ASAP', 300_000, 30, undefined, P)).toBe(300_000);
  });

  it('maps period and type to a pacing kind', () => {
    expect(pacingKind('FLIGHT', 'EVEN')).toBe('FLIGHT_EVEN');
    expect(pacingKind('FLIGHT', 'AHEAD')).toBe('FLIGHT_AHEAD');
    expect(pacingKind('FLIGHT', 'ASAP')).toBe('FLIGHT_ASAP');
    expect(pacingKind('DAILY', 'EVEN')).toBe('DAILY_EVEN');
    expect(pacingKind('DAILY', 'ASAP')).toBe('DAILY_ASAP');
    expect(pacingKind('DAILY', 'AHEAD')).toBe('DAILY_EVEN');
  });

  property(
    'allowance never negative and spreading the target over the day sums to it',
    [fc.double({ min: 1, max: 1e7, noNaN: true }), fc.integer({ min: 1, max: 60 })],
    (R, D) => {
      const T = dailyTarget('FLIGHT_EVEN', R, D, undefined, P);
      let spent = 0;
      for (let h = 0; h < 24; h++) {
        const a = hourlyAllowance('FLIGHT_EVEN', T, spent, 24 - h);
        expect(a).toBeGreaterThanOrEqual(0);
        spent += a;
      }
      expect(spent).toBeCloseTo(T, 6);
    },
  );
});

describe('throttle (engine.md 7.4 worked example)', () => {
  it('Rs 1,200 expected against a Rs 750 allowance filters 37.5% as pacing', () => {
    const r = throttle({
      sFull: 1200,
      budgetCaps: [{ amount: 1e9, code: 'B.IO_SEGMENT' }],
      paceCaps: [{ amount: 750, code: 'P.IO_PACING' }],
      overshootMax: 1.15,
    });
    expect(r.rPace).toBeCloseTo(0.625, 9);
    expect(r.rBudget).toBe(1);
    expect(r.r).toBeCloseTo(0.625, 9);
    expect(r.paceCode).toBe('P.IO_PACING');
  });

  it('Rs 300 left in the segment filters 75% as budget and none as pacing', () => {
    const r = throttle({
      sFull: 1200,
      budgetCaps: [{ amount: 300, code: 'B.IO_SEGMENT' }],
      paceCaps: [{ amount: 750, code: 'P.IO_PACING' }],
      overshootMax: 1.15,
    });
    expect(r.rBudget).toBeCloseTo(0.25, 9);
    expect(r.r).toBeCloseTo(0.25, 9);
    expect(r.budgetCode).toBe('B.IO_SEGMENT');
    expect(r.spendCap).toBeLessThanOrEqual(300);
  });

  it('nothing left means everything is a budget filter', () => {
    const r = throttle({
      sFull: 1200,
      budgetCaps: [{ amount: 0, code: 'B.LINE_ITEM_BUDGET' }],
      paceCaps: [],
      overshootMax: 1.15,
    });
    expect(r.rBudget).toBe(0);
    expect(r.r).toBe(0);
  });

  it('picks the binding cap and clips overshoot to 1.15 times the allowance', () => {
    const r = throttle({
      sFull: 100,
      budgetCaps: [
        { amount: 500, code: 'B.LINE_ITEM_DAILY' },
        { amount: 800, code: 'B.IO_SEGMENT' },
      ],
      paceCaps: [
        { amount: 60, code: 'P.LINE_ITEM_PACING' },
        { amount: 90, code: 'P.IO_PACING' },
      ],
      overshootMax: 1.15,
    });
    expect(r.budgetCode).toBe('B.LINE_ITEM_DAILY');
    expect(r.paceCode).toBe('P.LINE_ITEM_PACING');
    expect(r.spendCap).toBeCloseTo(69, 9);
  });

  it('an unconstrained line item bids on everything', () => {
    const r = throttle({ sFull: 50, budgetCaps: [], paceCaps: [], overshootMax: 1.15 });
    expect(r.r).toBe(1);
    expect(r.spendCap).toBe(Infinity);
  });
});

describe('underpacing (engine.md 7.6 worked example)', () => {
  const base = { segmentBudget: 300_000, segmentDays: 30, thresholdPct: 90 };

  it('projects Rs 1,80,000 and Rs 1,20,000 at risk after 10 days', () => {
    const r = evaluateUnderpacing(
      { ...base, spentToDate: 60_000, elapsedDays: 10, remainingDays: 20, recentSpend: 42_000 },
      P,
    );
    expect(r.projected).toBe(180_000);
    expect(r.underpacing).toBe(true);
    expect(r.budgetAtRisk).toBe(120_000);
    expect(r.pacingPct).toBeCloseTo(0.6, 9);
    expect(r.likelyToSpend).toBe(false);
  });

  it('does not alert in the first 24 hours', () => {
    const r = evaluateUnderpacing(
      { ...base, spentToDate: 0, elapsedDays: 0.5, remainingDays: 29, recentSpend: 0 },
      P,
    );
    expect(r.evaluated).toBe(false);
    expect(r.underpacing).toBe(false);
  });

  it('a campaign on track is not underpacing and can be over-pacing', () => {
    expect(
      evaluateUnderpacing(
        { ...base, spentToDate: 100_000, elapsedDays: 10, remainingDays: 20, recentSpend: 70_000 },
        P,
      ).underpacing,
    ).toBe(false);
    const over = evaluateUnderpacing(
      { ...base, spentToDate: 130_000, elapsedDays: 10, remainingDays: 20, recentSpend: 91_000 },
      P,
    );
    expect(over.overpacing).toBe(true);
  });
});

describe('segments (engine.md 7.1)', () => {
  const segs = [
    { id: 'a', amount: 100_000, startDay: '2026-11-01', endDay: '2026-11-10' },
    { id: 'b', amount: 200_000, startDay: '2026-11-11', endDay: '2026-11-30' },
  ];
  it('finds the segment of a day, end inclusive, and none in a gap', () => {
    expect(activeSegment(segs, '2026-11-10')?.id).toBe('a');
    expect(activeSegment(segs, '2026-11-11')?.id).toBe('b');
    expect(activeSegment(segs, '2026-12-01')).toBeUndefined();
    expect(
      activeSegment([segs[0]!, { ...segs[1]!, startDay: '2026-11-15' }], '2026-11-12'),
    ).toBeUndefined();
  });
  it('counts remaining days including today', () => {
    expect(remainingDays('2026-11-11', '2026-11-30')).toBe(20);
    expect(remainingDays('2026-11-30', '2026-11-30')).toBe(1);
  });
});

describe('allocation across line items (engine.md 7.5)', () => {
  it('splits by weight and hands the leftover of a capped item to the others', () => {
    expect(waterFill(100, [1, 1], [Infinity, Infinity])).toEqual([50, 50]);
    const a = waterFill(100, [1, 1, 1], [10, Infinity, Infinity]);
    expect(a[0]).toBe(10);
    expect(a[1]).toBeCloseTo(45, 9);
    expect(a[2]).toBeCloseTo(45, 9);
    expect(waterFill(Infinity, [1, 1], [5, 7])).toEqual([5, 7]);
    expect(waterFill(0, [1, 1], [5, 7])).toEqual([0, 0]);
    expect(waterFill(10, [], [])).toEqual([]);
  });

  property(
    'never allocates more than the total or any capacity, and uses everything it can',
    [
      fc.double({ min: 0, max: 1e6, noNaN: true }),
      fc.array(
        fc.tuple(
          fc.double({ min: 0.01, max: 10, noNaN: true }),
          fc.double({ min: 0, max: 5e5, noNaN: true }),
        ),
        { minLength: 1, maxLength: 8 },
      ),
    ],
    (total, items) => {
      const out = waterFill(
        total,
        items.map((i) => i[0]),
        items.map((i) => i[1]),
      );
      const used = out.reduce((a, b) => a + b, 0);
      out.forEach((x, i) => {
        expect(x).toBeGreaterThanOrEqual(-1e-9);
        expect(x).toBeLessThanOrEqual(items[i]![1] + 1e-6);
      });
      expect(used).toBeLessThanOrEqual(total + 1e-6);
      const capSum = items.reduce((a, i) => a + i[1], 0);
      expect(used).toBeCloseTo(Math.min(total, capSum), 3);
    },
  );
});
