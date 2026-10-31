// Who is guarded (pure). Only a signed in STUDENT whose screenshots are not allowed. The Super admin is never
// guarded, not even while viewing a student's simulator (view-as): the guard follows the signed in person.
import type { SessionUser } from '@/lib/auth/types';

export function isScreenshotGuarded(
  user: Pick<SessionUser, 'appRole' | 'screenshotsAllowed' | 'viewAs' | 'actor'> | null | undefined,
): boolean {
  if (!user) return false;
  const signedIn = user.actor?.appRole ?? user.appRole;
  if (signedIn !== 'user' || user.viewAs) return false;
  return user.screenshotsAllowed !== true;
}

export const SCREENSHOT_EVENT_URL = '/api/security/screenshot-event';
export const SUSPENDED_PATH = '/sim/suspended';
