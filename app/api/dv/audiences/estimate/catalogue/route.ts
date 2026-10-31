// GET /api/dv/audiences/estimate/catalogue?advertiserId=: the lists the audience picker offers (module 10 2.5).
// First-party, combined and custom lists of the advertiser plus the Google audience catalogue, with eligibility meta.
import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { can } from '@/lib/rbac/can';
import { GOOGLE_AUDIENCES, type AudienceMeta } from '@/lib/targeting/audience';
import { audienceMeta, readAudiences } from '../load';

export const dynamic = 'force-dynamic';

/** Breadcrumb under a list's name in the picker (module 14 S1 type names). */
const TYPE_PATH: Record<string, string> = {
  TAG_BASED: 'Tag-based',
  CUSTOMER_MATCH: 'Customer match',
  YOUTUBE_USERS: 'YouTube users',
  LOOKALIKE: 'Lookalike',
  COMBINED: 'Combined',
  PARTNER: 'Partner',
  CUSTOM_AFFINITY: 'Custom affinity',
  CUSTOM_INTENT_DISPLAY_VIDEO: 'Custom intent (Display and Video)',
  CUSTOM_INTENT_YOUTUBE: 'Custom intent (YouTube)',
};

export interface CatalogueItem {
  id: string;
  name: string;
  path: string;
  meta: AudienceMeta;
  subtype: string;
}

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
  if (!user.sandboxId || !can(user, 'view', { sandboxId: user.sandboxId }))
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  const advertiserId = new URL(req.url).searchParams.get('advertiserId');
  const data = await readAudiences(user.sandboxId, advertiserId);
  const own: CatalogueItem[] = (data?.rows ?? []).map((r) => {
    const meta = audienceMeta(r, data!.nowMs);
    return {
      id: r.id,
      name: r.name,
      path: `${TYPE_PATH[r.type] ?? r.type} » ${r.name}`,
      meta,
      subtype: r.type === 'PARTNER' || r.type.startsWith('CUSTOM_') ? r.type : meta.kind,
    };
  });
  const google: CatalogueItem[] = GOOGLE_AUDIENCES.map((g) => ({
    id: g.id,
    name: g.name,
    path: g.path.join(' » '),
    subtype: g.kind,
    meta: { id: g.id, name: g.name, kind: 'GOOGLE' },
  }));
  return NextResponse.json(
    {
      firstParty: own.filter((o) => o.meta.kind === 'FIRST_PARTY' || o.meta.kind === 'LOOKALIKE'),
      combined: own.filter((o) => o.meta.kind === 'COMBINED'),
      custom: own.filter((o) => o.meta.kind === 'CUSTOM'),
      google,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
