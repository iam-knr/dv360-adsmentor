'use server';

import { runDemoClass } from '../../../../prisma/bootstrap/20-demo-class.bootstrap';
import { run as seedTemplates } from '../../../../prisma/seed/20-template-sandboxes.seed';
import { toDbRole } from '@/lib/auth/roles';
import { requireUserOrRedirect } from '@/lib/auth/session';
import { prisma } from '@/lib/db/client';
import { seedReferenceData } from '@/lib/seed/reference-db';

export interface SeedState {
  ok?: boolean;
  error?: string;
  lines?: string[];
}

/**
 * Super admin only. Builds the reference data, the demo class (instructor, three students, always-open window, one
 * sandbox each) and the three template sandboxes. Idempotent: existing accounts keep their passwords and READY
 * sandboxes at the current seed version are left alone. The student password is typed into the form; it is hashed
 * and never logged or returned.
 */
export async function seedDemoAction(_prev: SeedState, formData: FormData): Promise<SeedState> {
  const user = await requireUserOrRedirect();
  const who = user.actor ?? user;
  if (toDbRole(who.appRole) !== 'SUPER_ADMIN') return { error: 'Only a Super admin can seed.' };
  const raw = formData.get('password');
  const password = typeof raw === 'string' ? raw : '';
  if (password.length < 10) return { error: 'The password needs at least 10 characters.' };
  const lines: string[] = [];
  try {
    await seedReferenceData(prisma);
    lines.push('Reference data: ok');
    await runDemoClass(
      prisma,
      { ...process.env, SEED_DEMO: '1', SEED_STUDENT_PASSWORD: password },
      (line) => lines.push(line.trim()),
    );
    await seedTemplates(); // idempotent; its per-template lines go to the server log
    lines.push('Template sandboxes: ok');
    return { ok: true, lines };
  } catch (err) {
    return { error: err instanceof Error ? err.message.slice(0, 300) : 'Seeding failed.', lines };
  }
}
