// Instant deal forecast (module 13 4.1 `InstantDealForecast`, engine 5.5, RC-026). Pure and deterministic: the same
// payload and seed give the same numbers, and narrower targeting gives a lower p50. The engine does not expose
// `instantDealForecast` yet, so this is the simulator's stand-in with the same output shape.
import { hashString } from '../seed/prng';

export interface ForecastInput {
  sellerId: string;
  /** Seller's 7-day impressions at "All values" and its floor CPM, from the MarketplaceProduct row. */
  sellerImpressions7d: number;
  floorCpm: number;
  /** Dimension → chosen values; empty = All values. */
  targeting: Record<string, string[]>;
  /** Dimension → number of values the seller offers (to size a narrowing). */
  optionCounts: Record<string, number>;
  seed: number;
}

export interface InstantDealForecast {
  impressions7d: { p10: number; p50: number; p90: number };
  recommendedMinBid: number;
  estimatedMediaCost: number;
  floorCpm: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Share of the seller's supply that survives the targeting: each narrowed dimension keeps (chosen / offered)^0.6. */
export function targetingShare(
  targeting: Record<string, string[]>,
  optionCounts: Record<string, number>,
): number {
  let share = 1;
  for (const [dim, values] of Object.entries(targeting)) {
    if (values.length === 0) continue;
    const offered = Math.max(values.length, optionCounts[dim] ?? values.length * 4);
    share *= Math.pow(values.length / offered, 0.6);
  }
  return Math.max(share, 0.001);
}

export function forecastInstantDeal(input: ForecastInput): InstantDealForecast {
  const key = JSON.stringify([input.sellerId, sortedTargeting(input.targeting), input.seed]);
  // ±6 % deterministic wobble so two sellers with the same share do not look alike
  const wobble = 0.94 + (hashString(key) % 1200) / 10000;
  const p50 = Math.max(
    1000,
    Math.round(
      (input.sellerImpressions7d * targetingShare(input.targeting, input.optionCounts) * wobble) /
        1000,
    ) * 1000,
  );
  const p10 = Math.round((p50 * 0.62) / 1000) * 1000;
  const p90 = Math.round((p50 * 1.48) / 1000) * 1000;
  const recommendedMinBid = round2(input.floorCpm * 1.3);
  return {
    impressions7d: { p10, p50, p90 },
    recommendedMinBid,
    estimatedMediaCost: round2((p50 / 1000) * recommendedMinBid),
    floorCpm: round2(input.floorCpm),
  };
}

function sortedTargeting(t: Record<string, string[]>): [string, string[]][] {
  return Object.entries(t)
    .filter(([, v]) => v.length)
    .map(([k, v]): [string, string[]] => [k, [...v].sort()])
    .sort(([a], [b]) => a.localeCompare(b));
}

// ---- forecast token (INV-006): proves a forecast was requested for this payload within 30 real minutes ----

const TOKEN_TTL_MS = 30 * 60_000;

export interface TokenPayload {
  sellerId: string;
  name: string;
  targeting: Record<string, string[]>;
  advertiserIds: string[];
}

export function payloadHash(p: TokenPayload): string {
  const key = JSON.stringify([
    p.sellerId,
    p.name.trim(),
    sortedTargeting(p.targeting),
    [...p.advertiserIds].sort(),
  ]);
  return hashString(key).toString(36) + hashString(`${key}#`).toString(36);
}

export const issueForecastToken = (p: TokenPayload, nowMs: number): string =>
  `${payloadHash(p)}.${nowMs.toString(36)}`;

export function forecastTokenValid(
  token: string | null | undefined,
  p: TokenPayload,
  nowMs: number,
): boolean {
  if (!token) return false;
  const [hash, issued] = token.split('.');
  if (!hash || !issued) return false;
  const at = parseInt(issued, 36);
  return (
    hash === payloadHash(p) &&
    Number.isFinite(at) &&
    nowMs - at <= TOKEN_TTL_MS &&
    nowMs >= at - 1000
  );
}
