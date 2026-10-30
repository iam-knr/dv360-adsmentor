// SIM rule texts for the instructor console (module 18 4.10) and the pure checks the service and the forms share.
export const SIM = {
  'SIM-004': 'Enter a value',
  'SIM-004B': 'Use 100 characters or fewer.',
  'SIM-005': 'End time must be after the start time.',
  'SIM-006': 'This window is very short.',
  'SIM-007': 'Close the class first.',
  'SIM-008': 'Fix the highlighted rows.',
  'SIM-009': 'Type the class name to confirm.',
  'SIM-016': 'A series can have at most 26 windows.',
  'SIM-017': 'Enter a valid date and time.',
  'SIM-018': 'Only upcoming windows can be changed.',
  'SIM-019': 'Choose at least one day and an end date for the repeat.',
  'SIM-020': 'Class not found.',
  'SIM-021': 'Choose at least one student.',
  FORBIDDEN: "You don't have access to this.",
} as const;

export type SimCode = keyof typeof SIM;

export class InstructorError extends Error {
  constructor(
    readonly code: SimCode | (string & {}),
    message?: string,
    readonly rows?: { row: number; message: string }[],
  ) {
    super(message ?? (code in SIM ? SIM[code as SimCode] : String(code)));
    this.name = 'InstructorError';
  }
}

export const MIN_WINDOW_MINUTES = 15;
export const MAX_SERIES = 26;
export const OPEN_NOW_DEFAULT_HOURS = 2;
export const OPEN_NOW_MAX_HOURS = 8;
export const MAX_ROSTER_ROWS = 200;

/** SIM-006 is a warning, not an error: the form shows it and the save goes ahead. */
export function windowWarnings(opensAt: Date, closesAt: Date): string[] {
  return closesAt.getTime() - opensAt.getTime() < MIN_WINDOW_MINUTES * 60_000
    ? [SIM['SIM-006']]
    : [];
}

export function checkClassName(name: string): string | null {
  const t = name.trim();
  if (!t) return SIM['SIM-004'];
  if ([...t].length > 100) return SIM['SIM-004B'];
  return null;
}

/** SIM-009: a class-scope reset needs the class name typed exactly (case and outer spaces ignored). */
export function confirmsClassName(typed: string | undefined, className: string): boolean {
  return (typed ?? '').trim().toLowerCase() === className.trim().toLowerCase();
}
