import 'server-only';
// Access and context plumbing of the creative services (module 12 4.1). The view check is `entity.read` on the sandbox
// (REPORTING_ONLY gets NOT_FOUND, the 404 page); writes need `creative.write` (READ_ONLY and PARTNER_CLIENT do not have it).
import type { SessionUser } from '@/lib/auth/types';
import { withSandbox, type Tx } from '@/lib/db';
import { can } from '@/lib/rbac/can';
import { parseIdRef, whereId } from '@/lib/routes/params';
import {
  ADVERTISER_CTX_SELECT,
  advertiserSnapshot,
  forbidden,
  notFound,
  roleOf,
  serviceCtx,
  type ServiceCtx,
} from '@/lib/campaigns/service-kit';
import type { ValidationContext } from '@/lib/validation/types';

export const canWriteCreatives = (user: SessionUser): boolean =>
  !!user.sandboxId && can(user, 'write', { sandboxId: user.sandboxId, area: 'creatives' });

export const canViewCreatives = (user: SessionUser): boolean =>
  !!user.sandboxId && can(user, 'view', { sandboxId: user.sandboxId });

/** Run a read in the viewer's sandbox. Anyone who may not view gets NOT_FOUND (routes R10, REPORTING_ONLY). */
export async function readCtx<T>(
  user: SessionUser,
  fn: (tx: Tx, ctx: ServiceCtx) => Promise<T>,
): Promise<T> {
  if (!canViewCreatives(user)) throw notFound();
  const ctx = await serviceCtx(user);
  return withSandbox(ctx.sandboxId, (tx) => fn(tx, ctx));
}

export async function writeCtx<T>(
  user: SessionUser,
  fn: (tx: Tx, ctx: ServiceCtx) => Promise<T>,
): Promise<T> {
  if (!canViewCreatives(user)) throw notFound();
  if (!canWriteCreatives(user)) throw forbidden();
  const ctx = await serviceCtx(user);
  return withSandbox(ctx.sandboxId, (tx) => fn(tx, ctx));
}

export type AdvertiserRow = {
  id: string;
  partnerId: string;
  currencyCode: string;
  timeZone: string;
  status: string;
  demandGenFloodlightOptimization: boolean;
  googleInventoryEnabled: boolean;
};

/** Advertiser of the route segment (public id or row id), inside the sandbox. */
export async function loadAdvertiser(tx: Tx, aid: string): Promise<AdvertiserRow> {
  const ref = parseIdRef(aid);
  const row = ref
    ? await tx.advertiser.findFirst({
        where: whereId(ref),
        select: { ...ADVERTISER_CTX_SELECT, partnerId: true },
      })
    : null;
  if (!row) throw notFound();
  return row;
}

export function validationContext(
  ctx: ServiceCtx,
  adv: AdvertiserRow,
  mode: 'create' | 'edit',
  original?: unknown,
): ValidationContext {
  return {
    mode,
    now: ctx.simNow,
    actor: { userId: ctx.user.id, role: roleOf(ctx.user), limitedAccess: false },
    ...(original !== undefined ? { original } : {}),
    partner: { enabledExchangeIds: [] },
    advertiser: advertiserSnapshot(adv),
    lookups: {},
  };
}

export { parseIdRef, whereId };
