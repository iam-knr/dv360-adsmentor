import 'server-only';
// Access plumbing of the History services (module 05): read needs `view`, notes need `write` (C-05-8). A person
// without a sandbox or below the view level gets NOT_FOUND, the same as a missing entity.
import type { EntityType } from '@prisma/client';
import type { SessionUser } from '@/lib/auth/types';
import { withSandbox, type Tx } from '@/lib/db';
import { can } from '@/lib/rbac/can';
import { parseIdRef, whereId } from '@/lib/routes/params';
import { forbidden, notFound, serviceCtx, type ServiceCtx } from '@/lib/campaigns/service-kit';

export const canWriteNotes = (user: SessionUser): boolean =>
  !!user.sandboxId && can(user, 'write', { sandboxId: user.sandboxId });

export async function readCtx<T>(
  user: SessionUser,
  fn: (tx: Tx, ctx: ServiceCtx) => Promise<T>,
): Promise<T> {
  if (!user.sandboxId || !can(user, 'view', { sandboxId: user.sandboxId })) throw notFound();
  const ctx = await serviceCtx(user);
  return withSandbox(ctx.sandboxId, (tx) => fn(tx, ctx));
}

export async function writeCtx<T>(
  user: SessionUser,
  fn: (tx: Tx, ctx: ServiceCtx) => Promise<T>,
): Promise<T> {
  if (!user.sandboxId || !can(user, 'view', { sandboxId: user.sandboxId })) throw notFound();
  if (!canWriteNotes(user)) throw forbidden();
  const ctx = await serviceCtx(user);
  return withSandbox(ctx.sandboxId, (tx) => fn(tx, ctx));
}

export interface EntityScope {
  type: EntityType;
  id: string;
  name: string;
  advertiserId: string;
  /** Where clause on ChangeGroup / SimDailyMetric ownership. */
  scope:
    | { advertiserId: string }
    | { campaignId: string }
    | { ioId: string }
    | { lineItemId: string };
  lineItemWhere: { advertiserId: string } | { campaignId: string } | { ioId: string } | { id: string };
}

/** Resolve a History entity (public or row id) to its scope and advertiser. NOT_FOUND for anything else. */
export async function loadEntity(
  tx: Tx,
  type: EntityType,
  entityId: string,
): Promise<EntityScope> {
  const ref = parseIdRef(entityId);
  if (!ref) throw notFound();
  const where = whereId(ref);
  switch (type) {
    case 'ADVERTISER': {
      const r = await tx.advertiser.findFirst({ where, select: { id: true, name: true } });
      if (!r) throw notFound();
      return {
        type, id: r.id, name: r.name, advertiserId: r.id,
        scope: { advertiserId: r.id }, lineItemWhere: { advertiserId: r.id },
      };
    }
    case 'CAMPAIGN': {
      const r = await tx.campaign.findFirst({ where, select: { id: true, name: true, advertiserId: true } });
      if (!r) throw notFound();
      return {
        type, id: r.id, name: r.name, advertiserId: r.advertiserId,
        scope: { campaignId: r.id }, lineItemWhere: { campaignId: r.id },
      };
    }
    case 'INSERTION_ORDER': {
      const r = await tx.insertionOrder.findFirst({ where, select: { id: true, name: true, advertiserId: true } });
      if (!r) throw notFound();
      return {
        type, id: r.id, name: r.name, advertiserId: r.advertiserId,
        scope: { ioId: r.id }, lineItemWhere: { ioId: r.id },
      };
    }
    case 'LINE_ITEM': {
      const r = await tx.lineItem.findFirst({ where, select: { id: true, name: true, advertiserId: true } });
      if (!r) throw notFound();
      return {
        type, id: r.id, name: r.name, advertiserId: r.advertiserId,
        scope: { lineItemId: r.id }, lineItemWhere: { id: r.id },
      };
    }
    default:
      throw notFound();
  }
}
