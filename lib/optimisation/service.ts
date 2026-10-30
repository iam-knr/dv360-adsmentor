import 'server-only';
// Intelligence read model and suggestion actions (module 01 4.8, module 11 2.8, 4.9; T11-14, T11-15, 01-T12).
// Reads open `Alert` and `Recommendation` rows of one scope; Apply goes through the single-entity services so the
// validation and the change log are the normal code path; Dismiss hides a suggestion for seven sim days.
import type { SessionUser } from '@/lib/auth/types';
import { withSandbox, type Tx } from '@/lib/db';
import {
  assertRead,
  assertWrite,
  asResult,
  invalid,
  notFound,
  ServiceFailure,
  serviceCtx,
  type Result,
} from '@/lib/campaigns/service-kit';
import { getInsertionOrder, updateInsertionOrder } from '@/lib/insertion-orders/service';
import { getLineItemDetail, updateLineItem } from '@/lib/line-items/service';
import { explainConflicts, type ConflictExplanation } from './conflicts';
import { SUGGESTIONS } from './catalog';
import {
  healthRows,
  suggestionRows,
  type AlertFacts,
  type HealthRowData,
  type SuggestionFacts,
  type SuggestionPaths,
  type SuggestionRowData,
} from './health';
import { advertiserPath, campaignPath, ioPath, liPath } from '@/lib/routes/paths';

export type IntelligenceScope = 'advertiser' | 'campaign' | 'io' | 'li';

export interface IntelligenceData {
  scope: IntelligenceScope;
  healthTitle: 'ADVERTISER HEALTH' | 'CAMPAIGN HEALTH';
  alerts: HealthRowData[];
  suggestions: SuggestionRowData[];
  /** Campaign scope: the Alerts tab path. */
  alertsHref: string | null;
}

interface Chain {
  advertiserId: string;
  partnerPublicId: string;
  advertiserPublicId: string;
  campaignId?: string;
  ioId?: string;
  lineItemId?: string;
}

async function chainOf(tx: Tx, scope: IntelligenceScope, id: string): Promise<Chain> {
  const advSel = {
    select: { id: true, publicId: true, partner: { select: { publicId: true } } },
  } as const;
  const adv = (a: { id: string; publicId: bigint; partner: { publicId: bigint } }) => ({
    advertiserId: a.id,
    advertiserPublicId: a.publicId.toString(),
    partnerPublicId: a.partner.publicId.toString(),
  });
  if (scope === 'advertiser') {
    const a = await tx.advertiser.findUnique({ where: { id }, ...advSel });
    if (!a) throw notFound();
    return adv(a);
  }
  if (scope === 'campaign') {
    const c = await tx.campaign.findUnique({
      where: { id },
      select: { id: true, advertiser: advSel },
    });
    if (!c) throw notFound();
    return { ...adv(c.advertiser), campaignId: c.id };
  }
  if (scope === 'io') {
    const io = await tx.insertionOrder.findUnique({
      where: { id },
      select: { id: true, campaignId: true, campaign: { select: { advertiser: advSel } } },
    });
    if (!io) throw notFound();
    return { ...adv(io.campaign.advertiser), campaignId: io.campaignId, ioId: io.id };
  }
  const li = await tx.lineItem.findUnique({
    where: { id },
    select: { id: true, ioId: true, campaignId: true, advertiser: advSel },
  });
  if (!li) throw notFound();
  return { ...adv(li.advertiser), campaignId: li.campaignId, ioId: li.ioId, lineItemId: li.id };
}

async function pathsFor(
  tx: Tx,
  chain: Chain,
  recs: readonly { scopeType: string; scopeId: string }[],
) {
  const ioIds = new Set(recs.filter((r) => r.scopeType === 'IO').map((r) => r.scopeId));
  const liIds = new Set(recs.filter((r) => r.scopeType === 'LINE_ITEM').map((r) => r.scopeId));
  const lis = liIds.size
    ? await tx.lineItem.findMany({
        where: { id: { in: [...liIds] } },
        select: {
          id: true,
          publicId: true,
          ioId: true,
          campaignId: true,
          io: { select: { publicId: true } },
          campaign: { select: { publicId: true } },
        },
      })
    : [];
  for (const l of lis) ioIds.add(l.ioId);
  const ios = ioIds.size
    ? await tx.insertionOrder.findMany({
        where: { id: { in: [...ioIds] } },
        select: { id: true, publicId: true, campaign: { select: { publicId: true } } },
      })
    : [];
  const ioMap = new Map(ios.map((i) => [i.id, i]));
  const liMap = new Map(lis.map((l) => [l.id, l]));
  const p = chain.partnerPublicId;
  const a = chain.advertiserPublicId;
  const paths: SuggestionPaths = {
    io: (id) => {
      const io = ioMap.get(id);
      return io ? ioPath(p, a, io.campaign.publicId.toString(), io.publicId.toString()) : null;
    },
    li: (id) => {
      const li = liMap.get(id);
      const io = li && ioMap.get(li.ioId);
      return li && io
        ? liPath(
            p,
            a,
            li.campaign.publicId.toString(),
            io.publicId.toString(),
            li.publicId.toString(),
          )
        : null;
    },
  };
  return paths;
}

