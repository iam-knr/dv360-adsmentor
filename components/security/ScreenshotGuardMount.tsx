import type { SessionUser } from '@/lib/auth/types';
import { isScreenshotGuarded } from '@/lib/security/guard-policy';
import { ScreenshotGuard } from './ScreenshotGuard';

/** Server component: renders the guard only for a student whose screenshots are not allowed (never a Super admin). */
export function ScreenshotGuardMount({ user }: { user: SessionUser | null }) {
  return isScreenshotGuarded(user) ? <ScreenshotGuard /> : null;
}
