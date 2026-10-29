// Custom bidding score model, sampler and Test step (module 15 4.3, engine.md 4.3).
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MIX,
  MIN_MATCHED_PCT,
  TEST_SAMPLE_SIZE,
  errorPctFor,
  runTest,
  sampleImpressions,
  scoreImpression,
  signalAllowed,
  signalOf,
  type CbModel,
  type SampleImpression,
} from '@/lib/engine/bidding/customBidding';

const imp = (over: Partial<SampleImpression> = {}): SampleImpression => ({
  format: 'DISPLAY',
  signals: { CLICKED: true, VIEWABLE: false },
  attrs: { DEVICE_TYPE: 'SMARTPHONE', DAY_AND_TIME: 'WEEKEND_EVENING' },
  ...over,
});

const clicks: CbModel = {
  rules: [{ groupKey: 'Click rules', signalKey: 'CLICKED', value: true, score: 2 }],
  multipliers: [],
};

describe('scoreImpression', () => {
  it('sums the scores of matched rules', () => {
    const model: CbModel = {
      rules: [
        { groupKey: 'Click rules', signalKey: 'CLICKED', value: true, score: 2 },
        { groupKey: 'Viewability rules', signalKey: 'VIEWABLE', value: false, score: 3 },
      ],
      multipliers: [],
    };
    expect(scoreImpression(model, imp())).toBe(5);
  });

  it('is 0 when no rule matches, whatever the multipliers', () => {
    const model: CbModel = {
      ...clicks,
      multipliers: [{ kind: 'DEVICE_TYPE', values: [{ valueKey: 'SMARTPHONE', multiplier: 9 }] }],
    };
    expect(scoreImpression(model, imp({ signals: { CLICKED: false } }))).toBe(0);
  });

  it('multiplies by the factor of each multiplier the impression falls in', () => {
    const model: CbModel = {
      ...clicks,
      multipliers: [
        { kind: 'DEVICE_TYPE', values: [{ valueKey: 'SMARTPHONE', multiplier: 1.5 }] },
        { kind: 'DAY_AND_TIME', values: [{ valueKey: 'WEEKEND_EVENING', multiplier: 2 }] },
      ],
    };
    expect(scoreImpression(model, imp())).toBeCloseTo(2 * 1.5 * 2, 10);
  });

  it('ignores a signal the format does not carry', () => {
    const model: CbModel = {
      rules: [{ groupKey: 'Video rules', signalKey: 'VIDEO_COMPLETED', value: true, score: 4 }],
      multipliers: [],
    };
    expect(scoreImpression(model, imp())).toBe(0);
  });
});

describe('catalogue', () => {
  it('offers each objective only its own signals; activities need a conversion objective', () => {
    expect(signalAllowed('CLICKS', 'CLICKED')).toBe(true);
    expect(signalAllowed('CLICKS', 'VIEWABLE')).toBe(false);
    expect(signalAllowed('BRAND_AWARENESS', 'VIDEO_COMPLETED')).toBe(true);
    expect(signalAllowed('CONVERSIONS', 'ACTIVITY:abc')).toBe(true);
    expect(signalAllowed('CLICKS', 'ACTIVITY:abc')).toBe(false);
    expect(signalAllowed('CUSTOM', 'CLICKED')).toBe(true);
    expect(signalOf('NOPE')).toBeNull();
  });
});

describe('sampleImpressions', () => {
  it('is deterministic for the same seed and differs for another', () => {
    const a = sampleImpressions(DEFAULT_MIX, 200, 'seed-1');
    expect(sampleImpressions(DEFAULT_MIX, 200, 'seed-1')).toEqual(a);
    expect(sampleImpressions(DEFAULT_MIX, 200, 'seed-2')).not.toEqual(a);
  });

  it('follows the format mix and only carries attributes the format has', () => {
    const displayOnly = sampleImpressions(
      { formatWeights: { DISPLAY: 1, VIDEO: 0, AUDIO: 0 }, activityIds: [] },
      300,
      's',
    );
    expect(displayOnly.every((i) => i.format === 'DISPLAY')).toBe(true);
    expect(displayOnly.every((i) => i.attrs.GENRE === undefined)).toBe(true);
    expect(displayOnly.every((i) => i.attrs.CREATIVE_DIMENSION !== undefined)).toBe(true);
  });

  it('adds one signal per Floodlight activity', () => {
    const [first] = sampleImpressions({ ...DEFAULT_MIX, activityIds: ['a1', 'a2'] }, 1, 's');
    expect(Object.keys(first!.signals)).toEqual(
      expect.arrayContaining(['ACTIVITY:a1', 'ACTIVITY:a2']),
    );
  });
});

