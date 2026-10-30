// POST /api/dv/sdf/download (module 11 K9..K11)
import { getSessionUser } from '@/lib/auth/session';
import { badRequest, respond, sdfDownloadSchema, unauthenticated } from '@/lib/bulk/api';
import { requestSdfDownload } from '@/lib/sdf/download';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthenticated();
  const body = sdfDownloadSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return badRequest('advertiserId is required.');
  return respond(await requestSdfDownload(user, body.data));
}
