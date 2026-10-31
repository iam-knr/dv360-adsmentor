// POST /api/dv/advertisers/:aid/search { query }  (module 01 4.6). Permission RO.
import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { searchAdvertiser } from '@/lib/search/service';
import { searchHttp } from '@/lib/search/http';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, ctx: { params: Promise<{ aid: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { query?: unknown } | null;
  const { aid } = await ctx.params;
  return searchHttp(
    await searchAdvertiser(user, aid, { query: typeof body?.query === 'string' ? body.query : '' }),
  );
}
