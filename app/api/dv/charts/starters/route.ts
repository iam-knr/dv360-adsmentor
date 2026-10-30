// GET /api/dv/charts/starters (module 11 K19)
import { getSessionUser } from '@/lib/auth/session';
import { unauthenticated } from '@/lib/bulk/api';
import { STARTERS } from '@/lib/charts/spec';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthenticated();
  return Response.json({ data: STARTERS.map((s) => ({ key: s.key, label: s.label, ...s.make() })) });
}
