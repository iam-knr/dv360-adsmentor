// Review plan and display strings (module 12 4.5, 4.6, engine.md 3.4). Pure and deterministic: the same sandbox seed,
// creative and sim time always give the same plan, so tests and scenarios can rely on it.
import type { ReasonCode } from './feedback';

/** RC-033: `creativeReview.newTagDisapproveRate`, 0.03 in free play and 0 in scenario sandboxes. */
export const DEFAULT_NEW_TAG_DISAPPROVE_RATE = 0.03;
export const HOUR_MS = 3_600_000;

/** FNV-1a 32 bit, mapped to [0, 1). */
export function hash01(...parts: string[]): number {
  let h = 0x811c9dc5;
  for (const ch of parts.join('|')) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  // final avalanche so close inputs (cr1, cr2) spread
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d) >>> 0;
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39) >>> 0;
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

const between = (u: number, lo: number, hi: number): number => lo + Math.floor(u * (hi - lo + 1));

export interface ReviewPlanInput {
  sandboxSeed: string;
  creativeId: string;
  simNow: Date;
  exchangeIds: readonly string[];
  /** Third-party tags are the ones disapproved at random (engine 3.4). */
  thirdParty: boolean;
  disapproveRate?: number;
  /** Scenario override: decide a fixed outcome. */
  force?: 'SERVABLE' | 'NOT_SERVABLE';
}

export interface ReviewPlan {
  dv360DecideAt: Date;
  verdict: 'SERVABLE' | 'NOT_SERVABLE';
  reason: ReasonCode | null;
  /** One entry per exchange, decided no earlier than DV360 itself (delay 2 to 12 sim hours). */
  exchanges: { exchangeId: string; decideAt: Date }[];
}

export function reviewSchedule(input: ReviewPlanInput): ReviewPlan {
  const { sandboxSeed: seed, creativeId: id } = input;
  const dvHours = between(hash01(seed, id, 'dv360'), 1, 3);
  const rate = input.disapproveRate ?? DEFAULT_NEW_TAG_DISAPPROVE_RATE;
  const random = input.thirdParty && hash01(seed, id, 'disapprove') < rate;
  const verdict = input.force ?? (random ? 'NOT_SERVABLE' : 'SERVABLE');
  return {
    dv360DecideAt: new Date(input.simNow.getTime() + dvHours * HOUR_MS),
    verdict,
    reason: verdict === 'NOT_SERVABLE' ? 'POLICY_DESTINATION' : null,
    exchanges: input.exchangeIds.map((exchangeId) => {
      const h = between(hash01(seed, id, exchangeId, 'exchange'), Math.max(2, dvHours), 12);
      return { exchangeId, decideAt: new Date(input.simNow.getTime() + h * HOUR_MS) };
    }),
  };
}

export interface AppealPlan {
  decideAt: Date;
  accepted: boolean;
}

/** Appeal outcome: 12 to 36 sim hours (engine 3.4), three in four accepted. */
export function appealSchedule(
  sandboxSeed: string,
  creativeId: string,
  exchangeId: string,
  round: number,
  simNow: Date,
): AppealPlan {
  const hours = between(
    hash01(sandboxSeed, creativeId, exchangeId, `appeal${round}`, 'delay'),
    12,
    36,
  );
  return {
    decideAt: new Date(simNow.getTime() + hours * HOUR_MS),
    accepted: hash01(sandboxSeed, creativeId, exchangeId, `appeal${round}`, 'result') < 0.75,
  };
}

// ---------------------------------------------------------------------------------------------
// Display strings (module 12 4.6)
// ---------------------------------------------------------------------------------------------

export interface ExchangeCounts {
  servable: number;
  total: number;
}

export function countExchanges(statuses: readonly string[]): ExchangeCounts {
  return { servable: statuses.filter((s) => s === 'APPROVED').length, total: statuses.length };
}

/** Library column text. */
export function exchangeStatusText({ servable, total }: ExchangeCounts): string {
  if (total === 0) return '-';
  return servable === 0 ? `Not servable (0 of ${total})` : `Servable (${servable} of ${total})`;
}

/** Status tab summary. */
export function approvedByText({ servable, total }: ExchangeCounts): string {
  return `Approved by ${servable} of ${total} exchanges`;
}

export const DV360_LABEL = {
  PENDING: 'Pending',
  SERVABLE: 'Servable',
  NOT_SERVABLE: 'Not servable',
} as const;

/** Shown status of the DV360 review: a verdict that is not due yet still reads Pending, whichever way it will go. */
export function shownDv360Review(
  stored: 'PENDING' | 'SERVABLE' | 'NOT_SERVABLE',
  dv360DecideAt: Date | null,
  simNow: Date,
): 'PENDING' | 'SERVABLE' | 'NOT_SERVABLE' {
  if (dv360DecideAt && dv360DecideAt.getTime() > simNow.getTime()) return 'PENDING';
  return stored;
}
