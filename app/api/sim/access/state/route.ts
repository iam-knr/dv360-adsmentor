// Session and class state for the shell (routes.md 8.1, module 18 4.1): who is signed in, whether the class is
// open, when it closes (the shell shows the five minute warning from `banner`), and view-as.
import { NextResponse } from 'next/server';
import {
  bypassesWindow,
  getClassAccessState,
  tickAccessWindows,
  warningBanner,
} from '@/lib/access/windows';
import { resolveSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };
const LAZY_TICK_MS = 30_000;
let lastTick = 0;

export async function GET() {
  const r = await resolveSession();
  if (!r.ok)
    return NextResponse.json(
      { error: 'UNAUTHENTICATED', reason: r.reason },
      { status: 401, headers: NO_STORE },
    );
  const user = r.user;
  const now = new Date();

  // The timer that calls the tick endpoint can be late; keep the window statuses and sandbox freezes current.
  if (Date.now() - lastTick > LAZY_TICK_MS) {
    lastTick = Date.now();
    await tickAccessWindows(now).catch(() => undefined);
  }

  const bypass = bypassesWindow(user);
  const state = user.classroomId ? await getClassAccessState(user.classroomId, now) : null;
  return NextResponse.json(
    {
      user: { id: user.id, name: user.name, role: user.appRole, classId: user.classroomId ?? null },
      classOpen: bypass ? true : (state?.open ?? false),
      closesAt: state?.closesAt?.toISOString() ?? null,
      banner: bypass ? null : warningBanner(state?.closesAt ?? null, now, state?.timeZone),
      nextWindow: state?.nextWindow
        ? {
            label: state.nextWindow.label,
            opensAt: state.nextWindow.opensAt.toISOString(),
            closesAt: state.nextWindow.closesAt.toISOString(),
          }
        : null,
      viewAs: user.viewAs ?? null,
      sandboxId: user.sandboxId ?? null,
    },
    { headers: NO_STORE },
  );
}
