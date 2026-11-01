import { describe, expect, it } from 'vitest';
import { format, fromMinor, toMinor } from '@/lib/money';

describe('money', () => {
  it('converts major to minor units', () => {
    expect(toMinor(12.34, 'INR')).toBe(1234);
    expect(toMinor('0.10', 'SGD')).toBe(10);
    expect(toMinor(500, 'JPY')).toBe(500);
  });

  it('avoids float drift', () => {
    expect(toMinor(1.005, 'INR')).toBe(101);
    expect(toMinor(0.1 + 0.2, 'INR')).toBe(30);
    expect(toMinor(19.99, 'USD')).toBe(1999);
  });

  it('rounds half away from zero', () => {
    expect(toMinor(2.345, 'INR')).toBe(235);
    expect(toMinor(-2.345, 'INR')).toBe(-235);
  });

  it('converts minor to major units', () => {
    expect(fromMinor(1234, 'INR')).toBe(12.34);
    expect(fromMinor(-5, 'SGD')).toBe(-0.05);
  });

  it('rejects bad input', () => {
    expect(() => toMinor(Number.NaN, 'INR')).toThrow(/Invalid money amount/);
    expect(() => fromMinor(1.5, 'INR')).toThrow(/integer/);
  });

  it('formats INR with Western grouping like real DV360', () => {
    expect(format(123456.5, 'INR')).toBe('₹123,456.50');
    expect(format(12000, 'INR')).toBe('₹12,000.00');
  });

  it('formats SGD', () => {
    expect(format(1234.5, 'SGD')).toBe('$1,234.50');
  });
});

import { formatMoney } from '@/lib/money';
import { formatCurrency } from '@/components/dv/grid-format';
import { money as expMoney } from '@/components/experiments/format';
import { fmtMoney } from '@/lib/planning/table';

describe('Q18 one formatter per currency', () => {
  it('shows a dash for zero money in grid cells (CAM-014) but not in formatMoney', () => {
    expect(formatCurrency(0, 'INR')).toBe('-');
    expect(formatMoney(0, 'INR')).toBe('₹0.00');
  });
  it('renders INR identically everywhere (rupee sign, Western grouping)', () => {
    const want = '₹1,102,900.00';
    expect(formatMoney(1102900, 'INR')).toBe(want);
    expect(formatMoney(1102900, '₹')).toBe(want);
    expect(formatCurrency(1102900, 'INR')).toBe(want);
    expect(formatCurrency(1102900, '₹')).toBe(want);
    expect(expMoney(1102900, 'INR')).toBe(want);
    expect(fmtMoney(1102900, 'INR')).toBe(want);
  });
  it('dashes for missing values and falls back for unknown codes', () => {
    expect(formatMoney(null, 'INR')).toBe('-');
    expect(formatMoney(1234.5, 'XYZ')).toBe('XYZ 1,234.50');
  });
});
