// IO automation propagation (IO-053, module 07 4.5 item 6, RC-039): when an IO automates bid and budget, each of its
// line items gets pacing Flight + ASAP and the IO's "optimized towards" strategy as an automated bid. Pure.
import type { BidStrategy } from '@/lib/validation/constants/io-matrix';
import { AUTOMATION_FORCED_PACING } from '@/lib/validation/constants/pacing';

export interface LiAutomationState {
  id: string;
  pacingPeriod: 'FLIGHT' | 'DAILY';
  pacingType: 'AHEAD' | 'EVEN' | 'ASAP';
  bidKind: 'AUTOMATED' | 'FIXED';
  bidGoal: string | null;
}

export type LiAutomationPatch = Pick<
  LiAutomationState,
  'pacingPeriod' | 'pacingType' | 'bidKind' | 'bidGoal'
>;

/** The patch for one line item, or null when it already matches. */
export function automationPatch(
  li: LiAutomationState,
  optimizedTowards: BidStrategy | null,
): LiAutomationPatch | null {
  const target: LiAutomationPatch = {
    pacingPeriod: AUTOMATION_FORCED_PACING.period,
    pacingType: AUTOMATION_FORCED_PACING.type,
    bidKind: 'AUTOMATED',
    bidGoal: optimizedTowards && optimizedTowards !== 'FIXED_BID' ? optimizedTowards : li.bidGoal,
  };
  const same =
    li.pacingPeriod === target.pacingPeriod &&
    li.pacingType === target.pacingType &&
    li.bidKind === target.bidKind &&
    li.bidGoal === target.bidGoal;
  return same ? null : target;
}

/** Propagation runs when the saved IO automates and either it did not before or its strategy changed. */
export function needsPropagation(
  before: { mode: string; optimizedTowards: string | null } | null,
  after: { mode: string | null; optimizedTowards?: string | null },
): boolean {
  if (after.mode !== 'IO_AUTOMATED') return false;
  if (!before) return false;
  return (
    before.mode !== 'IO_AUTOMATED' || before.optimizedTowards !== (after.optimizedTowards ?? null)
  );
}
