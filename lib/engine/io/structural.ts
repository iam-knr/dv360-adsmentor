// Structural engine edits (RC-031): only edits that change stored configuration are logged, through withChangeLog with
// source ENGINE and a system actor. Automation state (budget weights, learning, throttle) lives in SimState and is
// never logged.
//
// Creative review sync: an exchange review that is PENDING with a decideAt in the past is decided. A creative DV360
// marked NOT_SERVABLE is disapproved, every other one approved (the review delay itself is set by the creative
// service through decideAt, module 12). The decision is logged as CREATIVE_APPROVAL_SYNC, one group per creative.
//
// Not built: a flight-end status flip. EntityStatus has no "completed" value and the core derives ENDED from the dates
// (liveStatus), so no stored flip exists to log.
import { withChangeLog } from '@/lib/changelog';
import type { EntityRegistry, Image } from '@/lib/changelog';
import type { Tx } from '@/lib/db';

export interface SyncCtx {
  sandboxId: string;
  classroomId: string;
}

const slug = (code: string): string => code.replace(/[^A-Za-z0-9_-]+/g, '-');

export async function syncCreativeReviews(tx: Tx, ctx: SyncCtx, simNowMs: number): Promise<number> {
  const due = await tx.creativeReview.findMany({
    where: {
      sandboxId: ctx.sandboxId,
      status: 'PENDING',
      decideAt: { not: null, lte: new Date(simNowMs) },
    },
    select: { creativeId: true },
    distinct: ['creativeId'],
    orderBy: { creativeId: 'asc' },
  });
  if (due.length === 0) return 0;
  const exchanges = await tx.exchange.findMany({ select: { id: true, code: true, name: true } });
  const exchangeById = new Map(exchanges.map((e) => [e.id, e]));
  let decided = 0;

  for (const { creativeId } of due) {
    const creative = await tx.creative.findUnique({
      where: { id: creativeId },
      select: { id: true, name: true, publicId: true, advertiserId: true, dv360Review: true },
    });
    if (!creative) continue;
    const reviews = await tx.creativeReview.findMany({
      where: { creativeId, sandboxId: ctx.sandboxId },
      orderBy: { exchangeId: 'asc' },
    });
    const registry: EntityRegistry = {
      entityType: 'CREATIVE',
      model: 'Creative',
      noun: 'creative',
      version: 1,
      fields: [
        { path: 'id', label: 'ID', kind: 'scalar', ignore: true },
        { path: 'name', label: 'Name', kind: 'text', ignore: true },
        { path: 'publicId', label: 'Creative ID', kind: 'scalar', ignore: true },
        ...reviews.map((r) => {
          const ex = exchangeById.get(r.exchangeId);
          return {
            path: `exchange[${slug(ex?.code ?? r.exchangeId)}].approvalStatus`,
            label: `${ex?.name ?? r.exchangeId} approval status`,
            kind: 'enum' as const,
          };
        }),
      ],
      load: async (t, id): Promise<Image | null> => {
        const c = await t.creative.findUnique({
          where: { id },
          select: { id: true, name: true, publicId: true },
        });
        if (!c) return null;
        const rows = await t.creativeReview.findMany({
          where: { creativeId: id, sandboxId: ctx.sandboxId },
        });
        const image: Image = { id: c.id, name: c.name, publicId: c.publicId };
        for (const r of rows) {
          const ex = exchangeById.get(r.exchangeId);
          image[`exchange[${slug(ex?.code ?? r.exchangeId)}].approvalStatus`] = r.status;
        }
        return image;
      },
    };
    const verdict = creative.dv360Review === 'NOT_SERVABLE' ? 'DISAPPROVED' : 'APPROVED';
    await withChangeLog(
      {
        sandboxId: ctx.sandboxId,
        classroomId: ctx.classroomId,
        actor: { type: 'SYSTEM', systemActor: 'CREATIVE_APPROVAL_SYNC' },
        source: 'ENGINE',
        now: new Date(simNowMs),
        tx,
      },
      { type: 'CREATIVE', id: creativeId, chain: { advertiserId: creative.advertiserId } },
      async (t) => {
        await t.creativeReview.updateMany({
          where: {
            creativeId,
            sandboxId: ctx.sandboxId,
            status: 'PENDING',
            decideAt: { not: null, lte: new Date(simNowMs) },
          },
          data: { status: verdict, lastSyncAt: new Date(simNowMs) },
        });
      },
      { registry },
    );
    decided++;
  }
  return decided;
}
