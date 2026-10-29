import 'server-only';
// Plumbing of the settings services: the shared service kit of the campaign module plus permission and id helpers.
import type { Tx } from '@/lib/db';
import { can, type Action } from '@/lib/rbac/can';
import { parseIdRef, whereId } from '@/lib/routes/params';
import {
  ServiceFailure,
  asResult,
  changeCtx,
  conflict,
  forbidden,
  notFound,
  serviceCtx,
  type Result,
  type ServiceCtx,
} from '@/lib/campaigns/service-kit';
import type { SettingsIssue } from './rules';

export { ServiceFailure, asResult, changeCtx, conflict, forbidden, notFound, serviceCtx };
export type { Result, ServiceCtx };

/** Throw FORBIDDEN unless the person holds the permission in their sandbox. */
export function assertCan(ctx: ServiceCtx, action: Action): void {
  if (!can(ctx.user, action, { sandboxId: ctx.sandboxId })) throw forbidden();
}

export function mayDo(ctx: ServiceCtx, action: Action): boolean {
  return can(ctx.user, action, { sandboxId: ctx.sandboxId });
}

export function failIf(issues: SettingsIssue[]): void {
  const blocking = issues.filter((i) => i.severity === 'error');
  if (blocking.length) throw new ServiceFailure('INVALID', blocking);
}

export function warningsOf(issues: SettingsIssue[]): SettingsIssue[] {
  return issues.filter((i) => i.severity !== 'error');
}

/** Row ids and public ids both resolve (routes.md 6.4). Unparseable ids are "not found". */
export function idWhere(id: string): { publicId: bigint } | { id: string } {
  const ref = parseIdRef(id);
  if (!ref) throw notFound();
  return whereId(ref);
}

export async function loadPartner(tx: Tx, pid: string) {
  const p = await tx.partner.findFirst({ where: idWhere(pid) });
  if (!p) throw notFound();
  return p;
}

export async function loadAdvertiser(tx: Tx, aid: string) {
  const a = await tx.advertiser.findFirst({ where: idWhere(aid) });
  if (!a) throw notFound();
  return a;
}

export function checkVersion(stored: number, expected: number | undefined): void {
  if (expected !== undefined && expected !== stored) throw conflict();
}

export interface WriteMeta {
  expectedVersion?: number;
  note?: string;
}

/** `limitedAccess` chip: READ_ONLY and PARTNER_CLIENT (DS Q14). */
export const isLimited = (ctx: ServiceCtx) =>
  ctx.user.dvRole === 'READ_ONLY' || ctx.user.dvRole === 'PARTNER_CLIENT';

/**
 * `Advertiser.thirdPartyConfig` doubles as the audit trail of the child tables this module owns (alert preferences,
 * linked accounts, certificates, vendors): the Advertiser registry is a column-for-column mirror (its test enforces
 * it), so a child change is logged by merging a compact summary into this json column.
 */
export function mergeConfig(
  current: unknown,
  patch: Record<string, unknown>,
): Record<string, never> {
  const base =
    current && typeof current === 'object' && !Array.isArray(current)
      ? (current as Record<string, unknown>)
      : {};
  return { ...base, ...patch } as Record<string, never>;
}
