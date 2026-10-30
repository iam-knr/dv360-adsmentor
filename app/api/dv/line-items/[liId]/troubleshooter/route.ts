// GET /api/dv/line-items/:liId/troubleshooter?inventory=&d=  (module 08 L20)
import { getSessionUser } from '@/lib/auth/session';
import { respond, unauthenticated } from '@/lib/bulk/api';
import { getTroubleshooter } from '@/lib/troubleshooter/service';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ liId: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthenticated();
  const q = new URL(req.url).searchParams;
  return respond(
    await getTroubleshooter(user, (await params).liId, {
      ...(q.get('inventory') ? { inventory: q.get('inventory') as string } : {}),
      ...(q.get('d') ? { d: q.get('d') as string } : {}),
    }),
  );
}
