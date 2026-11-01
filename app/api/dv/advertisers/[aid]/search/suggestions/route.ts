// GET /api/dv/advertisers/:aid/search/suggestions  (module 01 4.6). The 7 chips as saved filter links. Permission RO.
import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { getSearchSuggestions } from '@/lib/search/service';
import { searchHttp } from '@/lib/search/http';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: { params: Promise<{ aid: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
  const { aid } = await ctx.params;
  return searchHttp(await getSearchSuggestions(user, aid));
}
