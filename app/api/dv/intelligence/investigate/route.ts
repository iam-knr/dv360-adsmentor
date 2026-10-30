// GET /api/dv/intelligence/investigate?scope=io|li&id=  conflicting-settings explanations (module 11 2.8)
import { getSessionUser } from '@/lib/auth/session';
import { badRequest, respond, unauthenticated } from '@/lib/bulk/api';
import { getInvestigate } from '@/lib/optimisation/service';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthenticated();
  const q = new URL(req.url).searchParams;
  const scope = q.get('scope');
  const id = q.get('id') ?? '';
  if ((scope !== 'io' && scope !== 'li') || !id)
    return badRequest('scope (io or li) and id are required.');
  return respond(await getInvestigate(user, scope, id));
}
