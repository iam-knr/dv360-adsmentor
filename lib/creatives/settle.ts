import 'server-only';
// Settling of appeals (module 12 4.5 item 3). The engine's structural sync decides exchange reviews through `decideAt`
// (lib/engine/io/structural.ts), but nothing decides an appeal, so the creative service closes due appeals whenever an
// appeal-aware page is read (library, creative page, status tab, appeal history). Deterministic: the outcome is a hash
// of the sandbox seed, creative, exchange and round (`appealSchedule`). Written by the CREATIVE_APPROVAL_SYNC actor.
import { withChangeLog } from '@/lib/changelog';
import type { EntityRegistry, Image } from '@/lib/changelog';
import type { Tx } from '@/lib/db';
import type { ServiceCtx } from '@/lib/campaigns/service-kit';
import { sandboxSeed } from './load';
import { appealSchedule } from './review';

const slug = (code: string): string => code.replace(/[^A-Za-z0-9_-]+/g, '-');

type ExchangeRef = { id: string; code: string; name: string };

/** Registry whose image is the DV360 review plus one approval status per exchange (shared with structural.ts's shape). */
export function approvalRegistry(
  sandboxId: string,
  exchanges: Map<string, ExchangeRef>,
  ids: string[],
): EntityRegistry {
  const pathOf = (exchangeId: string) =>
    `exchange[${slug(exchanges.get(exchangeId)?.code ?? exchangeId)}].approvalStatus`;
  return {
    entityType: 'CREATIVE',
    model: 'Creative',
    noun: 'creative',
    version: 1,
    fields: [
      { path: 'id', label: 'ID', kind: 'scalar', ignore: true },
      { path: 'name', label: 'Name', kind: 'text', ignore: true },
      { path: 'publicId', label: 'Creative ID', kind: 'scalar', ignore: true },
      { path: 'dv360Status', label: 'Display & Video 360 review status', kind: 'enum' },
      ...ids.map((id) => ({
        path: pathOf(id),
        label: `${exchanges.get(id)?.name ?? id} approval status`,
        kind: 'enum' as const,
      })),
    ],
    load: async (t, id): Promise<Image | null> => {
      const c = await t.creative.findUnique({
        where: { id },
        select: { id: true, name: true, publicId: true, dv360Review: true },
      });
      if (!c) return null;
      const rows = await t.creativeReview.findMany({ where: { creativeId: id, sandboxId } });
      const image: Image = {
        id: c.id,
        name: c.name,
        publicId: c.publicId,
        dv360Status: c.dv360Review,
      };
      for (const r of rows) image[pathOf(r.exchangeId)] = r.status;
      return image;
    },
  };
}

export async function allExchanges(tx: Tx): Promise<Map<string, ExchangeRef>> {
  const rows = await tx.exchange.findMany({ select: { id: true, code: true, name: true } });
  return new Map(rows.map((e) => [e.id, e]));
}

/** Close every due appeal of the advertiser. Idempotent: a closed appeal is not touched again. */
export async function settleAppeals(
  tx: Tx,
  ctx: ServiceCtx,
  advertiserId: string,
): Promise<number> {
  const due = await tx.creativeAppeal.findMany({
    where: {
      sandboxId: ctx.sandboxId,
      status: 'OPEN',
      decideAt: { not: null, lte: ctx.simNow },
      creative: { advertiserId },
    },
    orderBy: [{ decideAt: 'asc' }, { id: 'asc' }],
  });
  if (due.length === 0) return 0;
  const seed = await sandboxSeed(tx, ctx.sandboxId);
  const exchanges = await allExchanges(tx);
  for (const appeal of due) {
    const creativeId = appeal.creativeId;
    if (!creativeId) continue;
    const earlier = await tx.creativeAppeal.count({
      where: { creativeId, exchangeId: appeal.exchangeId, createdAt: { lt: appeal.createdAt } },
    });
    const accepted = appealSchedule(
      seed,
      creativeId,
      appeal.exchangeId ?? 'dv360',
      earlier,
      ctx.simNow,
    ).accepted;
    const decidedAt = appeal.decideAt!;
    const reviews = await tx.creativeReview.findMany({
      where: { creativeId, sandboxId: ctx.sandboxId },
    });
    const touched = appeal.exchangeId
      ? reviews.filter((r) => r.exchangeId === appeal.exchangeId)
      : reviews.filter((r) => r.status === 'PENDING');
    const creative = await tx.creative.findUniqueOrThrow({
      where: { id: creativeId },
      select: { advertiserId: true },
    });
    await withChangeLog(
      {
        sandboxId: ctx.sandboxId,
        classroomId: ctx.classroomId,
        actor: { type: 'SYSTEM', systemActor: 'CREATIVE_APPROVAL_SYNC' },
        source: 'ENGINE',
        now: decidedAt,
        tx,
      },
      { type: 'CREATIVE', id: creativeId, chain: { advertiserId: creative.advertiserId } },
      async (t) => {
        if (touched.length)
          await t.creativeReview.updateMany({
            where: { id: { in: touched.map((r) => r.id) } },
            data: {
              status: accepted ? 'APPROVED' : 'DISAPPROVED',
              ...(accepted ? { sslStatus: 'APPROVED' as const } : {}),
              lastSyncAt: decidedAt,
              decideAt: null,
            },
          });
        if (!appeal.exchangeId)
          await t.creative.update({
            where: { id: creativeId },
            data: {
              dv360Review: accepted ? 'SERVABLE' : 'NOT_SERVABLE',
              dv360Feedback: accepted ? 'Creative is servable' : 'The appeal was not accepted.',
              reviewCompletedAt: decidedAt,
            },
          });
        await t.creativeAppeal.update({
          where: { id: appeal.id },
          data: {
            status: accepted ? 'ACCEPTED' : 'REJECTED',
            completedAt: decidedAt,
            result: accepted ? 'Approved' : 'Disapproved',
          },
        });
        return { id: creativeId };
      },
      {
        registry: approvalRegistry(
          ctx.sandboxId,
          exchanges,
          reviews.map((r) => r.exchangeId),
        ),
      },
    );
  }
  return due.length;
}
