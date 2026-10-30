import 'server-only';
// Where `/` sends a signed in person (routes.md 3.1, AC-01-1): a student to the Overview of their sandbox partner,
// a Super admin to their landing page (`landingFor`).
import type { SessionUser } from '@/lib/auth/types';
import { landingFor } from '@/lib/auth/roles';
import { withSandbox } from '@/lib/db';
import { partnerPath } from '@/lib/routes/paths';
import { getPrefs } from './prefs';

export async function homeFor(user: SessionUser): Promise<string> {
  if (user.appRole !== 'user' && !user.viewAs) return landingFor(user.appRole);
  if (!user.sandboxId || !user.partnerId) return landingFor('user');
  const partnerId = user.partnerId;
  const partner = await withSandbox(user.sandboxId, (tx) =>
    tx.partner.findFirst({ where: { id: partnerId }, select: { publicId: true } }),
  );
  if (!partner) return landingFor('user');
  // REPORTING_ONLY has no Overview (AC-01-25): the reports hub is their home.
  const sub = user.dvRole === 'REPORTING_ONLY' ? 'reporting' : 'home_v3';
  return partnerPath(partner.publicId.toString(), sub);
}

/** `[C]` goes to the user's pinned campaign tab (routes.md 6.3, RT Q3). */
export async function pinnedCampaignTab(user: SessionUser) {
  return (await getPrefs(user)).pinnedCampaignTab ?? null;
}
