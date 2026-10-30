import 'server-only';
import { notFound } from 'next/navigation';
import { toDbRole } from '@/lib/auth/roles';
import { requireUserOrRedirect } from '@/lib/auth/session';
import type { Actor } from './permissions';

/** For /manage pages: the signed in Super admin as an `Actor`; a student gets the 404 page. */
export async function pageActor(): Promise<Actor> {
  const user = await requireUserOrRedirect();
  const who = user.actor ?? user;
  const role = toDbRole(who.appRole);
  if (role !== 'SUPER_ADMIN') notFound();
  return { id: who.id, role };
}
