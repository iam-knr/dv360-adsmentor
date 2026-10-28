// MX-05 Pacing combinations and IO automation (validation.md 3). RC-039: automation stores ASAP + FLIGHT and locks both.

export const PACING_PERIODS = ['FLIGHT', 'DAILY'] as const;
export type PacingPeriod = (typeof PACING_PERIODS)[number];

export const PACING_TYPES = ['EVEN', 'AHEAD', 'ASAP'] as const;
export type PacingType = (typeof PACING_TYPES)[number];

export const IO_PACING_ALLOWED: Record<PacingPeriod, readonly PacingType[]> = {
  FLIGHT: ['AHEAD', 'EVEN'],
  DAILY: ['EVEN', 'ASAP'],
};

/** Line item with IO mode `LI_CONTROLLED`. */
export const LI_PACING_ALLOWED: Record<PacingPeriod, readonly PacingType[]> = {
  FLIGHT: ['EVEN', 'AHEAD', 'ASAP'],
  DAILY: ['EVEN', 'ASAP'],
};

export const IO_PACING_DEFAULT = { period: 'FLIGHT', type: 'AHEAD' } as const;

/** What the IO forces on its line items when `optimization.mode` is `IO_AUTOMATED`. */
export const AUTOMATION_FORCED_PACING = { period: 'FLIGHT', type: 'ASAP' } as const;

export function isIoPacingAllowed(period: PacingPeriod, type: PacingType): boolean {
  return IO_PACING_ALLOWED[period].includes(type);
}

export function isLiPacingAllowed(period: PacingPeriod, type: PacingType): boolean {
  return LI_PACING_ALLOWED[period].includes(type);
}

export type OptimizationMode = 'IO_AUTOMATED' | 'LI_CONTROLLED';
export const OPTIMIZATION_MODES: readonly OptimizationMode[] = ['IO_AUTOMATED', 'LI_CONTROLLED'];
