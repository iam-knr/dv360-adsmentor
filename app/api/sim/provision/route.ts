// Provisioning progress and driver for the signed in student (module 18 4.4, M18-05). The welcome page polls it: GET
// reads the state; POST also runs one step of the build (about 40 s at most) or, with { retry: true }, restarts a
// FAILED one. Safe to call from several tabs: the build claims its work atomically (lib/sandbox/provision.ts).
import { NextResponse, type NextRequest } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import {
  enqueueProvisionSandbox,
  getProvisionView,
  retryProvisionSandbox,
  runProvisionStep,
  type ProvisionView,
} from '@/lib/sandbox/provision';
import { partnerIdOf } from '@/lib/seed/sandbox';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function body(view: ProvisionView) {
  return {
    ...view,
    ...(view.state === 'READY' && view.sandboxId
      ? { overview: `/p/${partnerIdOf(view.sandboxId)}/home_v3` }
      : {}),
  };
}

async function student() {
  const user = await getSessionUser();
  if (!user) return { error: NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 }) };
  if (user.appRole !== 'user' || !user.classroomId) {
    return { error: NextResponse.json({ error: 'NO_SANDBOX_FOR_ROLE' }, { status: 403 }) };
  }
  return { user, classroomId: user.classroomId };
}

export async function GET() {
  const s = await student();
  if (s.error) return s.error;
  return NextResponse.json(body(await getProvisionView(s.user.id, s.classroomId)));
}

export async function POST(req: NextRequest) {
  const s = await student();
  if (s.error) return s.error;
  if (s.user.viewAs)
    return NextResponse.json(body(await getProvisionView(s.user.id, s.classroomId)));
  const { retry } = (await req.json().catch(() => ({}))) as { retry?: boolean };
  let view = await getProvisionView(s.user.id, s.classroomId);
  if (view.state === 'NOT_CREATED') {
    view = await enqueueProvisionSandbox(s.classroomId, s.user.id);
  }
  if (view.state === 'FAILED' && retry) {
    view = await retryProvisionSandbox(s.classroomId, s.user.id);
  } else if ((view.state === 'QUEUED' || view.state === 'BUILDING') && view.sandboxId) {
    view = await runProvisionStep(view.sandboxId);
  }
  return NextResponse.json(body(view));
}
