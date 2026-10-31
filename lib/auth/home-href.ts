import type { AppRole } from './types';

/** Where the logo and "Back" links lead: a Super admin to the accounts list, a student to their home (`/` resolves it). */
export function homeHrefFor(role: AppRole | null | undefined): string {
  return role === 'super_admin' ? '/manage/accounts' : '/';
}

export function backLabelFor(role: AppRole | null | undefined): string {
  return role === 'super_admin' ? 'Back to accounts' : 'Back to home';
}
