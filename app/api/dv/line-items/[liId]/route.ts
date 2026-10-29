// GET /api/dv/line-items/:liId  detail (L3)
// PUT /api/dv/line-items/:liId  { value, expectedVersion?, note? }  save (L6)
import { getSessionUser } from '@/lib/auth/session';
import {
  badRequest,
  json,
  parseWriteBody,
  resultToHttp,
  unauthenticated,
} from '@/lib/line-items/api';
import type { LiFormValue } from '@/lib/line-items/form';
import { getLineItemDetail, updateLineItem } from '@/lib/line-items/service';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ liId: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) return unauthenticated();
  const detail = await getLineItemDetail(user, (await params).liId);
  return detail ? json(detail) : json({ error: 'NOT_FOUND' }, 404);
}

export async function PUT(req: Request, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) return unauthenticated();
  const body = parseWriteBody(await req.json().catch(() => null));
  if (!body.ok) return badRequest('value is required.');
  const { status, body: out } = resultToHttp(
    await updateLineItem(user, (await params).liId, body.body.value as unknown as LiFormValue, {
      ...(body.body.expectedVersion !== undefined
        ? { expectedVersion: body.body.expectedVersion }
        : {}),
      ...(body.body.note ? { note: body.body.note } : {}),
    }),
  );
  return json(out, status);
}
