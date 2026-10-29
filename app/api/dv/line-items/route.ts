// GET  /api/dv/line-items?scope=io|campaign|advertiser|audience&id=…  list (routes.md 8.6, L1)
// POST /api/dv/line-items  { ioId, value, note? }                       create (L5)
import { getSessionUser } from '@/lib/auth/session';
import {
  badRequest,
  json,
  parseListParams,
  parseWriteBody,
  resultToHttp,
  unauthenticated,
} from '@/lib/line-items/api';
import type { LiFormValue } from '@/lib/line-items/form';
import { createLineItem, listLineItems } from '@/lib/line-items/service';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthenticated();
  const parsed = parseListParams(new URL(req.url).searchParams);
  if (!parsed.ok) return badRequest(parsed.message);
  const result = await listLineItems(user, parsed.scope, parsed.query, parsed.range);
  return result ? json(result) : json({ error: 'NOT_FOUND' }, 404);
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthenticated();
  const body = parseWriteBody(await req.json().catch(() => null));
  if (!body.ok || !body.body.ioId) return badRequest('ioId and value are required.');
  const { status, body: out } = resultToHttp(
    await createLineItem(user, body.body.ioId, body.body.value as unknown as LiFormValue, {
      ...(body.body.note ? { note: body.body.note } : {}),
    }),
    201,
  );
  return json(out, status);
}
