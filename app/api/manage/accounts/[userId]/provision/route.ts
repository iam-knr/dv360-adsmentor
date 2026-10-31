// Drives a student's sandbox build for the Super admin's account page (docs/gaps/prov-drive.md). POST runs one step of
// the build (about 40 s at most) when the sandbox is QUEUED or BUILDING and otherwise only reports the state; the page
// calls it in turn, never twice at once, until READY or FAILED. Safe next to the timer and the student's own page:
// the step claims its work atomically (lib/sandbox/provision.ts).
import { NextResponse, type NextRequest } from 'next/server';
import { toDbRole } from '@/lib/auth/roles';
import { getSessionUser } from '@/lib/auth/session';
import { AccountError } from '@/lib/accounts/rules';
import { driveSandbox } from '@/lib/accounts/service';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(_req: NextRequest, ctx: { params: Promise<{ userId: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
  const who = user.actor ?? user;
  if (toDbRole(who.appRole) !== 'SUPER_ADMIN')
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  const { userId } = await ctx.params;
  try {
    const view = await driveSandbox({ id: who.id, role: 'SUPER_ADMIN' }, userId);
    return NextResponse.json(view);
  } catch (err) {
    if (err instanceof AccountError)
      return NextResponse.json({ error: err.code }, { status: err.code === 'ACC-022' ? 404 : 403 });
    return NextResponse.json({ error: 'ERROR' }, { status: 500 });
  }
}
