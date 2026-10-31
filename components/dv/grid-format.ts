/** Cell formats of design-system 2.4. en-US separators with the advertiser currency symbol (Q10). */

import { formatMoney } from '@/lib/money';

export const EMPTY_CELL = '-';

const int = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const two = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

function missing(n: number | null | undefined): n is null | undefined {
  return n === null || n === undefined || Number.isNaN(n);
}

/** Counts with thousands separators: 1,234,567. */
export function formatNumber(n: number | null | undefined): string {
  return missing(n) ? EMPTY_CELL : int.format(n);
}

/** "₹12,000.00". */
export function formatCurrency(n: number | null | undefined, symbol = '₹'): string {
  if (missing(n)) return EMPTY_CELL;
  return formatMoney(n, symbol);
}

/** Compact currency for cards: "₹450K". */
export function formatCurrencyCompact(n: number | null | undefined, symbol = '₹'): string {
  if (missing(n)) return EMPTY_CELL;
  return `${n < 0 ? '-' : ''}${symbol}${compact.format(Math.abs(n))}`;
}

/** "12.34%". Input is already a percentage value (12.34, not 0.1234). */
export function formatPercent(n: number | null | undefined): string {
  return missing(n) ? EMPTY_CELL : `${two.format(n)}%`;
}
