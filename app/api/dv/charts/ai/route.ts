// POST /api/dv/charts/ai { prompt } (module 11 K18): the canned prompt grammar.
import { getSessionUser } from '@/lib/auth/session';
import { badRequest, unauthenticated } from '@/lib/bulk/api';
import { parseChartPrompt } from '@/lib/charts/spec';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthenticated();
  const body = (await req.json().catch(() => null)) as { prompt?: unknown } | null;
  if (!body || typeof body.prompt !== 'string') return badRequest('prompt is required.');
  const r = parseChartPrompt(body.prompt);
  return Response.json(r.ok ? { data: r.spec } : { error: 'UNPARSED', message: r.message }, {
    status: r.ok ? 200 : 422,
  });
}
