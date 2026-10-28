// Budget segment helpers (engine.md 7.1). No carry-over of unspent budget between segments.

import { isoToDay } from '../calendar';
import type { BudgetSegment } from '../world';

/** The segment that contains `day` (YYYY-MM-DD, end inclusive), if any. */
export function activeSegment(
  segments: readonly BudgetSegment[],
  day: string,
): BudgetSegment | undefined {
  let hit: BudgetSegment | undefined;
  for (const s of segments) {
    if (day >= s.startDay && day <= s.endDay) {
      if (!hit || s.startDay > hit.startDay || (s.startDay === hit.startDay && s.id < hit.id))
        hit = s;
    }
  }
  return hit;
}

/** Days from `today` to `end`, both inclusive. */
export function remainingDays(today: string, end: string): number {
  return Math.max(1, isoToDay(end) - isoToDay(today) + 1);
}

export function daysBetween(start: string, end: string): number {
  return Math.max(1, isoToDay(end) - isoToDay(start) + 1);
}