/** Entities inside the scope, for filtering recommendations. */
async function scopeEntities(tx: Tx, scope: IntelligenceScope, chain: Chain) {
  if (scope === 'li') return { ios: [] as string[], lis: [chain.lineItemId as string] };
  if (scope === 'io') {
    const lis = await tx.lineItem.findMany({
      where: { ioId: chain.ioId as string },
      select: { id: true },
    });
    return { ios: [chain.ioId as string], lis: lis.map((l) => l.id) };
  }
  const where =
    scope === 'campaign'
      ? { campaignId: chain.campaignId as string }
      : { advertiserId: chain.advertiserId };
  const [ios, lis] = await Promise.all([
    tx.insertionOrder.findMany({
      where: scope === 'campaign' ? where : { campaign: { advertiserId: chain.advertiserId } },
      select: { id: true },
    }),
    tx.lineItem.findMany({ where, select: { id: true } }),
  ]);
  return { ios: ios.map((i) => i.id), lis: lis.map((l) => l.id) };
}

export async function getIntelligence(
  user: SessionUser,
  scope: IntelligenceScope,
  id: string,
): Promise<Result<IntelligenceData>> {
  return asResult(async () => {
    const ctx = await serviceCtx(user);
    assertRead(ctx);
    const data = await withSandbox(ctx.sandboxId, async (tx) => {
      const chain = await chainOf(tx, scope, id);
      const alertWhere =
        scope === 'advertiser'
          ? { advertiserId: chain.advertiserId }
          : scope === 'campaign'
            ? { advertiserId: chain.advertiserId, campaignId: chain.campaignId }
            : scope === 'io'
              ? { advertiserId: chain.advertiserId, ioId: chain.ioId }
              : { advertiserId: chain.advertiserId, lineItemId: chain.lineItemId };
      const alerts = await tx.alert.findMany({
        where: { ...alertWhere, state: 'OPEN' },
        orderBy: [{ firstSeenAt: 'asc' }, { id: 'asc' }],
      });
      const ents = await scopeEntities(tx, scope, chain);
      const recs = await tx.recommendation.findMany({
        where: {
          advertiserId: chain.advertiserId,
          status: { in: ['OPEN', 'DISMISSED'] },
          OR: [
            { scopeType: 'IO', scopeId: { in: ents.ios } },
            { scopeType: 'LINE_ITEM', scopeId: { in: ents.lis } },
          ],
        },
      });
      const facts: SuggestionFacts[] = recs.map((r) => ({
        id: r.id,
        type: r.type,
        scopeType: r.scopeType === 'IO' ? 'IO' : 'LINE_ITEM',
        scopeId: r.scopeId,
        title: r.title,
        status: r.status,
        updatedAt: r.updatedAt,
      }));
      const paths = await pathsFor(tx, chain, recs);
      const a = chain.advertiserPublicId;
      const p = chain.partnerPublicId;
      const campaign =
        scope === 'campaign' && chain.campaignId
          ? await tx.campaign.findUnique({
              where: { id: chain.campaignId },
              select: { publicId: true },
            })
          : null;
      const alertFacts: AlertFacts[] = alerts.map((x) => ({
        id: x.id,
        type: x.type,
        diagnosticCode: x.diagnosticCode,
        severity: x.severity,
        title: x.title,
        lineItemId: x.lineItemId,
        ioId: x.ioId,
        campaignId: x.campaignId,
        payload: x.payload,
      }));
      return {
        scope,
        healthTitle:
          scope === 'advertiser' ? ('ADVERTISER HEALTH' as const) : ('CAMPAIGN HEALTH' as const),
        alerts: healthRows(alertFacts, { partnerId: p, advertiserId: a }),
        suggestions: suggestionRows(facts, paths, ctx.simNow),
        alertsHref: campaign ? campaignPath(p, a, campaign.publicId.toString(), 'alerts') : null,
      } satisfies IntelligenceData;
    });
    return { data };
  });
}

export interface InvestigateData {
  title: string;
  conflicts: (ConflictExplanation & { href: string })[];
}

