'use server';

import { redirect } from 'next/navigation';
import { signIn } from '@/lib/auth';
import { formString } from '@/lib/auth/form';
import { GENERIC_ERROR } from '@/lib/auth/messages';
import { changePassword } from '@/lib/auth/password-change';
import { postLoginDestination } from '@/lib/auth/post-login';
import { UnauthenticatedError, requireUser } from '@/lib/auth/session';
import type { PasswordFormState } from '@/components/sim/PasswordForm';

export async function changePasswordAction(
  _prev: PasswordFormState,
  formData: FormData,
): Promise<PasswordFormState> {
  let user;
  try {
    user = await requireUser();
  } catch (err) {
    if (err instanceof UnauthenticatedError) redirect('/sim/login');
    return { error: GENERIC_ERROR };
  }
  // View-as shows the student's page; the password is always the signed in person's own.
  const ownId = user.actor?.id ?? user.id;
  const next = formString(formData, 'next') || null;
  const newPassword = formString(formData, 'next_password');

  const result = await changePassword({
    userId: ownId,
    current: formData.has('current') ? formString(formData, 'current') : undefined,
    next: newPassword,
    confirm: formString(formData, 'confirm'),
  });
  if (!result.ok) return { error: result.message };

  // Every old session ended with the sessionVersion bump. Sign in again to issue this person a fresh one.
  let url: string;
  try {
    url = String(
      await signIn('credentials', { email: result.email, password: newPassword, redirect: false }),
    );
  } catch {
    redirect('/sim/login');
  }
  if (new URL(url, 'http://localhost').searchParams.get('error')) redirect('/sim/login');
  redirect(await postLoginDestination(result.email, next));
}
