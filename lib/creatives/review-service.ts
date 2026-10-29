import 'server-only';
// Review side of the creative module: status tab, appeals, appeal history, creative History (module 12 S4, S5, S7, S9).
import type { Prisma } from '@prisma/client';
import type { SessionUser } from '@/lib/auth/types';
import { historyWhere, renderLine, withChangeLog, type FieldDef } from '@/lib/changelog';
import { creativeRegistry } from '@/lib/changelog/registries/creative';
import type { Tx } from '@/lib/db';
import {
  asResult,
  changeCtx,
  invalid,
  notFound,
  type Result,
  type ServiceCtx,
} from '@/lib/campaigns/service-kit';
import { exchangeIdsFor } from '@/lib/line-items/load';
import { validate } from '@/lib/validation/engine';
import { servingEligibility } from './eligibility';
import { feedbackFor } from './feedback';
import {
  loadAdvertiser,
  readCtx,
  validationContext,
  writeCtx,
  canWriteCreatives,
  parseIdRef,
  whereId,
} from './guard';
import { CREATIVE_INCLUDE, sandboxSeed, toInput, type StoredCreative } from './load';
import { CREATIVE_LIMITS } from './limits';
import { appealSchedule, approvedByText, countExchanges, shownDv360Review } from './review';
import { allExchanges, approvalRegistry, settleAppeals } from './settle';
import type {
  AppealRow,
  CreativeStatusView,
  EligibilityRow,
  ExchangeReviewRow,
  ExchangeStatus,
  HistoryRow,
} from './types';

async function loadStored(tx: Tx, cid: string, advertiserId: string): Promise<StoredCreative> {
  const ref = parseIdRef(cid);
  const row = ref
    ? await tx.creative.findFirst({
        where: { ...whereId(ref), advertiserId },
        include: CREATIVE_INCLUDE,
      })
    : null;
  if (!row) throw notFound();
  return row;
}

const DAY_MS = 86_400_000;

// ---------------------------------------------------------------------------------------------
// Status tab
// ---------------------------------------------------------------------------------------------

/** One eligibility row per associated line item (module 12 S4 card 5, MX-09 B). */
async function eligibilityRows(
  tx: Tx,
  ctx: ServiceCtx,
  c: StoredCreative,
  partnerId: string,
): Promise<EligibilityRow[]> {
  const lis = await tx.lineItem.findMany({
    where: { assignments: { some: { creativeId: c.id } }, status: { not: 'ARCHIVED' } },
    orderBy: { name: 'asc' },
    select: { id: true, publicId: true, name: true, type: true, appAdFormat: true },
  });
  if (lis.length === 0) return [];
  const geo = await tx.targetingAssignment.findMany({
    where: {
      lineItemId: { in: lis.map((l) => l.id) },
      dimension: 'GEOGRAPHY',
      mode: 'INCLUDE',
      optionId: { not: null },
    },
    select: { lineItemId: true, optionId: true },
  });
  const options = await tx.targetingOption.findMany({
    where: { id: { in: [...new Set(geo.map((g) => g.optionId!))] } },
    select: { id: true, code: true },
  });
  const codeOf = new Map(options.map((o) => [o.id, o.code]));
  const countries = await tx.targetingOption.findMany({
    where: {
      dimension: 'GEOGRAPHY',
      code: { in: c.creativeRestrictions.flatMap((r) => (r.countryCode ? [r.countryCode] : [])) },
    },
    select: { code: true, name: true },
  });
  const nameOf = new Map(countries.map((o) => [o.code, o.name]));
  const diagnostics = await tx.deliveryDiagnostic.groupBy({
    by: ['lineItemId', 'reasonCode'],
    where: {
      lineItemId: { in: lis.map((l) => l.id) },
      stage: 'CREATIVE',
      date: { gte: new Date(ctx.simNow.getTime() - DAY_MS) },
    },
    _sum: { count: true },
  });
  const top = new Map<string, { code: string; n: bigint }>();
  for (const d of diagnostics) {
    const n = d._sum.count ?? 0n;
    const cur = top.get(d.lineItemId);
    if (!cur || n > cur.n) top.set(d.lineItemId, { code: d.reasonCode, n });
  }
  const exchanges = Object.fromEntries(c.reviews.map((r) => [r.exchangeId, r.status]));
  const out: EligibilityRow[] = [];
  for (const li of lis) {
    const adType =
      li.appAdFormat === 'VIDEO' ? 'VIDEO' : li.appAdFormat === 'DISPLAY' ? 'DISPLAY' : null;
    const result = servingEligibility(
      {
        kind: c.kind,
        status: c.status === 'PAUSED' ? 'PAUSED' : c.status === 'ACTIVE' ? 'ACTIVE' : 'ARCHIVED',
        dv360Review: c.dv360Review,
        exchanges,
        restrictedCountries: c.creativeRestrictions.flatMap((r) =>
          r.countryCode
            ? [{ code: r.countryCode, name: nameOf.get(r.countryCode) ?? r.countryCode }]
            : [],
        ),
        width: c.width,
        height: c.height,
      },
      {
        type: li.type,
        adType,
        exchangeIds: await exchangeIdsFor(tx, partnerId, li.type, adType),
        targetedCountries: geo
          .filter((g) => g.lineItemId === li.id)
          .flatMap((g) => (codeOf.get(g.optionId!) ? [codeOf.get(g.optionId!)!] : [])),
      },
    );
    out.push({
      lineItemId: li.id,
      lineItemPublicId: li.publicId.toString(),
      name: li.name,
      type: li.type,
      canServe: result.canServe,
      why: result.why ?? null,
      code: result.code ?? null,
      lastDay: top.get(li.id)?.code ?? null,
    });
  }
  return out;
}

