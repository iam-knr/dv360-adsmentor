import 'server-only';
// Access plumbing of the planning services (module 04, RT 2): view is `entity.read` on the sandbox (REPORTING_ONLY gets
// NOT_FOUND for Plans), writes need `entity.write`. Cross-media reach has its own view rule (`REP`, see page guards).
import type { SessionUser } from '@/lib/auth/types';
import { withSandbox, type Tx } from '@/lib/db';
import { can } from '@/lib/rbac/can';
import { parseIdRef, whereId } from '@/lib/routes/params';
import { simDateIn } from '@/lib/metrics/date-range';
import {
  ADVERTISER_CTX_SELECT,
  forbidden,
  notFound,
  serviceCtx,
  type ServiceCtx,
} from '@/lib/campaigns/service-kit';

export const canWritePlans = (user: SessionUser): boolean =>
  !!user.sandboxId && can(user, 'write', { sandboxId: user.sandboxId });
export const canViewPlans = (user: SessionUser): boolean =>
  !!user.sandboxId && can(user, 'view', { sandboxId: user.sandboxId });

export async function readCtx<T>(
  user: SessionUser,
  fn: (tx: Tx, ctx: ServiceCtx) => Promise<T>,
): Promise<T> {
  if (!canViewPlans(user)) throw notFound();
  const ctx = await serviceCtx(user);
  return withSandbox(ctx.sandboxId, (tx) => fn(tx, ctx));
}

export async function writeCtx<T>(
  user: SessionUser,
  fn: (tx: Tx, ctx: ServiceCtx) => Promise<T>,
): Promise<T> {
  if (!canViewPlans(user)) throw notFound();
  if (!canWritePlans(user)) throw forbidden();
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
}

export async function loadAdvertiser(tx: Tx, aid: string): Promise<AdvertiserRow> {
  const ref = parseIdRef(aid);
  const row = ref
    ? await tx.advertiser.findFirst({
        where: whereId(ref),
        select: { ...ADVERTISER_CTX_SELECT, publicId: true, name: true, partnerId: true },
      })
    : null;
  if (!row) throw notFound();
  return row;
}

/** Sim today in the advertiser time zone. */
export const simToday = (ctx: ServiceCtx, adv: Pick<AdvertiserRow, 'timeZone'>): string =>
  simDateIn(ctx.simNow, adv.timeZone);

/** Seed of the sandbox market, used as the forecast seed (AC-04-28). */
export async function marketSeed(tx: Tx, sandboxId: string): Promise<string> {
  const s = await tx.sandbox.findUnique({ where: { id: sandboxId }, select: { seedValue: true } });
  return String(s?.seedValue ?? 0);
}

export { parseIdRef, whereId };
