'use server';

// Server actions of the targeting template pages. Thin: session, then service (which checks `can()`).
import { revalidatePath } from 'next/cache';
import { getSessionUser } from '@/lib/auth/session';
import type { Result } from '@/lib/settings/kit';
import { createTemplate, setTemplateStatus, updateTemplate, type TemplateInput } from './service';

const NO_SESSION: Result<never> = { ok: false, code: 'FORBIDDEN', issues: [] };

async function withUser<T>(
  fn: (user: NonNullable<Awaited<ReturnType<typeof getSessionUser>>>) => Promise<Result<T>>,
): Promise<Result<T>> {
  const user = await getSessionUser();
  if (!user) return NO_SESSION;
  const res = await fn(user);
  if (res.ok) revalidatePath('/p');
  return res;
}

export const createTemplateAction = async (aid: string, input: TemplateInput) =>
  withUser((u) => createTemplate(u, aid, input));
export const updateTemplateAction = async (
  aid: string,
  templateId: string,
  input: Omit<TemplateInput, 'type'>,
) => withUser((u) => updateTemplate(u, aid, templateId, input));
export const setTemplateStatusAction = async (
  aid: string,
  templateId: string,
  status: 'ACTIVE' | 'ARCHIVED',
) => withUser((u) => setTemplateStatus(u, aid, templateId, status));
