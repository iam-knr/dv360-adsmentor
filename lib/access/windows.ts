import type { SessionUser } from '@/lib/auth/types';

/** Stub (P3-02 replaces it): classes are always open. */
export async function isClassOpen(_classroomId: string, _now: Date): Promise<boolean> {
  return await Promise.resolve(true);
}

export async function getWindowBanner(_user: SessionUser): Promise<string | null> {
  return await Promise.resolve(null);
}

export async function tickAccessWindows(_now: Date): Promise<void> {
  await Promise.resolve();
}
