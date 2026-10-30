// Display helpers of the experiment pages.
type LiftStatus = 'ELIGIBLE' | 'NOT_ELIGIBLE' | 'IN_PROGRESS' | 'COMPLETE' | 'PAUSED' | 'ENDED';

export const fmtDay = (iso: string): string =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

/** "Feb 8, 2026 – End date not set", "Apr 4 – 30, 2025". */
export function dateRangeText(start: string, end: string | null): string {
  if (!end) return `${fmtDay(start)} – End date not set`;
  const a = new Date(`${start}T00:00:00Z`);
  const b = new Date(`${end}T00:00:00Z`);
  if (a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth()) {
    const m = a.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
    return `${m} ${a.getUTCDate()} – ${b.getUTCDate()}, ${a.getUTCFullYear()}`;
  }
  return `${fmtDay(start)} – ${fmtDay(end)}`;
}

export const money = (n: number | null | undefined, code: string): string =>
  n === null || n === undefined
    ? '-'
    : `${code} ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const STATUS_AB: Record<string, string> = { ACTIVE: 'Active', COMPLETED: 'Completed', SCHEDULED: 'Scheduled' };

export const LIFT_STATUS_LABEL: Record<LiftStatus, string> = {
  ELIGIBLE: 'Eligible',
  NOT_ELIGIBLE: 'Not eligible',
  IN_PROGRESS: 'In progress',
  COMPLETE: 'Complete',
  PAUSED: 'Paused',
  ENDED: 'Ended',
};

export const pctText = (v: number | null | undefined, digits = 1): string =>
  v === null || v === undefined ? '-' : `${(v * 100).toFixed(digits)}%`;
