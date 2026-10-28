import 'server-only';
import { redirect } from 'next/navigation';
import { bypassesWindow, isClassOpen } from './windows';
import type { SessionUser } from '@/lib/auth/types';

/**
 * Page level class window check for Users, the second line behind middleware.ts. A server action that ends in
 * redirect() renders its target without passing through middleware, so every student page (and the DV360 layouts of
 * P3-03) calls this too. Admins and Super admins pass.
 */
export async function requireOpenClass(user: SessionUser, now: Date = new Date()): Promise<void> {
  if (bypassesWindow(user)) return;
  if (user.classroomId && (await isClassOpen(user.classroomId, now))) return;
  redirect('/sim/closed');
}