/** Investigate drawer for a conflicting-settings row: the `CONF.*` explanations of the entity's open alert. */
export async function getInvestigate(
  user: SessionUser,
  scope: 'io' | 'li',
  id: string,
): Promise<Result<InvestigateData>> {
  return asResult(async () => {
    const ctx = await serviceCtx(user);
    assertRead(ctx);
    const data = await withSandbox(ctx.sandboxId, async (tx) => {
      const chain = await chainOf(tx, scope, id);
      const alert = await tx.alert.findFirst({
        where: {
          advertiserId: chain.advertiserId,
          state: 'OPEN',
          type: 'CONFLICTING_SETTINGS',
          ...(scope === 'io' ? { ioId: id, lineItemId: null } : { lineItemId: id }),
        },
        select: { payload: true },
      });
      const raw = (alert?.payload as { conflicts?: string } | null)?.conflicts ?? '';
      const p = chain.partnerPublicId;
      const a = chain.advertiserPublicId;
      let name: string;
      let base: string;
      if (scope === 'io') {
        const io = await tx.insertionOrder.findUnique({
          where: { id },
          select: { name: true, publicId: true, campaign: { select: { publicId: true } } },
        });
        if (!io) throw notFound();
        name = io.name;
        base = ioPath(p, a, io.campaign.publicId.toString(), io.publicId.toString());
      } else {
        const li = await tx.lineItem.findUnique({
          where: { id },
          select: {
            name: true,
            publicId: true,
            io: { select: { publicId: true } },
            campaign: { select: { publicId: true } },
          },
        });
        if (!li) throw notFound();
        name = li.name;
        base = liPath(
          p,
          a,
          li.campaign.publicId.toString(),
          li.io.publicId.toString(),
          li.publicId.toString(),
        );
      }
      const conflicts = explainConflicts(raw ? raw.split(',') : []).map((c) => ({
        ...c,
        href: c.fix.sub === 'explorerlis' ? `${base}/explorerlis` : `${base}/${c.fix.sub}`,
      }));
      return { title: name, conflicts };
    });
    return { data };
  });
}

export async function dismissSuggestion(
  user: SessionUser,
  id: string,
): Promise<Result<{ id: string }>> {
  return asResult(async () => {
    const ctx = await serviceCtx(user);
    assertWrite(ctx);
    await withSandbox(ctx.sandboxId, async (tx) => {
      const r = await tx.recommendation.findUnique({ where: { id } });
      if (!r) throw notFound();
      if (!SUGGESTIONS[r.type].dismissable) return;
      await tx.recommendation.update({
        where: { id },
        data: { status: 'DISMISSED', updatedAt: ctx.simNow },
      });
    });
    return { data: { id } };
  });
}

/** Apply sets one field through the normal edit service (4.9). */
export async function applySuggestion(
  user: SessionUser,
  id: string,
): Promise<Result<{ id: string }>> {
  return asResult(async () => {
    const ctx = await serviceCtx(user);
    assertWrite(ctx);
    const rec = await withSandbox(ctx.sandboxId, (tx) =>
      tx.recommendation.findUnique({ where: { id } }),
    );
    if (!rec || rec.status === 'APPLIED') throw notFound();
    const info = SUGGESTIONS[rec.type];
    if (!info.applicable) throw notFound();
    if (rec.type === 'USE_OPTIMIZED_TARGETING') {
      const detail = await getLineItemDetail(user, rec.scopeId);
      if (!detail) throw notFound();
      const value = structuredClone(detail.value);
      value.optimizedTargeting = true;
      const res = await updateLineItem(user, rec.scopeId, value, {
        expectedVersion: detail.version,
      });
      if (!res.ok)
        throw res.code === 'FORBIDDEN'
          ? new ServiceFailure('FORBIDDEN')
          : res.code === 'NOT_FOUND'
            ? notFound()
            : invalid(res.issues);
    } else {
      const detail = await getInsertionOrder(user, rec.scopeId);
      const value = structuredClone(detail.value);
      if (rec.type === 'ENABLE_AUTO_BUDGET_ALLOCATION')
        value.optimization = { ...value.optimization, autoBudgetAllocation: true };
      else value.optimization = { ...value.optimization, mode: 'IO_AUTOMATED' };
      const res = await updateInsertionOrder(user, rec.scopeId, value, {
        expectedVersion: detail.version,
      });
      if (!res.ok) throw new ServiceFailure(res.code, res.issues);
    }
    await withSandbox(ctx.sandboxId, (tx) =>
      tx.recommendation.update({
        where: { id },
        data: { status: 'APPLIED', updatedAt: ctx.simNow },
      }),
    );
    return { data: { id } };
  });
}

export { advertiserPath };
