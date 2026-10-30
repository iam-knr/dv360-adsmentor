import 'server-only';
// Chart views (module 11 K16): the card list of a scope and a person, as `ChartCard` rows. Save replaces the list.
import type { SessionUser } from '@/lib/auth/types';
import { withSandbox } from '@/lib/db';
import { assertRead, assertWrite, asResult, serviceCtx, ServiceFailure, type Result } from '@/lib/campaigns/service-kit';
import { parseIdRef, whereId } from '@/lib/routes/params';
import { LIMITS } from '@/lib/validation/constants/limits';
import { validateCards, type ChartCardSpec, type ChartScope } from './spec';

const DB_SCOPE = { CAMPAIGN: 'CAMPAIGN', IO: 'IO', LI: 'LI' } as const;
const owner = (user: SessionUser) => (user.actor ?? user).id;

export interface ChartView {
  cards: ChartCardSpec[];
  shared: boolean;
  /** Another person's shared view: read only, "Save a copy". */
  readOnly: boolean;
  ownerId: string | null;
}

async function resolveScope(tx: Parameters<Parameters<typeof withSandbox>[1]>[0], scope: ChartScope, scopeId: string) {
  const ref = parseIdRef(scopeId);
  if (!ref) throw new ServiceFailure('NOT_FOUND');
  if (scope === 'CAMPAIGN') {
    const r = await tx.campaign.findFirst({ where: whereId(ref), select: { id: true, advertiserId: true } });
    if (r) return { id: r.id, advertiserId: r.advertiserId };
  } else if (scope === 'IO') {
    const r = await tx.insertionOrder.findFirst({ where: whereId(ref), select: { id: true, advertiserId: true } });
    if (r) return { id: r.id, advertiserId: r.advertiserId };
  } else if (scope === 'LI') {
    const r = await tx.lineItem.findFirst({ where: whereId(ref), select: { id: true, advertiserId: true } });
    if (r) return { id: r.id, advertiserId: r.advertiserId };
  }
  throw new ServiceFailure('NOT_FOUND');
}

export async function getChartView(
  user: SessionUser,
  scope: Exclude<ChartScope, 'ADVERTISER'>,
  scopeId: string,
  opts: { viewKey?: string; viewOwner?: string } = {},
): Promise<ChartView> {
  const ctx = await serviceCtx(user);
  assertRead(ctx);
  return withSandbox(ctx.sandboxId, async (tx) => {
    const target = await resolveScope(tx, scope, scopeId);
    const viewKey = opts.viewKey ?? 'default';
    const ownerId = opts.viewOwner ?? owner(user);
    const rows = await tx.chartCard.findMany({
      where: { scope: DB_SCOPE[scope], scopeId: target.id, viewKey, ownerUserId: ownerId, ...(ownerId === owner(user) ? {} : { sharedWithSandbox: true }) },
      orderBy: { ordinal: 'asc' },
    });
    return {
      cards: rows.map((r) => ({ ...(r.definition as unknown as ChartCardSpec), id: r.id, ordinal: r.ordinal })),
      shared: rows.some((r) => r.sharedWithSandbox),
      readOnly: ownerId !== owner(user),
      ownerId: rows.length ? ownerId : null,
    };
  });
}

/** Save replaces the card list for (scope, view key, person). `share` marks the list visible to the sandbox. */
export async function saveChartView(
  user: SessionUser,
  scope: Exclude<ChartScope, 'ADVERTISER'>,
  scopeId: string,
  cards: ChartCardSpec[],
  opts: { viewKey?: string; share?: boolean } = {},
): Promise<Result<{ count: number }>> {
  return asResult(async () => {
    const ctx = await serviceCtx(user);
    assertWrite(ctx);
    const problem = validateCards(cards, LIMITS.CHART_NOTE_MAX, LIMITS.CHARTS_MAX_CARDS);
    if (problem) throw new ServiceFailure('INVALID', [{ path: 'cards', severity: 'error', code: 'CHART', message: problem }]);
    await withSandbox(ctx.sandboxId, async (tx) => {
      const target = await resolveScope(tx, scope, scopeId);
      const viewKey = opts.viewKey ?? 'default';
      await tx.chartCard.deleteMany({ where: { scope: DB_SCOPE[scope], scopeId: target.id, viewKey, ownerUserId: owner(user) } });
      if (cards.length)
        await tx.chartCard.createMany({
          data: cards.map((c, i) => ({
            sandboxId: ctx.sandboxId,
            advertiserId: target.advertiserId,
            ownerUserId: owner(user),
            scope: DB_SCOPE[scope],
            scopeId: target.id,
            kind: c.kind,
            viewKey,
            definition: JSON.parse(JSON.stringify(c)),
            ordinal: i,
            sharedWithSandbox: !!opts.share,
          })),
        });
    });
    return { data: { count: cards.length } };
  });
}

export async function resetChartView(user: SessionUser, scope: Exclude<ChartScope, 'ADVERTISER'>, scopeId: string, viewKey = 'default') {
  return saveChartView(user, scope, scopeId, [], { viewKey });
}
