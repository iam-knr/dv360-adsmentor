// GET /api/dv/bulk-options?advertiserId=&kind=creatives|templates|deals|dealGroups (module 11 2.3, 2.4)
// The pickers of the bulk panels; ids are row ids because the services take row ids.
import { getSessionUser } from '@/lib/auth/session';
import { badRequest, NO_STORE, unauthenticated } from '@/lib/bulk/api';
import { serviceCtx } from '@/lib/campaigns/service-kit';
import { withSandbox } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user?.sandboxId) return unauthenticated();
  const q = new URL(req.url).searchParams;
  const kind = q.get('kind');
  const adv = q.get('advertiserId') ?? '';
  if (!kind || !adv) return badRequest('advertiserId and kind are required.');
  const ctx = await serviceCtx(user);
  const items = await withSandbox(ctx.sandboxId, async (tx) => {
    const a = await tx.advertiser.findFirst({
      where: /^\d+$/.test(adv) ? { publicId: BigInt(adv) } : { id: adv },
      select: { id: true, partnerId: true },
    });
    if (!a) return [];
    if (kind === 'creatives')
      return (
        await tx.creative.findMany({
          where: { advertiserId: a.id, status: { not: 'ARCHIVED' } },
          orderBy: { name: 'asc' },
          take: 200,
        })
      ).map((c) => ({ id: c.id, label: `${c.name} (${c.publicId})`, detail: c.kind }));
    if (kind === 'templates')
      return (
        await tx.targetingTemplate.findMany({
          where: { advertiserId: a.id, status: { not: 'ARCHIVED' } },
          orderBy: { name: 'asc' },
        })
      ).map((t) => ({ id: t.id, label: t.name, detail: t.lineItemType }));
    if (kind === 'deals')
      return (
        await tx.inventorySourceDeal.findMany({
          where: { partnerId: a.partnerId, status: { not: 'ARCHIVED' } },
          orderBy: { name: 'asc' },
          take: 200,
        })
      ).map((d) => ({ id: d.id, label: d.name, detail: d.dealType }));
    if (kind === 'dealGroups')
      return (
        await tx.dealGroup.findMany({
          where: { OR: [{ advertiserId: a.id }, { partnerId: a.partnerId }] },
          orderBy: { name: 'asc' },
        })
      ).map((g) => ({ id: g.id, label: g.name, detail: g.kind }));
    return [];
  });
  return Response.json({ data: items }, { headers: NO_STORE });
}
