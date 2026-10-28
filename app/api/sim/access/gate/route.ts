// Called by middleware.ts for students on DV360 and student pages: is the class open right now? The edge has no
// database, so the answer comes from here. Returns { open } or { redirect } for a session that is no longer valid.
import { NextResponse } from 'next/server';
import { bypassesWindow, getClassAccessState } from '@/lib/access/windows';
import { resolveSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function GET() {
  const r = await resolveSession();
  if (!r.ok) {
    const redirect = r.reason === 'none' ? '/sim/login' : `/sim/session-expired?reason=${r.reason}`;
    return NextResponse.json({ open: false, redirect }, { headers: NO_STORE });
  }
  const user = r.user;
  if (bypassesWindow(user))
    return NextResponse.json({ open: true, until: null }, { headers: NO_STORE });
  const state = user.classroomId ? await getClassAccessState(user.classroomId) : null;
  // `until` lets the middleware stop caching "open" at the moment the class ends
  return NextResponse.json(
    { open: state?.open ?? false, until: state?.closesAt?.getTime() ?? null },
    { headers: NO_STORE },
  );
}
