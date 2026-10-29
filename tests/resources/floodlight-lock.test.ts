// FL-032: Platform, Format and Type are locked after the conversion is created.
import { describe, expect, it } from 'vitest';
import { MSG, validate } from '@/lib/validation';
import { resourceCtx, validConversion } from './fixtures';

const stored = { platform: 'WEB', format: 'GOOGLE_TAG', type: 'COUNTER' } as const;
const edit = resourceCtx({ mode: 'edit' });
const fl032 = (over: Parameters<typeof validConversion>[0]) =>
  validate('floodlightConversion', { ...validConversion(over), stored }, edit).filter(
    (i) => i.ruleId === 'FL-032',
  );

describe('FL-032 locked fields', () => {
  it('passes when nothing locked changed', () => {
    expect(fl032({ name: 'Renamed' })).toEqual([]);
  });

  it.each([
    [
      { platform: 'MOBILE_APP' as const, appId: 'com.example.app.one', conversionEventName: 'x' },
      'platform',
    ],
    [{ format: 'IFRAME_TAG' as const }, 'format'],
    [{ type: 'SALE' as const, countingMethod: 'TRANSACTIONS' }, 'type'],
  ])('rejects a change of %j', (over, path) => {
    const issues = fl032(over);
    expect(issues.map((i) => i.path)).toContain(path);
    expect(issues[0]?.message).toBe(MSG.LOCKED_AFTER_CREATE);
  });

  it('does not apply on create', () => {
    expect(
      validate(
        'floodlightConversion',
        { ...validConversion({ format: 'IFRAME_TAG' }), stored },
        resourceCtx(),
      ).filter((i) => i.ruleId === 'FL-032'),
    ).toEqual([]);
  });
});
