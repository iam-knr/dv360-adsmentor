// POST /api/dv/ad-groups/bulk   { ids, action: 'ACTIVATE' | 'PAUSE' } (module 09 Y10, Q-09-04, C-09-5: no archive)
import { getSessionUser } from '@/lib/auth/session';
import { badRequest, parseBulk, respond, unauthenticated } from '@/lib/youtube/api';
import { bulkSetAdGroupStatus } from '@/lib/youtube/service';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthenticated();
  const body = parseBulk(await req.json().catch(() => null));
  if (!body.success) return badRequest('ids and action (ACTIVATE or PAUSE) are required.');
  return respond(
    await bulkSetAdGroupStatus(
      user,
      body.data.ids,
      body.data.action === 'ACTIVATE' ? 'ACTIVE' : 'PAUSED',
    ),
  );
}
