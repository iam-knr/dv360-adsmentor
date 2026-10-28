// Pure session policy (module 19 4.5): one function decides whether a session is still good. No I/O, so the
// sessionVersion, single session, idle and absolute rules are unit tested with plain dates.
import type { AppRole, SessionFailureReason } from './types';
import type { PolicyValues } from './policy';
import { absoluteHoursFor, idleMinutesFor, singleSessionFor } from './policy';

/**
 * lastSeenAt is written at most every 5 minutes, so an idle limit below 10 minutes would sign out people who are
 * working. The Settings page (P3-02b) should not offer less; this is the safety net.
 */
export const MIN_IDLE_MINUTES = 10;

export interface SessionClaimsIn {
  /** sessionVersion at sign in */
  sv: number;
  sid: string;
  /** Unix seconds of the sign in */
  loginAt: number;
}

export interface UserStateIn {
  appRole: AppRole;
  status: 'ACTIVE' | 'DISABLED' | 'LOCKED' | 'ARCHIVED';
  sessionVersion: number;
  activeSessionId: string | null;
  lastSeenAt: Date | null;
}

export function evaluateSession(
  claims: SessionClaimsIn,
  user: UserStateIn | null,
  policy: PolicyValues,
  now: Date,
): SessionFailureReason | null {
  if (!user || user.status === 'DISABLED' || user.status === 'ARCHIVED') return 'revoked';
  if (claims.sv !== user.sessionVersion) return 'revoked';
  if (singleSessionFor(policy, user.appRole) && user.activeSessionId !== claims.sid)
    return 'other-device';

  const nowMs = now.getTime();
  const loginMs = claims.loginAt * 1000;
  if (nowMs - loginMs > absoluteHoursFor(policy, user.appRole) * 3_600_000) return 'absolute';

  const lastMs = user.lastSeenAt ? Math.max(user.lastSeenAt.getTime(), loginMs) : loginMs;
  if (nowMs - lastMs > Math.max(idleMinutesFor(policy, user.appRole), MIN_IDLE_MINUTES) * 60_000)
    return 'idle';
  return null;
}
