// Deterministic seller policy for negotiations (module 13 4.3, Δ13-14). Pure. Spec wording is
// `advanceNegotiations(world, tick, params)` in the engine; the engine is owned by another session, so the services
// call this module whenever a negotiation is read or acted on, using the simulated clock (RC-026).
import { INV_MSG } from './messages';

export interface SellerPolicy {
  minRate: number;
  maxVolume: number;
  maxRounds: number;
  replyDelayHours: number;
}

export const DEFAULT_POLICY: SellerPolicy = {
  minRate: 0,
  maxVolume: Number.MAX_SAFE_INTEGER,
  maxRounds: 3,
  replyDelayHours: 12,
};

export function parsePolicy(raw: unknown): SellerPolicy {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Partial<SellerPolicy>;
  const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
  return {
    minRate: num(o.minRate, DEFAULT_POLICY.minRate),
    maxVolume: num(o.maxVolume, DEFAULT_POLICY.maxVolume),
    maxRounds: num(o.maxRounds, DEFAULT_POLICY.maxRounds),
    replyDelayHours: Math.min(24, Math.max(6, num(o.replyDelayHours, DEFAULT_POLICY.replyDelayHours))),
  };
}

export interface Proposal {
  rate: number;
  volume: number | null;
}

export type SellerDecision =
  | { kind: 'ACCEPT'; rate: number; volume: number | null; body: string }
  | { kind: 'COUNTER'; rate: number; volume: number | null; final: boolean; body: string }
  | { kind: 'DECLINE'; body: string };

const cents = (n: number) => Math.round(n * 100) / 100;

/**
 * The seller's answer to a buyer counter.
 * - rate at or above `minRate`: accept (volume is capped at `maxVolume`, which counts as a counter instead)
 * - otherwise counter at the midpoint between the seller's last rate and the buyer's rate, never below `minRate`
 * - the counter that answers the last allowed round is a final offer at `minRate`
 * - a counter beyond `maxRounds` (INV-034 blocks it in the UI) is declined
 * `round` is the number of buyer counters made so far, including this one.
 */
export function decideSellerReply(
  policy: SellerPolicy,
  proposal: Proposal,
  sellerRate: number,
  round: number,
): SellerDecision {
  if (round > policy.maxRounds) {
    return { kind: 'DECLINE', body: 'We are not able to move further on this proposal, so we are closing it.' };
  }
  const volume =
    proposal.volume === null ? null : Math.min(proposal.volume, policy.maxVolume);
  const volumeCapped = proposal.volume !== null && volume !== proposal.volume;
  if (proposal.rate >= policy.minRate && !volumeCapped) {
    return {
      kind: 'ACCEPT',
      rate: cents(proposal.rate),
      volume,
      body: 'Your terms work for us. We accept this proposal.',
    };
  }
  const final = round >= policy.maxRounds;
  const rate = final
    ? cents(policy.minRate)
    : cents(Math.max(policy.minRate, (sellerRate + proposal.rate) / 2));
  return {
    kind: 'COUNTER',
    rate,
    volume,
    final,
    body: final
      ? `This is our final offer: ${rate.toFixed(2)} CPM. Please accept or decline.`
      : `We can meet you at ${rate.toFixed(2)} CPM${volumeCapped ? ` for up to ${volume} impressions` : ''}.`,
  };
}

export interface NegotiationState {
  status: string;
  awaiting: string;
  round: number;
  replyAt: Date | null;
  expiresAt: Date | null;
  /** Seller's current rate (terms.rate). */
  sellerRate: number;
  /** The buyer's last proposal. */
  proposal: Proposal | null;
  policy: SellerPolicy;
}

export type Advance =
  | { kind: 'NONE' }
  | { kind: 'EXPIRE' }
  | { kind: 'REPLY'; decision: SellerDecision };

/** What happens to a negotiation at `simNow`. Replies are due at `replyAt`; open negotiations expire at `expiresAt`. */
export function advanceNegotiation(n: NegotiationState, simNow: Date): Advance {
  const open = n.status === 'PROPOSED' || n.status === 'COUNTERED';
  if (!open) return { kind: 'NONE' };
  if (n.awaiting === 'SELLER' && n.replyAt && n.replyAt.getTime() <= simNow.getTime() && n.proposal) {
    return { kind: 'REPLY', decision: decideSellerReply(n.policy, n.proposal, n.sellerRate, n.round) };
  }
  if (n.expiresAt && n.expiresAt.getTime() <= simNow.getTime()) return { kind: 'EXPIRE' };
  return { kind: 'NONE' };
}

export const NEGOTIATION_FINAL_TEXT = INV_MSG.FINAL_OFFER;
