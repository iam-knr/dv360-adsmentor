import { describe, expect, it } from 'vitest';
import { formatFitsLineItem } from '@/lib/inventory/format-compat';

describe('package format vs line item type (Δ13-12)', () => {
  it.each([
    ['DISPLAY', 'DISPLAY', true],
    ['DISPLAY', 'ADS_IN_MOBILE_APPS', true],
    ['DISPLAY', 'VIDEO', false],
    ['VIDEO', 'VIDEO', true],
    ['VIDEO', 'CTV', true],
    ['VIDEO', 'ADS_IN_MOBILE_APPS', true],
    ['VIDEO', 'DISPLAY', false],
    ['VIDEO', 'AUDIO', false],
    ['AUDIO', 'AUDIO', true],
    ['AUDIO', 'VIDEO', false],
    ['AUDIO', 'YT_AUDIO', false],
  ] as const)('%s package on %s line item: %s', (format, type, fits) => {
    expect(formatFitsLineItem(format, type)).toBe(fits);
  });
});
