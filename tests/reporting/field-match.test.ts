import { describe, expect, it } from 'vitest';
import { FIELDS } from '@/lib/reporting/catalogue';
import { nearestFields, resolveField, unknownFieldMessage } from '@/lib/reporting/field-match';

describe('Q10 report field names', () => {
  it('resolves an exact label ignoring case and punctuation', () => {
    const f = resolveField('total media cost (advertiser currency)', FIELDS, 'METRIC');
    expect(f?.label).toBe('Total Media Cost (Advertiser Currency)');
  });
  it('does not guess for a partial name, it suggests the real ones', () => {
    expect(resolveField('Total Media Cost', FIELDS, 'METRIC')).toBeUndefined();
    const near = nearestFields(
      'Total Media Cost',
      FIELDS.filter((f) => f.kind === 'METRIC'),
    );
    expect(near.map((f) => f.label)).toContain('Total Media Cost (Advertiser Currency)');
    const msg = unknownFieldMessage(['Total Media Cost'], FIELDS, 'METRIC');
    expect(msg).toContain('Unknown fields');
    expect(msg).toContain('did you mean');
    expect(msg).toContain('Total Media Cost (Advertiser Currency)');
  });
});
