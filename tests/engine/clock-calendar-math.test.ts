import { describe, expect, it } from 'vitest';
import {
  civilFromDays,
  dayToIso,
  daysFromCivil,
  isoToDay,
  tickToLocal,
} from '@/lib/engine/calendar';
import { dueTicks, msPerTick, resumeClock, speedAllowed } from '@/lib/engine/clock/clock';
import { Phi, largestRemainder, roundHalfEven } from '@/lib/engine/math';
import { SIM_START_MS } from '@/lib/engine/testing/fixtures';
import { property } from './helpers';
import fc from 'fast-check';

describe('calendar', () => {
  it('maps tick 0 to local midnight of the start day in Asia/Kolkata', () => {
    const l = tickToLocal(SIM_START_MS, 330, 0);
    expect(l.date).toBe('2026-11-01');
    expect(l.hour).toBe(0);
    expect(l.dow).toBe(6); // Sunday
  });

  it('advances hours, days and weekdays', () => {
    const a = tickToLocal(SIM_START_MS, 330, 25);
    expect(a.date).toBe('2026-11-02');
    expect(a.hour).toBe(1);
    expect(a.dow).toBe(0); // Monday
    expect(tickToLocal(SIM_START_MS, 330, 24 * 30).date).toBe('2026-12-01');
  });

  it('shows the same instant on another zone', () => {
    const l = tickToLocal(SIM_START_MS, 0, 0); // UTC view of 00:00 IST
    expect(l.date).toBe('2026-10-31');
    expect(l.hour).toBe(18);
  });

  it('round-trips civil dates, including leap days', () => {
    for (const iso of ['1970-01-01', '2024-02-29', '2026-10-28', '2100-03-01']) {
      expect(dayToIso(isoToDay(iso))).toBe(iso);
    }
    const { y, m, d } = civilFromDays(daysFromCivil(2028, 2, 29));
    expect([y, m, d]).toEqual([2028, 2, 29]);
  });
});

describe('clock due ticks (engine.md 1.2)', () => {
  it('uses 12.5 s per tick at the default 5 minutes per sim day', () => {
    expect(msPerTick(5)).toBe(12_500);
    expect(speedAllowed(2)).toBe(true);
    expect(speedAllowed(1)).toBe(false);
  });

  it('carries the remainder, no drift and no double count', () => {
    const per = msPerTick(5);
    let last = 0;
    let remainder = 0;
    let ticks = 0;
    // call at irregular real times; the total must match the elapsed time exactly
    for (const now of [7_000, 21_000, 22_000, 61_000, 200_000, 200_001]) {
      const r = dueTicks(
        { minutesPerSimDay: 5, lastAdvanceRealMs: last, remainderMs: remainder },
        now,
        1000,
      );
      ticks += r.due;
      remainder = r.remainderMs;
      last = now;
    }
    expect(ticks).toBe(Math.floor(200_001 / per));
    expect(ticks * per + remainder).toBeCloseTo(200_001, 6);
  });

  it('caps a catch-up run and keeps the rest as remainder', () => {
    const r = dueTicks(
      { minutesPerSimDay: 5, lastAdvanceRealMs: 0, remainderMs: 0 },
      12_500 * 200,
      96,
    );
    expect(r.due).toBe(96);
    expect(r.remainderMs).toBe(12_500 * 104);
  });

  it('does not owe paused time after resume', () => {
    const c = resumeClock({ minutesPerSimDay: 5, lastAdvanceRealMs: 0, remainderMs: 0 }, 1_000_000);
    expect(dueTicks(c, 1_000_000).due).toBe(0);
  });
});

describe('math', () => {
  it('Phi matches known values', () => {
    expect(Phi(0)).toBeCloseTo(0.5, 7);
    expect(Phi(1.96)).toBeCloseTo(0.975, 4);
    expect(Phi(-1.645)).toBeCloseTo(0.05, 3);
    expect(Phi(8)).toBeCloseTo(1, 9);
  });

  it('banker rounding', () => {
    expect([0.5, 1.5, 2.5, -0.5, 2.4, 2.6].map(roundHalfEven)).toEqual([0, 2, 2, 0, 2, 3]);
  });

  property(
    'largest remainder always sums to the total with non-negative integers',
    [
      fc.integer({ min: 0, max: 5_000_000 }),
      fc.array(fc.double({ min: 0, max: 100, noNaN: true }), { minLength: 1, maxLength: 12 }),
    ],
    (total, weights) => {
      const out = largestRemainder(total, weights);
      expect(out.reduce((a, b) => a + b, 0)).toBe(total);
      for (const x of out) {
        expect(Number.isInteger(x)).toBe(true);
        expect(x).toBeGreaterThanOrEqual(0);
      }
    },
  );

  it('largest remainder splits by weight and breaks ties to the lower index', () => {
    expect(largestRemainder(10, [1, 1, 1])).toEqual([4, 3, 3]);
    expect(largestRemainder(100, [50, 30, 20])).toEqual([50, 30, 20]);
    expect(largestRemainder(0, [1, 2])).toEqual([0, 0]);
  });
});

import { planCatchUp, ticksAllowed } from '@/lib/engine/clock/clock';

describe('catch-up policy and clock states (engine.md 1.2, 1.4)', () => {
  it('simulate runs up to the cap and keeps the rest; skip advances without delivery', () => {
    expect(planCatchUp(40, 'simulate', 96)).toEqual({ simulate: 40, skip: 0, remaining: 0 });
    expect(planCatchUp(200, 'simulate', 96)).toEqual({ simulate: 96, skip: 0, remaining: 104 });
    expect(planCatchUp(200, 'skip')).toEqual({ simulate: 0, skip: 200, remaining: 0 });
  });

  it('only a running clock advances freely; stepping runs a fixed number; paused and locked run nothing', () => {
    expect(ticksAllowed('RUNNING', 7)).toBe(7);
    expect(ticksAllowed('STEPPING', 7, 3)).toBe(3);
    expect(ticksAllowed('STEPPING', 2, 3)).toBe(2);
    expect(ticksAllowed('PAUSED', 7)).toBe(0);
    expect(ticksAllowed('LOCKED', 7)).toBe(0);
  });
});
