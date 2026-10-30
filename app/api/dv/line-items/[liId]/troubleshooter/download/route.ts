// GET /api/dv/line-items/:liId/troubleshooter/download?d=&inventory=  CSV (module 08 L21, 5.3)
import { getSessionUser } from '@/lib/auth/session';
import { respond, unauthenticated } from '@/lib/bulk/api';
import { getTroubleshooterCsv } from '@/lib/troubleshooter/service';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ liId: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthenticated();
  const q = new URL(req.url).searchParams;
  const res = await getTroubleshooterCsv(user, (await params).liId, {
    ...(q.get('inventory') ? { inventory: q.get('inventory') as string } : {}),
    ...(q.get('d') ? { d: q.get('d') as string } : {}),
  });
  if (!res.ok) return respond(res);
  return new Response(res.data.csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${res.data.name}"`,
      'Cache-Control': 'no-store',
    },
  });
}
