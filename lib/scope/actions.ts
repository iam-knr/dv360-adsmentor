'use server';

// Server actions of the shell (module 01 4.1). Prefs are UI state: any signed in person, no change log.
import { getSessionUser } from '@/lib/auth/session';
import { savePrefs, type PrefsResult } from './prefs';

export async function savePrefsAction(patch: Record<string, unknown>): Promise<PrefsResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, issues: [{ code: 'NO_SANDBOX', message: 'Sign in again.' }] };
  return savePrefs(user, patch);
}
