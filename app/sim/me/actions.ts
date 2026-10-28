'use server';

import { writeAudit } from '@/lib/auth/audit';
import { formString } from '@/lib/auth/form';
import { GENERIC_ERROR } from '@/lib/auth/messages';
import { toDbRole } from '@/lib/auth/roles';
import { UnauthenticatedError, requireUser } from '@/lib/auth/session';
import { isReadOnlyView, viewOnlyMessage } from '@/lib/rbac/can';
import { prisma } from '@/lib/db';
import type { ProfileFormState } from '@/components/sim/ProfileForm';

export async function updateProfileAction(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  let user;
  try {
    user = await requireUser();
  } catch (err) {
    if (err instanceof UnauthenticatedError)
      return { error: 'Your session expired. Sign in again.' };
    return { error: GENERIC_ERROR };
  }
  if (isReadOnlyView(user)) return { error: viewOnlyMessage(user) };

  const name = formString(formData, 'name').trim();
  if (!name) return { error: 'Enter a value' };
  if ([...name].length > 100) return { error: 'Use 100 characters or fewer.' };

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { name } });
    await writeAudit(tx, {
      actorUserId: user.actor?.id ?? user.id,
      actorRole: user.actor ? toDbRole(user.actor.appRole) : toDbRole(user.appRole),
      action: 'ACCOUNT_UPDATED',
      targetType: 'User',
      targetId: user.id,
      targetUserId: user.id,
      classroomId: user.classroomId,
    });
  });
  return { saved: true };
}
