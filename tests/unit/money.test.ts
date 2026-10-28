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

  it('formats INR with Indian grouping', () => {
    expect(format(123456.5, 'INR')).toBe('₹1,23,456.50');
  });

  it('formats SGD', () => {
    expect(format(1234.5, 'SGD')).toBe('$1,234.50');
  });
});
