// Money helpers (RC-019): DB holds Decimal in major units, the wire uses major units,
// validation rules receive integer minor units. Convert once at the service boundary.

export type CurrencyCode = 'INR' | 'SGD' | 'USD' | 'EUR' | 'GBP' | 'AUD' | 'JPY';

const MINOR_DIGITS: Record<CurrencyCode, number> = {
  INR: 2,
  SGD: 2,
  USD: 2,
  EUR: 2,
  GBP: 2,
  AUD: 2,
  JPY: 0,
};

const LOCALE: Record<CurrencyCode, string> = {
  // Real DV360 shows rupees with Western grouping ("₹12,000.00"), not lakh grouping (CAM-015).
  INR: 'en-US',
  SGD: 'en-SG',
  USD: 'en-US',
  EUR: 'en-IE',
  GBP: 'en-GB',
  AUD: 'en-AU',
  JPY: 'ja-JP',
};

function digits(currency: CurrencyCode): number {
  return MINOR_DIGITS[currency];
}

/** Major units (12.34) to integer minor units (1234). Half rounds away from zero. */
export function toMinor(amount: number | string, currency: CurrencyCode): number {
  const n = typeof amount === 'string' ? Number(amount) : amount;
  if (!Number.isFinite(n)) throw new Error(`Invalid money amount: ${String(amount)}`);
  const scaled = Number((Math.abs(n) * 10 ** digits(currency)).toPrecision(15));
  const rounded = Math.round(scaled);
  return n < 0 ? -rounded : rounded;
}

/** Integer minor units back to major units. */
export function fromMinor(minor: number, currency: CurrencyCode): number {
  if (!Number.isInteger(minor)) throw new Error(`Minor units must be an integer: ${minor}`);
  return minor / 10 ** digits(currency);
}

/** Display string such as "₹123,456.50" (INR) or "$1,234.50" (SGD). */
export function format(amount: number, currency: CurrencyCode): string {
  const d = digits(currency);
  return new Intl.NumberFormat(LOCALE[currency], {
    style: 'currency',
    currency,
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  }).format(amount);
}

const CODES = Object.keys(MINOR_DIGITS) as CurrencyCode[];
const SYMBOL_TO_CODE: Record<string, CurrencyCode> = { '₹': 'INR' };

/** True when the string is one of the currencies the simulator knows. */
export function isCurrencyCode(code: string | null | undefined): code is CurrencyCode {
  return !!code && (CODES as string[]).includes(code);
}

/**
 * The one display formatter for money amounts everywhere in the UI (Q18).
 * Accepts a currency code or the rupee sign; INR always renders as "₹123,456.50".
 * Unknown codes fall back to "<CODE> 1,234.50".
 */
export function formatMoney(amount: number | null | undefined, currency: string | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return '-';
  const code = currency ? (SYMBOL_TO_CODE[currency] ?? currency) : 'INR';
  if (isCurrencyCode(code)) return format(amount, code);
  return `${code} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
