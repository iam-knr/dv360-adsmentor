// GET /api/dv/report-runs/:runId/download?format=csv|xlsx  (routes.md 8.13)
import { getSessionUser } from '@/lib/auth/session';
import { fileResponse, unauthenticated } from '@/lib/reporting/api';
import { downloadRun } from '@/lib/reporting/service';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, ctx: { params: Promise<{ runId: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthenticated();
  const { runId } = await ctx.params;
  const format = new URL(req.url).searchParams.get('format')?.toLowerCase() === 'xlsx' ? 'XLSX' : 'CSV';
  return fileResponse(() => downloadRun(user, runId, format));
}
