// History mode merges the outputs of a batch (lib/engine/io/mergeOutputs.ts).
import { describe, expect, it } from 'vitest';
import { emptyMetrics } from '@/lib/engine/metrics';
import { mergeOutputs } from '@/lib/engine/io/mergeOutputs';
import { emptyOutput, type TickOutput } from '@/lib/engine/output';

const HOUR = 3_600_000;
const T0 = Date.UTC(2026, 9, 28);

function tick(n: number, patch: Partial<TickOutput> = {}): TickOutput {
  return {
    ...emptyOutput(n, true, T0 + n * HOUR, '2026-10-28', n % 24),
    ...patch,
  };
}

const metrics = (patch: Record<string, number>) => ({ ...emptyMetrics(), ...patch });

describe('mergeOutputs', () => {
  it('returns null when no tick was applied', () => {
    expect(mergeOutputs([])).toBeNull();
    expect(mergeOutputs([{ ...tick(0), applied: false }])).toBeNull();
  });

  it('sums daily rows by key and keeps the last tick clock fields', () => {
    const row = (impressions: number, sliceKey = '') => ({
      lineItemId: 'li1',
      date: '2026-10-28',
      sliceKind: sliceKey ? 'device' : 'total',
      sliceKey,
      metrics: metrics({ impressions, mediaCost: impressions * 1000 }),
    });
    const merged = mergeOutputs([
      tick(0, { daily: [row(10), row(4, 'phone')] }),
      tick(1, { daily: [row(5), row(2, 'phone')] }),
    ]);
    expect(merged?.tick).toBe(1);
    expect(merged?.hourStartMs).toBe(T0 + HOUR);
    const total = merged?.daily.find((d) => d.sliceKind === 'total');
    expect(total?.metrics.impressions).toBe(15);
    expect(total?.metrics.mediaCost).toBe(15_000);
    expect(merged?.daily.find((d) => d.sliceKey === 'phone')?.metrics.impressions).toBe(6);
  });

  it('does not change the rows of the inputs', () => {
    const first = metrics({ impressions: 1 });
    const out = tick(0, {
      daily: [
        { lineItemId: 'li1', date: '2026-10-28', sliceKind: 'total', sliceKey: '', metrics: first },
      ],
    });
    mergeOutputs([out, tick(1, { daily: out.daily })]);
    expect(first.impressions).toBe(1);
  });

  it('rounds conversions to the column scale before it adds, like the database does per tick', () => {
    const row = (convTotal: number, convRevenue: number) => ({
      lineItemId: 'li1',
      date: '2026-10-28',
      sliceKind: 'total',
      sliceKey: '',
      metrics: metrics({ convTotal, convRevenue }),
    });
    // 0.00005 rounds to 0.0001 in a Decimal(20,4) column, twice: 0.0002, not 0.0001
    const merged = mergeOutputs([
      tick(0, { daily: [row(0.00005, 0.0000005)] }),
      tick(1, { daily: [row(0.00005, 0.0000005)] }),
    ]);
    expect(merged?.daily[0]?.metrics.convTotal).toBeCloseTo(0.0002, 10);
    expect(merged?.daily[0]?.metrics.convRevenue).toBeCloseTo(0.000002, 10);
  });

  it('drops hourly rows before the retention cut-off', () => {
    const h = (n: number) => ({
      lineItemId: 'li1',
      hourStartMs: T0 + n * HOUR,
      date: '2026-10-28',
      hour: n,
      metrics: metrics({ impressions: n }),
    });
    const merged = mergeOutputs([tick(0, { hourly: [h(0)] }), tick(1, { hourly: [h(1)] })], {
      hourlyFromMs: T0 + HOUR,
    });
    expect(merged?.hourly.map((r) => r.hour)).toEqual([1]);
  });

  it('keeps the latest pacing, reach and alert decision of each key', () => {
    const pacing = (spentToDate: number) => ({
      scopeKind: 'INSERTION_ORDER' as const,
      scopeId: 'io1',
      date: '2026-10-28',
      segmentId: 's1',
      segmentBudget: 100,
      spentToDate,
      dailyTarget: 10,
      pacingPct: 1,
      budgetRemaining: 100 - spentToDate,
      projected: null,
      budgetAtRisk: null,
      underpacing: false,
    });
    const reach = (impressionReach: number) => ({
      lineItemId: 'li1',
      date: '2026-10-28',
      impressionReach,
      avgFrequency: 1,
      pool: 100,
    });
    const alert = (action: 'RAISE' | 'RESOLVE') =>
      ({
        code: 'NO_SPEND_LI',
        scopeKind: 'LINE_ITEM',
        scopeId: 'li1',
        action,
      }) as unknown as TickOutput['alerts'][number];
    const merged = mergeOutputs([
      tick(0, { pacing: [pacing(1)], reach: [reach(10)], alerts: [alert('RAISE')] }),
      tick(1, { pacing: [pacing(2)], reach: [reach(20)], alerts: [alert('RESOLVE')] }),
    ]);
    expect(merged?.pacing.map((p) => p.spentToDate)).toEqual([2]);
    expect(merged?.reach.map((r) => r.impressionReach)).toEqual([20]);
    expect(merged?.alerts.map((a) => a.action)).toEqual(['RESOLVE']);
  });
});
