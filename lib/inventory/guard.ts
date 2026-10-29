import 'server-only';
// Access and context plumbing of the inventory services (module 13 4.4). The view check is `entity.read` on the
// sandbox (REPORTING_ONLY gets NOT_FOUND, the 404 page); writes need `entity.write`, which READ_ONLY and PARTNER_CLIENT
// do not have. (`inventory.write` of Δ13-9 has the same role matrix; lib/rbac belongs to P3-02, so it is not added.)
import type { SessionUser } from '@/lib/auth/types';
import { withSandbox, type Tx } from '@/lib/db';
import { can } from '@/lib/rbac/can';
import { parseIdRef, whereId } from '@/lib/routes/params';
import {
  ADVERTISER_CTX_SELECT,
  forbidden,
  notFound,
  serviceCtx,
  type ServiceCtx,
} from '@/lib/campaigns/service-kit';
import { ensureSandboxInventory } from './sandbox-seed';

export const canWriteInventory = (user: SessionUser): boolean =>
  !!user.sandboxId && can(user, 'write', { sandboxId: user.sandboxId });

export const canViewInventory = (user: SessionUser): boolean =>
  !!user.sandboxId && can(user, 'view', { sandboxId: user.sandboxId });

export async function readCtx<T>(
  user: SessionUser,
  fn: (tx: Tx, ctx: ServiceCtx) => Promise<T>,
): Promise<T> {
  if (!canViewInventory(user)) throw notFound();
  const ctx = await serviceCtx(user);
  return withSandbox(ctx.sandboxId, (tx) => fn(tx, ctx));
}

export async function writeCtx<T>(
  user: SessionUser,
  fn: (tx: Tx, ctx: ServiceCtx) => Promise<T>,
): Promise<T> {
  if (!canViewInventory(user)) throw notFound();
  if (!canWriteInventory(user)) throw forbidden();
  const ctx = await serviceCtx(user);
  return withSandbox(ctx.sandboxId, (tx) => fn(tx, ctx));
}

export interface AdvertiserRow {
  id: string;
  publicId: bigint;
  name: string;
  partnerId: string;
  currencyCode: string;
  timeZone: string;
  status: string;
}

/** Advertiser of the route segment (public id or row id) inside the sandbox; seeds the partner's inventory once. */
export async function loadAdvertiser(tx: Tx, ctx: ServiceCtx, aid: string): Promise<AdvertiserRow> {
  const ref = parseIdRef(aid);
  const row = ref
    ? await tx.advertiser.findFirst({
        where: whereId(ref),
        select: { ...ADVERTISER_CTX_SELECT, publicId: true, name: true, partnerId: true },
      })
    : null;
  if (!row) throw notFound();
  const sandbox = await tx.sandbox.findUnique({
    where: { id: ctx.sandboxId },
    select: { seedTemplateKey: true },
  });
  await ensureSandboxInventory(tx, {
    sandboxId: ctx.sandboxId,
    partnerId: row.partnerId,
    templateKey: sandbox?.seedTemplateKey ?? 'blank',
    simNow: ctx.simNow,
  });
  return row;
}

export { parseIdRef, whereId };
