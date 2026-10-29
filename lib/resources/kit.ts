import 'server-only';
// Shared plumbing of the resource services (module 15 4): write check on the resources area, id parsing, the
// minimal validation context the CH/KW/LOC/FL rules need, and issue helpers. Built on the campaign service kit.
import type { Tx } from '@/lib/db';
import { can } from '@/lib/rbac/can';
import { parseIdRef, whereId } from '@/lib/routes/params';
import type { WireIssue } from '@/lib/campaigns/wire';
import type { Issue, ValidationContext } from '@/lib/validation';
import {
  advertiserSnapshot,
  forbidden,
  invalid,
  notFound,
  roleOf,
  type ServiceCtx,
} from '@/lib/campaigns/service-kit';

export {
  asResult,
  changeCtx,
  conflict,
  forbidden,
  invalid,
  notFound,
  serviceCtx,
  ServiceFailure,
  type Result,
  type ServiceCtx,
} from '@/lib/campaigns/service-kit';

export function assertResourceWrite(ctx: ServiceCtx): void {
  if (!can(ctx.user, 'write', { sandboxId: ctx.sandboxId, area: 'resources' })) throw forbidden();
}

/** Resources are readable by everyone but REPORTING_ONLY, who get the 404 page (module 15 4.6). */
export function assertResourceRead(ctx: ServiceCtx): void {
  if (!can(ctx.user, 'view', { sandboxId: ctx.sandboxId, area: 'resources' })) throw notFound();
}

export function idWhere(seg: string): { publicId: bigint } | { id: string } {
  const ref = parseIdRef(seg);
  if (!ref) throw notFound();
  return whereId(ref);
}

export interface AdvertiserRow {
  id: string;
  publicId: bigint;
  partnerId: string;
  name: string;
  currencyCode: string;
  timeZone: string;
  demandGenFloodlightOptimization: boolean;
  googleInventoryEnabled: boolean;
  floodlightGroupId: string | null;
}

export const ADVERTISER_SELECT = {
  id: true,
  publicId: true,
  partnerId: true,
  name: true,
  currencyCode: true,
  timeZone: true,
  demandGenFloodlightOptimization: true,
  googleInventoryEnabled: true,
  floodlightGroupId: true,
} as const;

export async function loadAdvertiser(tx: Tx, aid: string): Promise<AdvertiserRow> {
  const a = await tx.advertiser.findFirst({ where: idWhere(aid), select: ADVERTISER_SELECT });
  if (!a) throw notFound();
  return a;
}

export async function loadPartner(
  tx: Tx,
  pid: string,
): Promise<{ id: string; publicId: bigint; name: string }> {
  const p = await tx.partner.findFirst({
    where: idWhere(pid),
    select: { id: true, publicId: true, name: true },
  });
  if (!p) throw notFound();
  return p;
}

/** Country the geocoder places addresses in, from the advertiser currency `[SIM]`. */
export function countryOf(currencyCode: string): string {
  return currencyCode === 'USD' ? 'US' : currencyCode === 'SGD' ? 'SG' : 'IN';
}

/** The context the resource rules read: mode, clock, actor and the advertiser snapshot. */
export function resourceContext(
  ctx: ServiceCtx,
  adv: Pick<
    AdvertiserRow,
    'currencyCode' | 'timeZone' | 'demandGenFloodlightOptimization' | 'googleInventoryEnabled'
  >,
  mode: 'create' | 'edit',
): ValidationContext {
  const limited = ctx.user.dvRole === 'READ_ONLY' || ctx.user.dvRole === 'PARTNER_CLIENT';
  return {
    mode,
    now: ctx.simNow,
    actor: { userId: ctx.user.id, role: roleOf(ctx.user), limitedAccess: limited },
    partner: { enabledExchangeIds: [] },
    advertiser: advertiserSnapshot(adv),
    lookups: {},
  };
}

export const blocking = (issues: Issue[]): boolean => issues.some((i) => i.blocking);

export function raise(issues: Issue[]): never {
  throw invalid(issues);
}

export function softIssues(issues: Issue[]): WireIssue[] {
  return issues
    .filter((i) => !i.blocking && i.message)
    .map((i) => ({ path: i.path, severity: i.severity, code: i.ruleId, message: i.message }));
}

export function singleIssue(path: string, code: string, message: string): never {
  throw invalid([{ ruleId: code, severity: 'error', path, message, blocking: true }]);
}
