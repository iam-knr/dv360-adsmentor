import 'server-only';
import { redirect } from 'next/navigation';
import { toDbRole } from '@/lib/auth/roles';
import { requireUserOrRedirect } from '@/lib/auth/session';
import type { Actor } from './permissions';

/** For /manage pages: the signed in Admin or Super admin as an `Actor`; a User goes to /sim/forbidden. */
export async function pageActor(): Promise<Actor> {
  const user = await requireUserOrRedirect();
  const who = user.actor ?? user;
  const role = toDbRole(who.appRole);
  if (role === 'USER') redirect('/sim/forbidden');
  return { id: who.id, role };
}
