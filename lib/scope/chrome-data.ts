import 'server-only';
// Read-only data for the chrome (routes.md 4.1 item 7, 4.5 banners; module 01 5 "Sim clock chip"): the sandbox sim
// clock and the class window warning (P3-02 helpers). Nothing here writes.
import { withSandbox } from '@/lib/db';
import type { SessionUser } from '@/lib/auth/types';
import { listNotifications } from '@/lib/history/notifications';
import type { NotificationDto } from '@/lib/history/types';
import { loadInbox, type InboxEntry } from '@/lib/reporting/inbox';
import { bypassesWindow, getClassAccessState, getWindowBanner } from '@/lib/access/windows';

export interface SimClockView {
  /** Simulated now, ISO (ENG 1.2: simStart + tickIndex hours). */
  simNow: string;
  /** Display speed: sim days per real day (RC-028 `speedX`). */
  speedX: number;
  state: 'RUNNING' | 'PAUSED' | 'STEPPING' | 'LOCKED';
  timeZone: string;
}

export interface ChromeData {
  clock: SimClockView | null;
  windowBanner: string | null;
  /** When the class window closes, for the "next navigation goes to /sim/closed" check (AC-01-30). */
  closesAt: string | null;
  /** Bell entries: scheduled report runs (module 16). Absent in tests. */
  inbox?: InboxEntry[];
  /** Bell entries: instructor and platform announcements (module 05 4.7). Absent in tests. */
  announcements?: NotificationDto[];
}

const HOUR_MS = 3_600_000;

export function simClockView(
  row: {
    simStart: Date;
    tickIndex: bigint;
    minutesPerSimDay: number;
    state: SimClockView['state'];
  },
  timeZone: string,
): SimClockView {
  return {
    simNow: new Date(row.simStart.getTime() + Number(row.tickIndex) * HOUR_MS).toISOString(),
    speedX: Math.round((1440 / Math.max(1, row.minutesPerSimDay)) * 10) / 10,
    state: row.state,
    timeZone,
  };
}

export async function getChromeData(
  user: SessionUser,
  now: Date = new Date(),
): Promise<ChromeData> {
  const timeZone = user.timeZone ?? 'Asia/Kolkata';
  const [clockRow, windowBanner, access, inbox, announcements] = await Promise.all([
    user.sandboxId
      ? withSandbox(user.sandboxId, (tx) =>
          tx.simClock.findUnique({
            where: { sandboxId: user.sandboxId },
            select: { simStart: true, tickIndex: true, minutesPerSimDay: true, state: true },
          }),
        )
      : null,
    getWindowBanner(user, now),
    !bypassesWindow(user) && user.classroomId ? getClassAccessState(user.classroomId, now) : null,
    loadInbox(user).catch(() => [] as InboxEntry[]),
    listNotifications(user).catch(() => [] as NotificationDto[]),
  ]);
  return {
    clock: clockRow ? simClockView(clockRow, timeZone) : null,
    windowBanner,
    closesAt: access?.closesAt?.toISOString() ?? null,
    inbox,
    announcements,
  };
}
