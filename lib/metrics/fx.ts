// Currency conversion at read time (RC-025, data-model header "Money"). `FxRate` is a global, fixed table: the rate
// for a pair is the row with the latest `validFrom` not after `asOf`. Lookups try the direct pair, the inverse, and a
// cross through USD.
import type { Tx } from '@/lib/db';

export class FxRateMissingError extends Error {
  constructor(
    readonly from: string,
    readonly to: string,
  ) {
    super(`No FxRate for ${from} to ${to}`);
    this.name = 'FxRateMissingError';
  }
}

export type FxTable = Map<string, number>; // "FROM>TO" -> rate

/** One query: the latest rate per pair as of `asOf`. */
export async function loadFxTable(tx: Tx, asOf: Date = new Date()): Promise<FxTable> {
  const rows = await tx.fxRate.findMany({
    where: { validFrom: { lte: asOf } },
    orderBy: { validFrom: 'asc' },
    select: { fromCurrency: true, toCurrency: true, rate: true },
  });
  const table: FxTable = new Map();
  for (const r of rows) table.set(`${r.fromCurrency}>${r.toCurrency}`, Number(r.rate)); // later rows win
  return table;
}

function direct(table: FxTable, from: string, to: string): number | null {
  const d = table.get(`${from}>${to}`);
  if (d !== undefined) return d;
  const inv = table.get(`${to}>${from}`);
  return inv ? 1 / inv : null;
}

/** Multiplier from `from` to `to`; throws `FxRateMissingError` when no path exists. */
export function fxRate(table: FxTable, from: string, to: string): number {
  if (from === to) return 1;
  const d = direct(table, from, to);
  if (d !== null) return d;
  const a = direct(table, from, 'USD');
  const b = direct(table, 'USD', to);
  if (a !== null && b !== null) return a * b;
  throw new FxRateMissingError(from, to);
}
