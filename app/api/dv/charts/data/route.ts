// POST /api/dv/charts/data (module 11 K17, Δ-11-7)
import { z } from 'zod';
import { getSessionUser } from '@/lib/auth/session';
import { badRequest, respond, unauthenticated } from '@/lib/bulk/api';
import { chartData } from '@/lib/charts/data';
import type { ChartCardSpec } from '@/lib/charts/spec';

export const dynamic = 'force-dynamic';

const schema = z.object({
  scope: z.enum(['ADVERTISER', 'CAMPAIGN', 'IO', 'LI']),
  scopeId: z.string().min(1),
  spec: z.record(z.string(), z.unknown()),
  from: z.string().optional(),
  to: z.string().optional(),
});

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthenticated();
  const body = schema.safeParse(await req.json().catch(() => null));
  if (!body.success) return badRequest('scope, scopeId and spec are required.');
  return respond(
    await chartData(user, { ...body.data, spec: body.data.spec as unknown as ChartCardSpec }),
  );
}
