// Builders that turn a stored entity into the snapshots a ValidationContext carries. Pure.
import { ioFlight } from './rules/io';
import { toNum } from './primitives';
import type {
  CampaignInput,
  CampaignSnapshot,
  IoInput,
  IoSnapshot,
  LineItemInput,
  LineItemSnapshot,
} from './types';

export function campaignSnapshotFrom(c: CampaignInput, id?: string): CampaignSnapshot {
  return {
    ...(id ? { id } : {}),
    goal: c.goal,
    status: c.status ?? 'ACTIVE',
    frequencyCap: c.frequencyCap,
  };
}

/** `type`, `objective`, `budget.type` and `optimization.mode` must be set on a stored IO. */
export function ioSnapshotFrom(io: IoInput, id?: string): IoSnapshot {
  return {
    ...(id ? { id } : {}),
    type: io.type ?? 'STANDARD',
    objective: io.objective ?? 'NONE',
    mode: io.optimization.mode ?? 'LI_CONTROLLED',
    optimizedTowards: io.optimization.optimizedTowards ?? null,
    status: io.status ?? 'DRAFT',
    budgetType: io.budget.type ?? 'CURRENCY',
    budgetTotal: io.budget.segments.reduce((sum, s) => sum + (toNum(s.amount) ?? 0), 0),
    flight: ioFlight(io),
    frequencyCap: io.frequencyCap,
  };
}

export function lineItemSnapshotFrom(li: LineItemInput, id: string): LineItemSnapshot {
  return {
    id,
    type: li.type ?? 'DISPLAY',
    status: li.status ?? 'DRAFT',
    budgetAmount: li.budget.mode === 'AMOUNT' ? toNum(li.budget.amount) : null,
    flight: {
      mode: li.flight.mode ?? 'SAME_AS_IO',
      startDate: li.flight.startDate ?? null,
      endDate: li.flight.endDate ?? null,
    },
    pacingType: li.pacing.type,
    bidMode: li.bid.mode,
    optimizedTowards: li.bid.optimizedTowards ?? null,
  };
}
