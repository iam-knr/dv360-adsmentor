// GET /api/dv/line-items/:liId/copy-source  settings "Copy settings from" can take (L17, Δ-08-17)
import { getSessionUser } from '@/lib/auth/session';
import { json, resultToHttp, unauthenticated } from '@/lib/line-items/api';
import { getCopySource } from '@/lib/line-items/service';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ liId: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthenticated();
  const { status, body } = resultToHttp(await getCopySource(user, (await params).liId));
  return json(body, status);
}
