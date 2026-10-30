import 'server-only';
// Access plumbing of the experiment services (module 17 4.6): view is `entity.read` (REPORTING_ONLY gets 404 at the page
// guard), create, edit, end and add flight need `entity.write`.
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

export const canWriteExperiments = (user: SessionUser): boolean =>
  !!user.sandboxId && can(user, 'write', { sandboxId: user.sandboxId });
export const canViewExperiments = (user: SessionUser): boolean =>
  !!user.sandboxId && can(user, 'view', { sandboxId: user.sandboxId });

export async function readCtx<T>(
  user: SessionUser,
  fn: (tx: Tx, ctx: ServiceCtx) => Promise<T>,
): Promise<T> {
  if (!canViewExperiments(user)) throw notFound();
  const ctx = await serviceCtx(user);
  return withSandbox(ctx.sandboxId, (tx) => fn(tx, ctx));
}

export async function writeCtx<T>(
  user: SessionUser,
  fn: (tx: Tx, ctx: ServiceCtx) => Promise<T>,
): Promise<T> {
  if (!canViewExperiments(user)) throw notFound();
  if (!canWriteExperiments(user)) throw forbidden();
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

export const simToday = (ctx: ServiceCtx, adv: Pick<AdvertiserRow, 'timeZone'>): string =>
  simDateIn(ctx.simNow, adv.timeZone);

export { parseIdRef, whereId };
