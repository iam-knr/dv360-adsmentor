// POST /api/dv/partners/:pid/search { query }: partner pages search advertisers by name or ID only (module 01 2.3).
import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { searchPartner } from '@/lib/search/service';
import { searchHttp } from '@/lib/search/http';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, ctx: { params: Promise<{ pid: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { query?: unknown } | null;
  const { pid } = await ctx.params;
  return searchHttp(
    await searchPartner(user, pid, { query: typeof body?.query === 'string' ? body.query : '' }),
  );
}
