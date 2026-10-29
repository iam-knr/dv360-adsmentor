// GET /api/dv/creatives/:id?advertiser=…   detail
// PUT /api/dv/creatives/:id                { advertiser, value, expectedVersion?, note? }   update
import { getSessionUser } from '@/lib/auth/session';
import { badRequest, readResponse, resultToHttp, unauthenticated } from '@/lib/creatives/api';
import { getCreativeDetail, updateCreative } from '@/lib/creatives/service';
import type { CreativeInput } from '@/lib/validation/types';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthenticated();
  const advertiser = new URL(req.url).searchParams.get('advertiser');
  if (!advertiser) return badRequest('advertiser is required.');
  const { id } = await params;
  return readResponse(() => getCreativeDetail(user, advertiser, id));
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthenticated();
  const body = (await req.json().catch(() => null)) as {
    advertiser?: string;
    value?: CreativeInput;
    expectedVersion?: number;
    note?: string;
  } | null;
  if (!body?.advertiser || !body.value) return badRequest('advertiser and value are required.');
  const { id } = await params;
  return resultToHttp(
    await updateCreative(user, body.advertiser, id, body.value, {
      ...(body.expectedVersion !== undefined ? { expectedVersion: body.expectedVersion } : {}),
      ...(body.note ? { note: body.note } : {}),
    }),
  );
}
