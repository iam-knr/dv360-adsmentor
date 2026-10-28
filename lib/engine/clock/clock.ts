// Sim clock maths (engine.md 1.2): due ticks from real elapsed time, with no drift and no double
// count. The caller passes real time in; nothing here reads the clock.

export interface ClockInput {
  /** Real minutes for one sim day (1440 = real time). */
  minutesPerSimDay: number;
  /** Real ms accounted up to (epoch ms). */
  lastAdvanceRealMs: number;
  /** Real ms carried over while paused or between cron runs. */
  remainderMs: number;
}

export const MAX_DUE_TICKS = 96;

export function msPerTick(minutesPerSimDay: number): number {
  return (minutesPerSimDay * 60_000) / 24;
}

/** Ticks due at `realNowMs` (capped at `max`) and the remainder to carry. */
export function dueTicks(
  c: ClockInput,
  realNowMs: number,
  max = MAX_DUE_TICKS,
): { due: number; remainderMs: number } {
  const per = msPerTick(c.minutesPerSimDay);
  const total = Math.max(0, realNowMs - c.lastAdvanceRealMs) + c.remainderMs;
  const all = Math.floor(total / per);
  const due = Math.min(all, max);
  return { due, remainderMs: total - due * per };
}

/** Clock after a pause: paused time is not owed, so the accounting point moves to `realNowMs`. */
export function resumeClock(c: ClockInput, realNowMs: number): ClockInput {
  return { ...c, lastAdvanceRealMs: realNowMs };
}

/** Speed presets the instructor can pick, as minutes per sim day (engine.md 1.2). */
export const SPEED_PRESETS = [2, 5, 10, 30, 60, 1440] as const;
/** Hard cap on ticks per sandbox per real minute; faster goes through fast-forward (10.3). */
export const MAX_TICKS_PER_SANDBOX_PER_MINUTE = 12;

export function speedAllowed(minutesPerSimDay: number): boolean {
  return 60_000 / msPerTick(minutesPerSimDay) <= MAX_TICKS_PER_SANDBOX_PER_MINUTE + 1e-9;
}

export type ClockState = 'RUNNING' | 'PAUSED' | 'STEPPING' | 'LOCKED';
export type CatchUpPolicy = 'simulate' | 'skip';

/**
 * What to do with the ticks that are due (engine.md 1.4). `simulate` runs up to `maxPerRun` and leaves
 * the rest for the next run; `skip` advances the tick index without delivery and records a gap.
 */
export function planCatchUp(
  due: number,
  policy: CatchUpPolicy,
  maxPerRun = MAX_DUE_TICKS,
): { simulate: number; skip: number; remaining: number } {
  if (policy === 'skip') return { simulate: 0, skip: due, remaining: 0 };
  const simulate = Math.min(due, maxPerRun);
  return { simulate, skip: 0, remaining: due - simulate };
}

/** Ticks a clock in `state` may run when asked for `want` more (pause, resume, step: engine.md 1.2). */
export function ticksAllowed(state: ClockState, want: number, stepsLeft = 0): number {
  switch (state) {
    case 'RUNNING':
      return want;
    case 'STEPPING':
      return Math.min(want, stepsLeft);
    case 'PAUSED':
    case 'LOCKED':
      return 0;
  }
}
