// GET /api/dv/column-views?grid=&advertiserId=  POST (save)  DELETE ?id=  (module 11 K15)
import { z } from 'zod';
import { getSessionUser } from '@/lib/auth/session';
import { badRequest, NO_STORE, respond, unauthenticated } from '@/lib/bulk/api';
import { deleteView, listViews, saveView } from '@/lib/views/service';
import { serviceCtx } from '@/lib/campaigns/service-kit';
import { withSandbox } from '@/lib/db';

export const dynamic = 'force-dynamic';

const grid = z.enum(['CAMPAIGN', 'IO', 'LI']);
const saveSchema = z.object({
  grid,
  advertiserId: z.string().min(1),
  id: z.string().optional(),
  name: z.string(),
  columns: z.array(z.string()),
});

/** Advertiser public id or row id to the row id. */
async function advertiserRowId(userSandbox: string, id: string): Promise<string | null> {
  return withSandbox(userSandbox, async (tx) => {
    const row = /^\d+$/.test(id) ? await tx.advertiser.findFirst({ where: { publicId: BigInt(id) }, select: { id: true } }) : await tx.advertiser.findFirst({ where: { id }, select: { id: true } });
    return row?.id ?? null;
  });
}

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user?.sandboxId) return unauthenticated();
  const q = new URL(req.url).searchParams;
  const g = grid.safeParse(q.get('grid'));
  const adv = q.get('advertiserId');
  if (!g.success || !adv) return badRequest('grid and advertiserId are required.');
  const rowId = await advertiserRowId((await serviceCtx(user)).sandboxId, adv);
  if (!rowId) return Response.json({ error: 'NOT_FOUND' }, { status: 404 });
  return Response.json({ data: await listViews(user, g.data, rowId) }, { headers: NO_STORE });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user?.sandboxId) return unauthenticated();
  const body = saveSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return badRequest('grid, advertiserId, name and columns are required.');
  const rowId = await advertiserRowId(user.sandboxId, body.data.advertiserId);
  if (!rowId) return Response.json({ error: 'NOT_FOUND' }, { status: 404 });
  return respond(await saveView(user, body.data.grid, rowId, body.data));
}

export async function DELETE(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthenticated();
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return badRequest('id is required.');
  return respond(await deleteView(user, id));
}
