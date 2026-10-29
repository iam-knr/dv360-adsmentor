// Reference catalogue lookups for the targeting editors (P3-07a, routes.md 8). Read-only, fixed lists from
// lib/targeting/options; `q` filters by label.
import { NextResponse, type NextRequest } from 'next/server';
import { resolveSession } from '@/lib/auth/session';
import {
  BROWSERS,
  CARRIER_ISP_EXAMPLES,
  CATEGORIES_TOP,
  DEVICE_TYPES,
  LANGUAGES,
  type OptionDef,
} from '@/lib/targeting/options';

export const dynamic = 'force-dynamic';

const CATALOGUES: Record<string, readonly OptionDef[]> = {
  categories: CATEGORIES_TOP,
  languages: LANGUAGES,
  devices: DEVICE_TYPES,
  browsers: BROWSERS,
  isps: CARRIER_ISP_EXAMPLES.map((o) => ({ code: o.code, label: o.label })),
};

export async function GET(req: NextRequest, ctx: { params: Promise<{ catalog: string }> }) {
  const r = await resolveSession();
  if (!r.ok) return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
  const { catalog } = await ctx.params;
  const list = CATALOGUES[catalog];
  if (!list) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  const q = req.nextUrl.searchParams.get('q')?.trim().toLowerCase() ?? '';
  const items = q ? list.filter((o) => o.label.toLowerCase().includes(q)) : list;
  return NextResponse.json({ items }, { headers: { 'Cache-Control': 'no-store' } });
}
