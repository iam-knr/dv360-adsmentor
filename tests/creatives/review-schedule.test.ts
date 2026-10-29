// Review plan: deterministic, delays within bounds, random disapproval converges to the rate (module 12 6.3).
import { describe, expect, it } from 'vitest';
import {
  appealSchedule,
  approvedByText,
  countExchanges,
  exchangeStatusText,
  hash01,
  HOUR_MS,
  reviewSchedule,
  shownDv360Review,
} from '@/lib/creatives/review';

const NOW = new Date('2026-10-28T06:00:00Z');
const base = {
  sandboxSeed: 'sb:1',
  creativeId: 'cr1',
  simNow: NOW,
  exchangeIds: ['a', 'b', 'c'],
  thirdParty: true,
};

describe('reviewSchedule', () => {
  it('is deterministic for a fixed seed', () => {
    expect(reviewSchedule(base)).toEqual(reviewSchedule(base));
    expect(reviewSchedule({ ...base, creativeId: 'cr2' })).not.toEqual(reviewSchedule(base));
  });
  it('decides DV360 in 1 to 3 hours and exchanges in 2 to 12, never before DV360', () => {
    for (let i = 0; i < 300; i++) {
      const plan = reviewSchedule({ ...base, creativeId: `c${i}` });
      const dv = (plan.dv360DecideAt.getTime() - NOW.getTime()) / HOUR_MS;
      expect(dv).toBeGreaterThanOrEqual(1);
      expect(dv).toBeLessThanOrEqual(3);
      for (const e of plan.exchanges) {
        const h = (e.decideAt.getTime() - NOW.getTime()) / HOUR_MS;
        expect(h).toBeGreaterThanOrEqual(2);
        expect(h).toBeLessThanOrEqual(12);
        expect(e.decideAt.getTime()).toBeGreaterThanOrEqual(plan.dv360DecideAt.getTime());
      }
    }
  });
  it('disapproves about 3 percent of third-party tags and none at rate 0', () => {
    let bad = 0;
    for (let i = 0; i < 10_000; i++)
      if (reviewSchedule({ ...base, creativeId: `cr-${i}` }).verdict === 'NOT_SERVABLE') bad++;
    expect(Math.abs(bad / 10_000 - 0.03)).toBeLessThan(0.005);
    for (let i = 0; i < 2_000; i++)
      expect(reviewSchedule({ ...base, creativeId: `cr-${i}`, disapproveRate: 0 }).verdict).toBe(
        'SERVABLE',
      );
  });
  it('never disapproves uploaded creatives at random, and honours a forced verdict', () => {
    for (let i = 0; i < 2_000; i++)
      expect(
        reviewSchedule({ ...base, creativeId: `cr-${i}`, thirdParty: false, disapproveRate: 1 })
          .verdict,
      ).toBe('SERVABLE');
    expect(reviewSchedule({ ...base, force: 'NOT_SERVABLE' }).reason).toBe('POLICY_DESTINATION');
  });
  it('hash01 spreads into [0, 1)', () => {
    const values = Array.from({ length: 1000 }, (_, i) => hash01('x', String(i)));
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...values)).toBeLessThan(1);
    expect(new Set(values).size).toBeGreaterThan(990);
  });
});

describe('appealSchedule', () => {
  it('decides in 12 to 36 sim hours, accepts about three in four, deterministic', () => {
    let accepted = 0;
    for (let i = 0; i < 2000; i++) {
      const p = appealSchedule('s', `c${i}`, 'ex', 0, NOW);
      const h = (p.decideAt.getTime() - NOW.getTime()) / HOUR_MS;
      expect(h).toBeGreaterThanOrEqual(12);
      expect(h).toBeLessThanOrEqual(36);
      if (p.accepted) accepted++;
    }
    expect(Math.abs(accepted / 2000 - 0.75)).toBeLessThan(0.04);
    expect(appealSchedule('s', 'c', 'e', 1, NOW)).toEqual(appealSchedule('s', 'c', 'e', 1, NOW));
  });
});

describe('display strings', () => {
  it('Servable (n of m), Not servable and the approval summary', () => {
    expect(exchangeStatusText(countExchanges(['APPROVED', 'DISAPPROVED']))).toBe(
      'Servable (1 of 2)',
    );
    expect(exchangeStatusText(countExchanges(['DISAPPROVED', 'PENDING']))).toBe(
      'Not servable (0 of 2)',
    );
    expect(exchangeStatusText(countExchanges([]))).toBe('-');
    expect(approvedByText({ servable: 1, total: 2 })).toBe('Approved by 1 of 2 exchanges');
  });
  it('a verdict that is not due yet reads Pending', () => {
    const later = new Date(NOW.getTime() + HOUR_MS);
    expect(shownDv360Review('NOT_SERVABLE', later, NOW)).toBe('PENDING');
    expect(shownDv360Review('NOT_SERVABLE', later, new Date(later.getTime() + 1))).toBe(
      'NOT_SERVABLE',
    );
    expect(shownDv360Review('SERVABLE', later, NOW)).toBe('PENDING');
    expect(shownDv360Review('SERVABLE', null, NOW)).toBe('SERVABLE');
  });
});
