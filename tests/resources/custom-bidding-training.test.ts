// Custom bidding readiness (module 15 5, engine.md 4.3): readiness = min(1, trainingImpressions / 5000).
import { describe, expect, it } from 'vitest';
import { nextTraining, readinessPct } from '@/lib/resources/custom-bidding-training';

describe('readiness curve', () => {
  it.each([
    [0, 0],
    [1749, 34],
    [1750, 35],
    [4999, 99],
    [5000, 100],
    [60000, 100],
  ])('%i training impressions give %i %', (n, pct) => {
    expect(readinessPct(n)).toBe(pct);
  });
});

describe('nextTraining', () => {
  it('stays TRAINING below 100 % and becomes ACTIVE and READY at 100 %', () => {
    const a = nextTraining({ trainingImpressions: 1750, status: 'TRAINING' }, 1000);
    expect(a).toMatchObject({ readinessPct: 55, status: 'TRAINING', modelReadiness: 'TRAINING' });
    const b = nextTraining({ trainingImpressions: 4900, status: 'TRAINING' }, 200);
    expect(b).toMatchObject({ readinessPct: 100, status: 'ACTIVE', modelReadiness: 'READY' });
  });

  it('a suspended algorithm keeps training but stays suspended', () => {
    expect(nextTraining({ trainingImpressions: 4900, status: 'SUSPENDED' }, 200)).toMatchObject({
      readinessPct: 100,
      status: 'SUSPENDED',
    });
  });

  it('is NOT_READY with no impressions at all', () => {
    expect(nextTraining({ trainingImpressions: 0, status: 'TRAINING' }, 0).modelReadiness).toBe(
      'NOT_READY',
    );
  });
});
