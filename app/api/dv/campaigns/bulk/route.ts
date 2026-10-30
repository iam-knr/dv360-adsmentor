// POST /api/dv/campaigns/bulk  { ids, params } (module 11 K2..K8)
import { getSessionUser } from '@/lib/auth/session';
import { badRequest, bulkRequestSchema, respond, unauthenticated } from '@/lib/bulk/api';
import { runBulk } from '@/lib/bulk/run';
import type { BulkRequest } from '@/lib/bulk/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthenticated();
  const body = bulkRequestSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return badRequest('ids and params are required.');
  return respond(await runBulk(user, { entity: 'campaign', ...body.data } as BulkRequest));
}
