import 'server-only';
// Shared plumbing of the campaign and insertion order services (module 06 4, module 07 4): the acting user, the
// sandbox and sim clock, the Prisma-backed validation context loader and the Result shape (routes.md 8.0).
import type { Prisma } from '@prisma/client';
import type { SessionUser } from '@/lib/auth/types';
import type { ChangeCtx } from '@/lib/changelog';
import { withSandbox, type Tx } from '@/lib/db';
import { can } from '@/lib/rbac/can';
import type { CurrencyCode } from '@/lib/money';
import type { ContextLoader } from '@/lib/validation/server/context';
import type {
  AdvertiserSnapshot,
  CampaignSnapshot,
  Issue,
  IoSnapshot,
  LineItemSnapshot,
  RoleKey,
} from '@/lib/validation';
import { toWireIssues, type ServiceError, type WireIssue } from './wire';

export type { WireIssue } from './wire';

/** Next.js turns an error with this digest into the 403 page (app/forbidden.tsx) instead of the error boundary. */
const HTTP_403_DIGEST = 'NEXT_HTTP_ERROR_FALLBACK;403';

export class ServiceFailure extends Error {
  /** Read by Next.js when the failure escapes a page: a FORBIDDEN one renders "You do not have access" with HTTP 403. */
  readonly digest?: string;
  constructor(
    readonly code: ServiceError,
    readonly issues: WireIssue[] = [],
  ) {
    super(code);
    this.name = 'ServiceFailure';
    if (code === 'FORBIDDEN') this.digest = HTTP_403_DIGEST;
  }
}

export const forbidden = () => new ServiceFailure('FORBIDDEN');
export const notFound = () => new ServiceFailure('NOT_FOUND');
export const conflict = () =>
  new ServiceFailure('CONFLICT', [
    {
      path: '*',
      severity: 'error',
      code: 'CONFLICT',
      message:
        'Someone else saved changes while you were editing. Reload to see the latest version.',
    },
  ]);
export const invalid = (issues: Issue[]) =>
  new ServiceFailure('INVALID', toWireIssues(issues.filter((i) => i.blocking)));

export interface ServiceCtx {
  user: SessionUser;
  sandboxId: string;
  classroomId: string;
  /** Simulated now (ENG 1.2). "Today" for the rules is this instant in the advertiser time zone. */
  simNow: Date;
}

const HOUR_MS = 3_600_000;

/** Resolve the sandbox, classroom and sim clock of the person acting. No sandbox: forbidden. */
export async function serviceCtx(user: SessionUser): Promise<ServiceCtx> {
  const sandboxId = user.sandboxId;
  if (!sandboxId) throw forbidden();
  const row = await withSandbox(sandboxId, (tx) =>
    tx.sandbox.findUnique({
      where: { id: sandboxId },
      select: { classroomId: true, clock: { select: { simStart: true, tickIndex: true } } },
    }),
  );
  if (!row) throw forbidden();
  const clock = row.clock;
  const simNow = clock
    ? new Date(clock.simStart.getTime() + Number(clock.tickIndex) * HOUR_MS)
    : new Date();
  return { user, sandboxId, classroomId: row.classroomId, simNow };
}

export function canWrite(user: SessionUser, sandboxId: string): boolean {
  return can(user, 'write', { sandboxId });
}

export function canRead(user: SessionUser, sandboxId: string): boolean {
  return can(user, 'view', { sandboxId });
}

export function assertWrite(ctx: ServiceCtx): void {
  if (!canWrite(ctx.user, ctx.sandboxId)) throw forbidden();
}

export function assertRead(ctx: ServiceCtx): void {
  if (!canRead(ctx.user, ctx.sandboxId)) throw notFound();
}

export function roleOf(user: SessionUser): RoleKey {
  return user.dvRole;
}

export function changeCtx(
  ctx: ServiceCtx,
  tx: Tx,
  extra: Partial<Pick<ChangeCtx, 'note' | 'source' | 'bulkJobId'>> = {},
): ChangeCtx {
  const actor = ctx.user.actor ?? ctx.user;
  return {
    sandboxId: ctx.sandboxId,
    classroomId: ctx.classroomId,
    actor: { type: 'USER', userId: actor.id, label: actor.name || actor.email },
    tx,
    ...(extra.note?.trim() ? { note: extra.note.trim() } : {}),
    ...(extra.source ? { source: extra.source } : {}),
    ...(extra.bulkJobId ? { bulkJobId: extra.bulkJobId } : {}),
  };
}

/** Run a service body in the sandbox transaction; turn failures into `Result` (routes.md 8.0). */
export type Result<T> =
  | { ok: true; data: T; warnings?: WireIssue[] }
  | { ok: false; code: ServiceError; issues: WireIssue[] };

export async function asResult<T>(
  fn: () => Promise<{ data: T; warnings?: WireIssue[] }>,
): Promise<Result<T>> {
  try {
    const { data, warnings } = await fn();
    return warnings && warnings.length ? { ok: true, data, warnings } : { ok: true, data };
  } catch (e) {
    if (e instanceof ServiceFailure) return { ok: false, code: e.code, issues: e.issues };
    throw e;
  }
}

// ---------------------------------------------------------------------------------------------
// Dates. DB columns are @db.Date; the wire and the rules use YYYY-MM-DD.
// ---------------------------------------------------------------------------------------------

export function toDbDate(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

export function fromDbDate(d: Date | null | undefined): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

export function decimalToNumber(d: Prisma.Decimal | null | undefined): number | null {
  return d === null || d === undefined ? null : Number(d.toString());
}

// ---------------------------------------------------------------------------------------------
// Validation context loader (lib/validation/server/context.ts ContextLoader), reading inside one transaction.
// ---------------------------------------------------------------------------------------------

export interface LoaderParts {
  advertiser: {
    currencyCode: string;
    timeZone: string;
    demandGenFloodlightOptimization: boolean;
    googleInventoryEnabled: boolean;
  };
  campaign?: CampaignSnapshot;
  io?: IoSnapshot;
  original?: unknown;
  lineItems?: LineItemSnapshot[];
}

export function advertiserSnapshot(a: LoaderParts['advertiser']): AdvertiserSnapshot {
  return {
    currency: a.currencyCode as CurrencyCode,
    timeZone: a.timeZone,
    demandGenFloodlightOptimization: a.demandGenFloodlightOptimization,
    googleInventoryEnabled: a.googleInventoryEnabled,
    appAttributionLinked: false,
    attributionModelIds: [],
  };
}

/** A ContextLoader over values the service already read (one transaction, no second round trip). */
export function staticLoader(simNow: Date, parts: LoaderParts): ContextLoader {
  return {
    now: () => simNow,
    partner: () => Promise.resolve({ enabledExchangeIds: [] }),
    advertiser: () => Promise.resolve(advertiserSnapshot(parts.advertiser)),
    campaign: () => Promise.resolve(parts.campaign),
    io: () => Promise.resolve(parts.io),
    original: () => Promise.resolve(parts.original),
    children: () => Promise.resolve(parts.lineItems ? { lineItems: parts.lineItems } : undefined),
    lookups: () => Promise.resolve({}),
  };
}

export const ADVERTISER_CTX_SELECT = {
  id: true,
  currencyCode: true,
  timeZone: true,
  status: true,
  demandGenFloodlightOptimization: true,
  googleInventoryEnabled: true,
} as const;
