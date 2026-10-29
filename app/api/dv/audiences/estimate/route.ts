// POST /api/dv/audiences/estimate: Impressions summary of the audience builder (module 10 G3, ENG 1.6).
// Body { audienceLists, lineItemType?, criteria?, advertiserId?, flightDays? } returns ImpressionsSummary (Δ-10-4).
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionUser } from '@/lib/auth/session';
import { defaultParams } from '@/lib/engine';
import { can } from '@/lib/rbac/can';
import { AUDIENCE_MESSAGES } from '@/lib/targeting/audience';
import { estimateSummary } from './estimate';
import { readWorld } from './load';

export const dynamic = 'force-dynamic';

const ids = z.array(z.string().max(80)).max(500);
const body = z.object({
  audienceLists: z.object({
    include: z.object({
      firstPartyGroups: z.array(ids).max(50),
      google: ids,
      combined: ids,
      custom: ids,
    }),
    exclude: z.object({ firstParty: ids, google: ids }),
  }),
  lineItemType: z.string().max(40).optional(),
  criteria: z.record(z.string(), z.unknown()).optional(),
  advertiserId: z.string().max(80).optional(),
  flightDays: z.number().int().min(1).max(366).optional(),
});

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user)
    return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401, headers: NO_STORE });
  if (!user.sandboxId || !can(user, 'view', { sandboxId: user.sandboxId }))
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403, headers: NO_STORE });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: 'BAD_REQUEST' }, { status: 400, headers: NO_STORE });
  const loaded = defaultParams();
  const world = await readWorld(user.sandboxId, parsed.data.advertiserId, loaded);
  if (!world)
    return NextResponse.json(
      { error: 'UNAVAILABLE', message: AUDIENCE_MESSAGES.UNAVAILABLE },
      { status: 422, headers: NO_STORE },
    );
  try {
    const summary = estimateSummary({
      world,
      loaded,
      lists: parsed.data.audienceLists,
      ...(parsed.data.lineItemType ? { lineItemType: parsed.data.lineItemType } : {}),
      criteria: parsed.data.criteria,
      flightDays: parsed.data.flightDays ?? 30,
    });
    return NextResponse.json(summary, { headers: NO_STORE });
  } catch {
    return NextResponse.json(
      { error: 'UNAVAILABLE', message: AUDIENCE_MESSAGES.UNAVAILABLE },
      { status: 422, headers: NO_STORE },
    );
  }
}
