import 'server-only';
import { resolveClassContext } from '@/lib/access/class-context';
import { isClassOpen } from '@/lib/access/windows';
import { prisma } from '@/lib/db';
import { needsWindowCheck, safeNext } from './guard';
import { landingFor, toSessionRole } from './roles';

/**
 * Where to send a person right after a successful sign in or password change. A User whose class is closed goes
 * straight to /sim/closed, so they can see the next opening (module 18 2.1): the page behind a server action
 * redirect is rendered without middleware, and the URL would otherwise stay on the page they were refused.
 */
export async function postLoginDestination(
  email: string,
  next: string | null | undefined,
  now: Date = new Date(),
): Promise<string> {
  const target = safeNext(next);
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { id: true, appRole: true, mustChangePassword: true },
  });
  if (!user) return '/sim/login';
  if (user.mustChangePassword) {
    return target ? `/sim/me/password?next=${encodeURIComponent(target)}` : '/sim/me/password';
  }
  const role = toSessionRole(user.appRole);
  const destination = target ?? landingFor(role);
  if (role === 'user' && needsWindowCheck(destination.split(/[?#]/)[0] ?? destination)) {
    const ctx = await resolveClassContext(user.id, now);
    if (!ctx.classroomId || !(await isClassOpen(ctx.classroomId, now))) return '/sim/closed';
  }
  return destination;
}
