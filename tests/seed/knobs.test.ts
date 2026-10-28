import { describe, expect, it } from 'vitest';
import {
  DELIVERY_STORIES,
  KNOB_LIMITS,
  KnobError,
  PLANTED_PROBLEMS,
  TEMPLATE_DEFAULTS,
  TEMPLATE_KEYS,
  resolveKnobs,
} from '@/lib/seed/knobs';
import { planFor } from './fixtures';

describe('size knobs (data-model 3.4)', () => {
  it('resolves defaults for the three templates', () => {
    for (const key of TEMPLATE_KEYS) {
      const k = resolveKnobs(key);
      expect(k.advertisers).toBe(2);
      expect(k.historyDays).toBe(90);
      expect(k.hourlyDays).toBe(14);
    }
    expect(resolveKnobs('healthy').plantedProblems).toEqual(['healthy']);
    expect(resolveKnobs('troubleshooting-lab').plantedProblems).toEqual([...PLANTED_PROBLEMS]);
    for (const story of DELIVERY_STORIES)
      expect(resolveKnobs('starter-agency').plantedProblems).toContain(story);
  });

  it('does not share arrays between calls', () => {
    const a = resolveKnobs('starter-agency');
    a.plantedProblems.push('audience-too-small');
    expect(TEMPLATE_DEFAULTS['starter-agency'].plantedProblems).not.toContain('audience-too-small');
  });

  it('applies overrides', () => {
    const k = resolveKnobs('starter-agency', {
      advertisers: 1,
      campaignsPerAdvertiser: 2,
      plantedProblems: ['healthy', 'bid-too-low'],
    });
    expect(k).toMatchObject({
      advertisers: 1,
      campaignsPerAdvertiser: 2,
      plantedProblems: ['healthy', 'bid-too-low'],
    });
  });

  it('rejects out of range, fractional and unknown values', () => {
    expect(() => resolveKnobs('healthy', { advertisers: 0 })).toThrow(KnobError);
    expect(() => resolveKnobs('healthy', { advertisers: KNOB_LIMITS.advertisers[1] + 1 })).toThrow(
      KnobError,
    );
    expect(() => resolveKnobs('healthy', { lineItemsPerIo: 2.5 })).toThrow(/integer/);
    expect(() => resolveKnobs('healthy', { hourlyDays: 15 })).toThrow(KnobError);
    expect(() => resolveKnobs('nope' as never)).toThrow(/Unknown seed template/);
    expect(() => resolveKnobs('healthy', { plantedProblems: ['made-up' as never] })).toThrow(
      /made-up/,
    );
  });

  it('keeps slices and hourly rows inside the history window', () => {
    const k = resolveKnobs('healthy', { historyDays: 10 });
    expect(k.sliceDays).toBe(10);
    expect(k.hourlyDays).toBe(10);
  });

  it('changes the size of the plan', () => {
    const small = planFor('starter-agency', 7, {
      advertisers: 1,
      campaignsPerAdvertiser: 2,
      iosPerCampaign: 1,
      lineItemsPerIo: 2,
      creativesPerAdvertiser: 8,
    });
    expect(small.advertisers).toHaveLength(1);
    expect(small.campaigns).toHaveLength(2);
    expect(small.insertionOrders).toHaveLength(2);
    expect(small.lineItems).toHaveLength(4);
    expect(small.creatives.length).toBeGreaterThanOrEqual(8);
    const big = planFor('starter-agency', 7, { advertisers: 3, lineItemsPerIo: 4 });
    expect(big.advertisers).toHaveLength(3);
    expect(big.lineItems).toHaveLength(3 * 3 * 2 * 4);
    expect(big.meta.knobs.lineItemsPerIo).toBe(4);
  });

  it('reports the stories a small layout cannot hold instead of failing', () => {
    const small = planFor('troubleshooting-lab', 7, {
      advertisers: 1,
      campaignsPerAdvertiser: 1,
      iosPerCampaign: 1,
      lineItemsPerIo: 1,
    });
    expect(small.coverageGaps.length).toBeGreaterThan(0);
    expect(small.lineItems).toHaveLength(1);
  });
});
