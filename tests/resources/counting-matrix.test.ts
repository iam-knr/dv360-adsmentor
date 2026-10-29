// MX-08: counting method by Floodlight type, as enforced by FL-014.
import { describe, expect, it } from 'vitest';
import { validate } from '@/lib/validation';
import {
  COUNTING_METHODS_BY_ACTIVITY,
  FLOODLIGHT_COUNTING_METHODS,
} from '@/lib/validation/constants/conversions';
import { validConversion, resourceCtx } from './fixtures';

describe('counting method grid', () => {
  const grid: ['COUNTER' | 'SALE', string, boolean][] = [];
  for (const type of ['COUNTER', 'SALE'] as const)
    for (const method of FLOODLIGHT_COUNTING_METHODS)
      grid.push([
        type,
        method,
        (COUNTING_METHODS_BY_ACTIVITY[type] as readonly string[]).includes(method),
      ]);

  it.each(grid)('%s + %s allowed=%s', (type, method, allowed) => {
    const issues = validate(
      'floodlightConversion',
      validConversion({ type, countingMethod: method }),
      resourceCtx(),
    );
    expect(issues.some((i) => i.ruleId === 'FL-014')).toBe(!allowed);
  });
});
