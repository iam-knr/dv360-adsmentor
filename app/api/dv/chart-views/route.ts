// GET /api/dv/chart-views?scope=&scopeId=&viewKey=&owner=  PUT (save)  (module 11 K16)
import { z } from 'zod';
import { getSessionUser } from '@/lib/auth/session';
import { badRequest, NO_STORE, respond, unauthenticated } from '@/lib/bulk/api';
import { getChartView, saveChartView } from '@/lib/charts/service';
import type { ChartCardSpec } from '@/lib/charts/spec';
import { ServiceFailure } from '@/lib/campaigns/service-kit';

export const dynamic = 'force-dynamic';

const scope = z.enum(['CAMPAIGN', 'IO', 'LI']);
const putSchema = z.object({
  scope,
  scopeId: z.string().min(1),
  viewKey: z.string().max(80).optional(),
  share: z.boolean().optional(),
  cards: z.array(z.record(z.string(), z.unknown())).max(50),
});

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthenticated();
  const q = new URL(req.url).searchParams;
  const s = scope.safeParse(q.get('scope'));
  const scopeId = q.get('scopeId');
  if (!s.success || !scopeId) return badRequest('scope and scopeId are required.');
  try {
    const view = await getChartView(user, s.data, scopeId, {
      ...(q.get('viewKey') ? { viewKey: q.get('viewKey')! } : {}),
      ...(q.get('owner') ? { viewOwner: q.get('owner')! } : {}),
    });
    return Response.json({ data: view }, { headers: NO_STORE });
  } catch (e) {
    if (e instanceof ServiceFailure)
      return Response.json({ error: e.code }, { status: e.code === 'NOT_FOUND' ? 404 : 403 });
    throw e;
  }
}

export async function PUT(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthenticated();
  const body = putSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return badRequest('scope, scopeId and cards are required.');
  return respond(
    await saveChartView(
      user,
      body.data.scope,
      body.data.scopeId,
      body.data.cards as unknown as ChartCardSpec[],
      {
        ...(body.data.viewKey ? { viewKey: body.data.viewKey } : {}),
        ...(body.data.share !== undefined ? { share: body.data.share } : {}),
      },
    ),
  );
}
