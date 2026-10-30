// GET /api/dv/intelligence?scope=advertiser|campaign|io|li&id=  Intelligence panel rows (module 01 4.8, RT 8.17)
import { getSessionUser } from '@/lib/auth/session';
import { badRequest, respond, unauthenticated } from '@/lib/bulk/api';
import { getIntelligence, type IntelligenceScope } from '@/lib/optimisation/service';

export const dynamic = 'force-dynamic';
const SCOPES: readonly string[] = ['advertiser', 'campaign', 'io', 'li'];

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthenticated();
  const q = new URL(req.url).searchParams;
  const scope = q.get('scope') ?? '';
  const id = q.get('id') ?? '';
  if (!SCOPES.includes(scope) || !id) return badRequest('scope and id are required.');
  return respond(await getIntelligence(user, scope as IntelligenceScope, id));
}
