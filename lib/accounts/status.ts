// Account status state machine (module 19 4.3). Pure.
export type Status = 'ACTIVE' | 'DISABLED' | 'LOCKED' | 'ARCHIVED';
export type StatusEvent = 'disable' | 'enable' | 'lock' | 'unlock' | 'archive' | 'restore';

const NEXT: Record<StatusEvent, Partial<Record<Status, Status>>> = {
  disable: { ACTIVE: 'DISABLED', LOCKED: 'DISABLED' },
  enable: { DISABLED: 'ACTIVE' },
  lock: { ACTIVE: 'LOCKED' },
  unlock: { LOCKED: 'ACTIVE' },
  archive: { ACTIVE: 'ARCHIVED', DISABLED: 'ARCHIVED', LOCKED: 'ARCHIVED' },
  restore: { ARCHIVED: 'DISABLED' },
};

/** The next status, or null when the transition is not allowed (ARCHIVED to ACTIVE is never direct). */
export function transition(from: Status, event: StatusEvent): Status | null {
  return NEXT[event][from] ?? null;
}
