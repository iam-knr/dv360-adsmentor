import 'server-only';
import { NextResponse } from 'next/server';
import { toDbRole } from '@/lib/auth/roles';
import { UnauthenticatedError, requireUser } from '@/lib/auth/session';
import type { Actor } from './permissions';

/** For route handlers: the actor, or a 401/403 response. Handlers under /api/manage never change state on GET. */
export async function actorOrResponse(): Promise<Actor | NextResponse> {
  try {
    const user = await requireUser();
    const who = user.actor ?? user;
    const role = toDbRole(who.appRole);
    if (role === 'USER') return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    return { id: who.id, role };
  } catch (err) {
    if (err instanceof UnauthenticatedError)
      return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
    throw err;
  }
}
