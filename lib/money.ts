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
  INR: 'en-IN',
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

/** Display string such as "₹1,23,456.50" (INR) or "$1,234.50" (SGD). */
export function format(amount: number, currency: CurrencyCode): string {
  const d = digits(currency);
  return new Intl.NumberFormat(LOCALE[currency], {
    style: 'currency',
    currency,
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  }).format(amount);
}