export async function getCreativeStatus(
  user: SessionUser,
  aid: string,
  cid: string,
): Promise<CreativeStatusView> {
  return readCtx(user, async (tx, ctx) => {
    const adv = await loadAdvertiser(tx, aid);
    await settleAppeals(tx, ctx, adv.id);
    const c = await loadStored(tx, cid, adv.id);
    const [ext, exchanges, appeals, urls, assignments] = await Promise.all([
      tx.creativeExt.findUnique({ where: { creativeId: c.id } }),
      allExchanges(tx),
      tx.creativeAppeal.findMany({
        where: { creativeId: c.id, status: 'OPEN' },
        select: { exchangeId: true },
      }),
      tx.creativeUrl.findMany({
        where: { creativeId: c.id, type: 'DETECTED_DESTINATION' },
        orderBy: { ordinal: 'asc' },
      }),
      tx.creativeAssignment.findMany({
        where: { creativeId: c.id, lineItem: { status: { not: 'ARCHIVED' } } },
        select: {
          lineItem: {
            select: {
              id: true,
              publicId: true,
              name: true,
              io: { select: { publicId: true } },
              campaign: { select: { publicId: true } },
            },
          },
        },
      }),
    ]);
    const write = canWriteCreatives(user);
    const countryNames = new Map(
      (
        await tx.targetingOption.findMany({
          where: {
            dimension: 'GEOGRAPHY',
            code: {
              in: c.creativeRestrictions.flatMap((r) => (r.countryCode ? [r.countryCode] : [])),
            },
          },
          select: { code: true, name: true },
        })
      ).map((o) => [o.code, o.name]),
    );
    const openFor = new Set(appeals.map((a) => a.exchangeId ?? 'dv360'));
    const shown = shownDv360Review(c.dv360Review, ext?.dv360DecideAt ?? null, ctx.simNow);
    const rows: ExchangeReviewRow[] = c.reviews
      .map((r): ExchangeReviewRow => {
        const ex = exchanges.get(r.exchangeId);
        const status = r.status;
        const ssl: ExchangeStatus =
          r.sslStatus === 'PENDING' && status === 'APPROVED' ? 'APPROVED' : r.sslStatus;
        return {
          exchangeId: r.exchangeId,
          name: ex?.name ?? r.exchangeId,
          code: ex?.code ?? r.exchangeId,
          status,
          ssl,
          reasonCode: status === 'DISAPPROVED' ? r.feedback : null,
          feedback: status === 'DISAPPROVED' ? feedbackFor(r.feedback ?? 'OTHER') : null,
          lastSyncAt: r.lastSyncAt?.toISOString() ?? null,
          canAppeal: write && status === 'DISAPPROVED' && !openFor.has(r.exchangeId),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
    const counts = countExchanges(c.reviews.map((r) => r.status));
    const pending = shown === 'PENDING' || c.reviews.some((r) => r.status === 'PENDING');
    const dvDone = !!ext?.dv360DecideAt && ext.dv360DecideAt.getTime() <= ctx.simNow.getTime();
    return {
      id: c.id,
      name: c.name,
      created: c.createdAt.toISOString(),
      modified: c.updatedAt.toISOString(),
      reviewCompleted:
        (c.reviewCompletedAt ?? (dvDone ? ext.dv360DecideAt : null))?.toISOString() ?? null,
      dv360: {
        status: shown,
        feedback:
          shown === 'PENDING'
            ? 'Review in progress'
            : shown === 'SERVABLE'
              ? 'Creative is servable'
              : (c.dv360Feedback ?? "This creative isn't servable."),
        canAppeal: write && shown === 'NOT_SERVABLE' && !openFor.has('dv360'),
        restrictions: c.creativeRestrictions.map((r) => ({
          id: r.id,
          message: r.message,
          countryCode: r.countryCode,
          blocksText: r.countryCode
            ? `This creative is restricted from serving in line items that target ${countryNames.get(r.countryCode) ?? r.countryCode}.`
            : null,
        })),
        destinationUrls: [
          ...new Set([...urls.map((u) => u.url), ...(c.landingPageUrl ? [c.landingPageUrl] : [])]),
        ],
      },
      exchanges: rows,
      exchangeSummary: approvedByText(counts),
      noExchanges: rows.length === 0,
      pending,
      pendingHint: pending ? 'Usually takes a few hours' : null,
      lineItems: assignments
        .map((a) => ({
          id: a.lineItem.id,
          publicId: a.lineItem.publicId.toString(),
          name: a.lineItem.name,
          ioPublicId: a.lineItem.io.publicId.toString(),
          campaignPublicId: a.lineItem.campaign.publicId.toString(),
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      eligibility: await eligibilityRows(tx, ctx, c, adv.partnerId),
    };
  });
}

// ---------------------------------------------------------------------------------------------
// Appeals (S9)
// ---------------------------------------------------------------------------------------------

export async function appealCreative(
  user: SessionUser,
  aid: string,
  cid: string,
  req: { exchangeIds?: string[]; reason?: string },
): Promise<Result<{ appealIds: string[] }>> {
  return asResult(() =>
    writeCtx(user, async (tx, ctx) => {
      const adv = await loadAdvertiser(tx, aid);
      await settleAppeals(tx, ctx, adv.id);
      const c = await loadStored(tx, cid, adv.id);
      const ext = await tx.creativeExt.findUnique({ where: { creativeId: c.id } });
      const shown = shownDv360Review(c.dv360Review, ext?.dv360DecideAt ?? null, ctx.simNow);
      const disapproved = c.reviews.filter((r) => r.status === 'DISAPPROVED');
      const servableEverywhere = shown !== 'NOT_SERVABLE' && disapproved.length === 0;
      // CRE-043: only disapproved or not servable creatives can be appealed
      const cre043 = validate(
        'creative',
        { ...toInput(c, ext), appeal: { servableEverywhere } },
        validationContext(ctx, adv, 'edit', toInput(c, ext)),
      ).filter((i) => i.ruleId === 'CRE-043');
      if (cre043.length) throw invalid(cre043);
      const reason = req.reason?.trim().slice(0, CREATIVE_LIMITS.APPEAL_REASON_MAX) || null;
      const dv360Level = shown === 'NOT_SERVABLE' && !req.exchangeIds?.length;
      const targets = dv360Level
        ? disapproved
        : disapproved.filter(
            (r) => !req.exchangeIds?.length || req.exchangeIds.includes(r.exchangeId),
          );
      if (!dv360Level && targets.length === 0)
        throw invalid([
          {
            ruleId: 'CRE-043',
            severity: 'error',
            path: 'appeal',
            message: 'Only creatives that were disapproved can be appealed.',
            blocking: true,
          },
        ]);
      const open = await tx.creativeAppeal.findMany({
        where: { creativeId: c.id, status: 'OPEN' },
        select: { exchangeId: true },
      });
      const openSet = new Set(open.map((o) => o.exchangeId ?? 'dv360'));
      const exchanges = await allExchanges(tx);
      const seed = await sandboxSeed(tx, ctx.sandboxId);
      const lis = await tx.creativeAssignment.count({
        where: { creativeId: c.id, lineItem: { status: 'ACTIVE' } },
      });
      const campaignImpact =
        lis > 0 ? `${lis} active line ${lis === 1 ? 'item' : 'items'}` : 'None';
      const actor = ctx.user.actor ?? ctx.user;
      const keys: (string | null)[] = dv360Level ? [null] : targets.map((t) => t.exchangeId);
      if (keys.some((k) => openSet.has(k ?? 'dv360')))
        throw invalid([
          {
            ruleId: 'CRE-043',
            severity: 'error',
            path: 'appeal',
            message: 'An appeal for this is already in progress.',
            blocking: true,
          },
        ]);
      const appealIds: string[] = [];
      await withChangeLog(
        changeCtx(ctx, tx),
        { type: 'CREATIVE', id: c.id, chain: { advertiserId: adv.id } },
        async (t) => {
          for (const key of keys) {
            const review = targets.find((r) => r.exchangeId === key);
            const earlier = await t.creativeAppeal.count({
              where: { creativeId: c.id, exchangeId: key },
            });
            const plan = appealSchedule(seed, c.id, key ?? 'dv360', earlier, ctx.simNow);
            const created = await t.creativeAppeal.create({
              data: {
                sandboxId: ctx.sandboxId,
                creativeId: c.id,
                exchangeId: key,
                reviewId: review?.id ?? null,
                campaignImpact,
                appealType: key ? 'Exchange review' : 'DV360 review',
                inventory: key ? (exchanges.get(key)?.name ?? key) : 'All exchanges',
                policy: feedbackFor(review?.feedback ?? 'OTHER')?.summary ?? null,
                reasonText: reason,
                status: 'OPEN',
                initiatedById: actor.id,
                decideAt: plan.decideAt,
              },
              select: { id: true },
            });
            appealIds.push(created.id);
          }
          // the engine's structural sync ignores rows without a decideAt; settleAppeals closes the appeal
          await t.creativeReview.updateMany({
            where: { id: { in: targets.map((r) => r.id) } },
            data: { status: 'PENDING', decideAt: null },
          });
          if (dv360Level)
            await t.creative.update({
              where: { id: c.id },
              data: { dv360Review: 'PENDING', version: { increment: 1 } },
            });
          return { id: c.id };
        },
        {
          registry: approvalRegistry(
            ctx.sandboxId,
            exchanges,
            c.reviews.map((r) => r.exchangeId),
          ),
        },
      );
      return { data: { appealIds } };
    }),
  );
}

export async function listAppeals(
  user: SessionUser,
  aid: string,
  q: { page?: number; pageSize?: number } = {},
): Promise<{ rows: AppealRow[]; total: number; page: number; pageSize: number }> {
  return readCtx(user, async (tx, ctx) => {
    const adv = await loadAdvertiser(tx, aid);
    await settleAppeals(tx, ctx, adv.id);
    const page = Math.max(1, q.page ?? 1);
    const pageSize = Math.min(q.pageSize ?? 50, 200);
    const where: Prisma.CreativeAppealWhereInput = { creative: { advertiserId: adv.id } };
    const [total, rows] = await Promise.all([
      tx.creativeAppeal.count({ where }),
      tx.creativeAppeal.findMany({
        where,
        include: { creative: { select: { id: true, publicId: true, name: true } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return {
      total,
      page,
      pageSize,
      rows: rows.map((a) => ({
        id: a.id,
        creativeId: a.creative?.id ?? null,
        creativePublicId: a.creative?.publicId.toString() ?? null,
        name: a.creative?.name ?? '-',
        campaignImpact: a.campaignImpact ?? 'None',
        appealType: a.appealType,
        inventory: a.inventory ?? '-',
        policy: a.policy ?? '-',
        status: a.status === 'OPEN' ? 'Pending' : a.status === 'ACCEPTED' ? 'Approved' : 'Rejected',
        createdAt: a.createdAt.toISOString(),
        completedAt: a.completedAt?.toISOString() ?? null,
        result: a.result ?? '-',
      })),
    };
  });
}

// ---------------------------------------------------------------------------------------------
// Creative History (S5)
// ---------------------------------------------------------------------------------------------

/** Approval entries (exchange and DV360 review) are written with their own registry; show their values as words. */
const approvalDef = (path: string): FieldDef | undefined =>
  path.endsWith('.approvalStatus') || path === 'dv360Status'
    ? { path, label: '', kind: 'enum' }
    : undefined;

const SYSTEM_LABEL: Record<string, string> = {
  CREATIVE_APPROVAL_SYNC: 'CREATIVE_APPROVAL_SYNC',
  DFA_TAG_VALIDATION_SYNC: 'DFA_TAG_VALIDATION_SYNC',
  SIM_ENGINE: 'Simulator engine',
  SIM_SCENARIO_LOADER: 'Scenario',
};

export async function getCreativeHistory(
  user: SessionUser,
  aid: string,
  cid: string,
  q: {
    from?: string;
    to?: string;
    user?: string;
    field?: string;
    page?: number;
    pageSize?: number;
  } = {},
): Promise<{ rows: HistoryRow[]; total: number; page: number; pageSize: number }> {
  return readCtx(user, async (tx, ctx) => {
    const adv = await loadAdvertiser(tx, aid);
    const c = await loadStored(tx, cid, adv.id);
    const page = Math.max(1, q.page ?? 1);
    const pageSize = Math.min(q.pageSize ?? 25, 100);
    const where: Prisma.ChangeGroupWhereInput = {
      ...historyWhere({
        sandboxId: ctx.sandboxId,
        scope: { entityType: 'CREATIVE', entityId: c.id },
        includeSystem: true,
        ...(q.from ? { from: new Date(`${q.from}T00:00:00Z`) } : {}),
        ...(q.to ? { to: new Date(`${q.to}T23:59:59Z`) } : {}),
      }),
      ...(q.user ? { actorLabel: { contains: q.user, mode: 'insensitive' as const } } : {}),
      ...(q.field
        ? { entries: { some: { label: { contains: q.field, mode: 'insensitive' as const } } } }
        : {}),
    };
    const [total, groups] = await Promise.all([
      tx.changeGroup.count({ where }),
      tx.changeGroup.findMany({
        where,
        include: { entries: { orderBy: { sortOrder: 'asc' } } },
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    const defs = new Map(creativeRegistry.fields.map((f) => [f.path, f]));
    return {
      total,
      page,
      pageSize,
      rows: groups.map((g) => ({
        id: g.id,
        date: g.occurredAt.toISOString(),
        user:
          g.actorType === 'SYSTEM'
            ? (SYSTEM_LABEL[g.systemActor ?? ''] ?? g.systemActor ?? 'System')
            : (g.actorLabel ?? 'Unknown'),
        summary: g.summary,
        lines: g.entries.map((e) =>
          renderLine(e, defs.get(e.fieldPath) ?? approvalDef(e.fieldPath)),
        ),
      })),
    };
  });
}
