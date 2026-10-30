// GET /api/dv/sdf/info?advertiserId= : the advertiser's SDF version for the dialogs (module 11 2.1, BLK-006).
import { getSessionUser } from '@/lib/auth/session';
import { badRequest, NO_STORE, unauthenticated } from '@/lib/bulk/api';
import { serviceCtx } from '@/lib/campaigns/service-kit';
import { withSandbox } from '@/lib/db';
import { fromDbVersion } from '@/lib/sdf/versions';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user?.sandboxId) return unauthenticated();
  const id = new URL(req.url).searchParams.get('advertiserId');
  if (!id) return badRequest('advertiserId is required.');
  const ctx = await serviceCtx(user);
  const adv = await withSandbox(ctx.sandboxId, (tx) =>
    tx.advertiser.findFirst({ where: /^\d+$/.test(id) ? { publicId: BigInt(id) } : { id }, select: { id: true, publicId: true, sdfVersion: true } }),
  );
  if (!adv) return Response.json({ error: 'NOT_FOUND' }, { status: 404 });
  return Response.json({ data: { advertiserId: adv.id, publicId: adv.publicId.toString(), version: fromDbVersion(adv.sdfVersion) } }, { headers: NO_STORE });
}
