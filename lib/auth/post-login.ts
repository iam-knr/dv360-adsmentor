import 'server-only';
import { prisma } from '@/lib/db';
import { safeNext } from './guard';
import { landingFor, sessionRoleOrNull } from './roles';

/**
 * Where to send a person right after a successful sign in or password change: a student to `/sim/welcome` (it shows the
 * sandbox build, then opens the sandbox home), a Super admin to `/manage`.
 */
export async function postLoginDestination(
  email: string,
  next: string | null | undefined,
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
  const role = sessionRoleOrNull(user.appRole);
  if (!role) return '/sim/login';
  return target ?? landingFor(role);
}
