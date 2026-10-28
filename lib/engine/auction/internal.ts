// Own line items competing in the internal auction (engine.md 5.3).

export interface OwnEntry {
  liId: string;
  bid: number;
  /** Share of the cell's requests the line item bids on (S / A). */
  bidRate: number;
}

/**
 * Probability that line item `liId` is not outbid by another line item of the same advertiser on
 * the same request. Higher bids win; equal bids split the overlap evenly.
 */
export function ownPass(
  entries: readonly OwnEntry[] | undefined,
  liId: string,
  bid: number,
): number {
  if (!entries) return 1;
  let pass = 1;
  for (const e of entries) {
    if (e.liId === liId) continue;
    if (e.bid > bid) pass *= 1 - clamp01(e.bidRate);
    else if (e.bid === bid) pass *= 1 - clamp01(e.bidRate) / 2;
  }
  return pass;
}

const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
