// POST /api/dv/recommendations/:id  { action: 'apply' | 'dismiss' }  (module 11 4.9)
import { z } from 'zod';
import { getSessionUser } from '@/lib/auth/session';
import { badRequest, respond, unauthenticated } from '@/lib/bulk/api';
import { applySuggestion, dismissSuggestion } from '@/lib/optimisation/service';

export const dynamic = 'force-dynamic';
const body = z.object({ action: z.enum(['apply', 'dismiss']) });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthenticated();
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest('action must be apply or dismiss.');
  const id = (await params).id;
  const res =
    parsed.data.action === 'apply'
      ? await applySuggestion(user, id)
      : await dismissSuggestion(user, id);
  return respond(res);
}