describe('runTest', () => {
  const viewable: CbModel = {
    rules: [{ groupKey: 'Viewability rules', signalKey: 'VIEWABLE', value: true, score: 1 }],
    multipliers: [{ kind: 'DEVICE_TYPE', values: [{ valueKey: 'SMARTPHONE', multiplier: 2 }] }],
  };

  it('is deterministic and reports a histogram of 20 bins', () => {
    const a = runTest(viewable, DEFAULT_MIX, 'alg:1');
    expect(runTest(viewable, DEFAULT_MIX, 'alg:1')).toEqual(a);
    expect(a.sampleSize).toBe(TEST_SAMPLE_SIZE);
    expect(a.histogram).toHaveLength(20);
    expect(a.histogram.reduce((s, n) => s + n, 0)).toBeGreaterThan(0);
    expect(a.matchedPct).toBeGreaterThanOrEqual(MIN_MATCHED_PCT);
    expect(a.passed).toBe(true);
  });

  it('fails hard when no rule matches any impression', () => {
    const none: CbModel = {
      rules: [
        {
          groupKey: 'Video rules',
          signalKey: 'AUDIBLE_AND_VIEWABLE_AT_COMPLETION',
          value: true,
          score: 1,
        },
      ],
      multipliers: [],
    };
    const r = runTest(
      none,
      { formatWeights: { DISPLAY: 1, VIDEO: 0, AUDIO: 0 }, activityIds: [] },
      's',
    );
    expect(r.matchedPct).toBe(0);
    expect(r.passed).toBe(false);
    expect(r.warnings.some((w) => w.kind === 'HARD')).toBe(true);
  });

  it('fails hard when a multiplier exists for none of the formats and warns softly for some', () => {
    const genre: CbModel = {
      ...viewable,
      multipliers: [{ kind: 'GENRE', values: [{ valueKey: 'DRAMA', multiplier: 2 }] }],
    };
    const displayOnly = { formatWeights: { DISPLAY: 1, VIDEO: 0, AUDIO: 0 }, activityIds: [] };
    expect(runTest(genre, displayOnly, 's').warnings.some((w) => w.kind === 'HARD')).toBe(true);
    const soft = runTest(genre, DEFAULT_MIX, 's');
    expect(soft.warnings.some((w) => w.kind === 'SOFT')).toBe(true);
    expect(soft.warnings.some((w) => w.kind === 'HARD')).toBe(false);
  });

  it('needs at least 2% of the sample matched to pass', () => {
    const rare: CbModel = {
      rules: [
        { groupKey: 'Conversion rules', signalKey: 'CONVERTED_POST_CLICK', value: true, score: 1 },
      ],
      multipliers: [],
    };
    const r = runTest(rare, DEFAULT_MIX, 's');
    expect(r.matchedPct).toBeLessThan(MIN_MATCHED_PCT);
    expect(r.passed).toBe(false);
  });
});

describe('errorPctFor', () => {
  it('adds 20 % of the base when a multiplier signal is unavailable for a format in the mix', () => {
    const genre: CbModel = {
      rules: [],
      multipliers: [{ kind: 'GENRE', values: [{ valueKey: 'DRAMA', multiplier: 2 }] }],
    };
    expect(errorPctFor({ rules: [], multipliers: [] }, DEFAULT_MIX, 0.5)).toBe(0.5);
    expect(errorPctFor(genre, DEFAULT_MIX, 0.5)).toBe(0.6);
  });
});
