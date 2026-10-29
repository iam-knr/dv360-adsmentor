// GET  /api/dv/creatives?advertiser=…&q=&status=ACTIVE,PAUSED&page=&pageSize=&sort=createdAt:desc   list (routes.md 8.9)
// POST /api/dv/creatives  { advertiser, value, note? }                                          create
import { getSessionUser } from '@/lib/auth/session';
import {
  badRequest,
  parseListQuery,
  readResponse,
  resultToHttp,
  unauthenticated,
} from '@/lib/creatives/api';
import { createCreative, listCreatives } from '@/lib/creatives/service';
import type { CreativeInput } from '@/lib/validation/types';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthenticated();
  const params = new URL(req.url).searchParams;
  const advertiser = params.get('advertiser');
  const query = parseListQuery(params);
  if (!advertiser || !query) return badRequest('advertiser and valid filters are required.');
  return readResponse(() => listCreatives(user, advertiser, query));
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthenticated();
  const body = (await req.json().catch(() => null)) as {
    advertiser?: string;
    value?: CreativeInput;
    note?: string;
  } | null;
  if (!body?.advertiser || !body.value) return badRequest('advertiser and value are required.');
  return resultToHttp(
    await createCreative(user, body.advertiser, body.value, body.note ? { note: body.note } : {}),
    201,
  );
}
