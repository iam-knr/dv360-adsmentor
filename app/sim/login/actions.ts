'use server';

import { redirect } from 'next/navigation';
import { signIn } from '@/lib/auth';
import { messageForCode } from '@/lib/auth/failure-code';
import { formString } from '@/lib/auth/form';
import { GENERIC_ERROR } from '@/lib/auth/messages';
import { postLoginDestination } from '@/lib/auth/post-login';
import type { LoginState } from '@/components/sim/LoginForm';

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = formString(formData, 'email');
  const password = formString(formData, 'password');
  const next = formString(formData, 'next') || null;

  let url: string;
  try {
    url = String(await signIn('credentials', { email, password, redirect: false }));
  } catch (error) {
    // Auth.js rethrows a failed `authorize` as CredentialsSignin; its `code` says what happened (lib/auth/index.ts).
    if ((error as { type?: string }).type === 'CredentialsSignin') {
      return { error: messageForCode((error as { code?: string }).code) };
    }
    return { error: GENERIC_ERROR };
  }
  const result = new URL(url, 'http://localhost');
  if (result.searchParams.get('error')) {
    return { error: messageForCode(result.searchParams.get('code')) };
  }
  redirect(await postLoginDestination(email, next));
}
