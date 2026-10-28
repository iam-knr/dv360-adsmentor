// Pure access window rules (module 18 4.3). A class is open when at least one window covers `now`. The status
// column is moved by the tick, which can lag by minutes, so the times decide: the hard stop has no grace period.
import { formatTime } from '@/lib/auth/messages';

export type WindowStatus = 'SCHEDULED' | 'OPEN' | 'CLOSED' | 'CANCELLED';

export interface WindowLike {
  status: WindowStatus;
  opensAt: Date;
  closesAt: Date;
}

export const WINDOW_WARNING_MINUTES = 5;

/** True while the window covers `now` and has not been cancelled or closed by hand. */
export function isWindowActive(w: WindowLike, now: Date): boolean {
  return (w.status === 'SCHEDULED' || w.status === 'OPEN') && w.opensAt <= now && now < w.closesAt;
}

/** The status the tick gives a window at `now`. */
export function statusAt(w: WindowLike, now: Date): WindowStatus {
  if (w.status === 'CANCELLED' || w.status === 'CLOSED') return w.status;
  if (now >= w.closesAt) return 'CLOSED';
  if (now >= w.opensAt) return 'OPEN';
  return 'SCHEDULED';
}

/**
 * When the class stops being open: the end of the chain of windows that overlap or touch, starting from the
 * ones that cover `now`. Null when the class is closed.
 */
export function openUntil(windows: WindowLike[], now: Date): Date | null {
  const live = windows.filter((w) => w.status === 'SCHEDULED' || w.status === 'OPEN');
  let end: Date | null = null;
  for (const w of live) if (isWindowActive(w, now) && (!end || w.closesAt > end)) end = w.closesAt;
  if (!end) return null;
  let grew = true;
  while (grew) {
    grew = false;
    for (const w of live) {
      if (w.opensAt <= end && w.closesAt > end) {
        end = w.closesAt;
        grew = true;
      }
    }
  }
  return end;
}

export function minutesLeft(closesAt: Date, now: Date): number {
  return (closesAt.getTime() - now.getTime()) / 60_000;
}

/** The "Class ends at ..." banner, shown during the last five minutes. */
export function warningBanner(closesAt: Date | null, now: Date, timeZone?: string): string | null {
  if (!closesAt) return null;
  const left = minutesLeft(closesAt, now);
  if (left <= 0 || left > WINDOW_WARNING_MINUTES) return null;
  return `Class ends at ${formatTime(closesAt, timeZone)}. Save your work.`;
}
