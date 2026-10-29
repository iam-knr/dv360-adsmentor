import 'server-only';
// Negotiation services (module 13 S9, S10, 4.3, "from public docs" so simple and synthetic). Seller replies are
// computed lazily: any read or action first settles negotiations whose reply or expiry time has passed on the sim
// clock, using the deterministic seller policy (negotiation-policy.ts). A seller who agrees to a counter leaves the
// negotiation `COUNTERED` and awaiting the buyer, so the student still presses Accept, which creates the Draft deal.
import type { Negotiation, NegotiationMessage, Prisma } from '@prisma/client';
import type { SessionUser } from '@/lib/auth/types';
import { withChangeLog } from '@/lib/changelog';
import type { Tx } from '@/lib/db';
import {
  asResult,
  changeCtx,
  notFound,
  ServiceFailure,
  type Result,
  type ServiceCtx,
} from '@/lib/campaigns/service-kit';
import type { WireIssue } from '@/lib/campaigns/wire';
import { hashString } from '@/lib/seed/prng';
import type { Issue } from '@/lib/validation/types';
import {
  COMMITMENT_LABEL,
  DEAL_CURRENCY,
  exchangeInfo,
  loadConverter,
  round2,
  type Converter,
} from './data';
import { canWriteInventory, loadAdvertiser, readCtx, writeCtx, type AdvertiserRow } from './guard';
import { advanceNegotiation, parsePolicy, type SellerDecision } from './negotiation-policy';
import { acceptNegotiationIssues, counterIssues, importNegotiationIssues } from './rules';
import type { NegotiationMessageView, NegotiationRow, NegotiationView } from './types';

const DAY = 86_400_000;
const HOUR = 3_600_000;
const ALL_STATUSES = ['DRAFT', 'PROPOSED', 'COUNTERED', 'ACCEPTED', 'DECLINED', 'EXPIRED'] as const;
export type NegotiationStatusKey = (typeof ALL_STATUSES)[number];
export const DEFAULT_NEGOTIATION_STATUSES: NegotiationStatusKey[] = [...ALL_STATUSES];

const toWire = (i: Issue): WireIssue => ({
  path: i.path,
  severity: i.severity,
  code: i.ruleId,
  message: i.message,
});
const failWith = (issues: Issue[]) => new ServiceFailure('INVALID', issues.map(toWire));

interface Terms {
  rate: number;
  sellerRate?: number;
  volume: number | null;
  startAt?: string | null;
  endAt?: string | null;
  format?: string | null;
  commitment?: string;
  targeting?: string | null;
  expiresAt?: string | null;
  /** The buyer's last counter, waiting for the seller. */
  proposal?: { rate: number; volume: number | null } | null;
  /** The seller agreed to the buyer's terms and waits for Accept. */
  agreed?: boolean;
  final?: boolean;
}

const termsOf = (n: Negotiation): Terms => {
  const t = (n.terms ?? {}) as Partial<Terms>;
  return {
    rate: t.rate ?? Number(n.averagePrice ?? 0),
    volume: n.volume === null ? null : Number(n.volume),
    ...t,
  };
};

// ---------------------------------------------------------------------------------------------
// Lazy advance
// ---------------------------------------------------------------------------------------------

async function applyDecision(
  tx: Tx,
  n: Negotiation,
  t: Terms,
  d: SellerDecision,
  simNow: Date,
): Promise<void> {
  const base = {
    sandboxId: n.sandboxId,
    negotiationId: n.id,
    authorKind: 'SELLER' as const,
    sentAt: simNow,
  };
  if (d.kind === 'DECLINE') {
    await tx.negotiationMessage.create({ data: { ...base, body: d.body } });
    await tx.negotiation.update({
      where: { id: n.id },
      data: { status: 'DECLINED', awaiting: 'NONE', replyAt: null, lastEditedAt: simNow },
    });
    return;
  }
  const agreed = d.kind === 'ACCEPT';
  const volume = d.volume;
  const next: Terms = {
    ...t,
    rate: d.rate,
    sellerRate: d.rate,
    volume,
    proposal: null,
    agreed,
    final: d.kind === 'COUNTER' ? d.final : false,
  };
  await tx.negotiationMessage.create({
    data: {
      ...base,
      body: d.body,
      proposedRate: d.rate,
      ...(volume === null ? {} : { proposedVolume: BigInt(volume) }),
    },
  });
  await tx.negotiation.update({
    where: { id: n.id },
    data: {
      status: 'COUNTERED',
      awaiting: 'BUYER',
      replyAt: null,
      lastEditedAt: simNow,
      averagePrice: d.rate,
      volume: volume === null ? null : BigInt(volume),
      terms: next as unknown as Prisma.InputJsonValue,
    },
  });
}

/** Settle every negotiation of the partner whose reply or expiry time is at or before the sim clock. */
export async function settleNegotiations(
  tx: Tx,
  ctx: ServiceCtx,
  partnerId: string,
): Promise<number> {
  const open = await tx.negotiation.findMany({
    where: { partnerId, status: { in: ['PROPOSED', 'COUNTERED'] } },
  });
  let changed = 0;
  for (const n of open) {
    const t = termsOf(n);
    const policy = parsePolicy(n.sellerPolicy);
    const expiresAt = n.expiresAt ?? (t.expiresAt ? new Date(t.expiresAt) : null);
    const a = advanceNegotiation(
      {
        status: n.status,
        awaiting: n.awaiting,
        round: n.round,
        replyAt: n.replyAt,
        expiresAt,
        sellerRate: t.sellerRate ?? t.rate,
        proposal: t.proposal ?? null,
        policy,
      },
      ctx.simNow,
    );
    if (a.kind === 'NONE') continue;
    changed += 1;
    if (a.kind === 'EXPIRE') {
      await tx.negotiation.update({
        where: { id: n.id },
        data: { status: 'EXPIRED', awaiting: 'NONE', replyAt: null, lastEditedAt: ctx.simNow },
      });
    } else {
      await applyDecision(tx, n, t, a.decision, n.replyAt ?? ctx.simNow);
    }
  }
  return changed;
}

// ---------------------------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------------------------

function toRow(
  n: Negotiation,
  exchangeName: string,
  convert: Converter,
  currency: string,
): NegotiationRow {
  return {
    id: n.id,
    publicId: n.publicId.toString(),
    rfpId: n.rfpId,
    name: n.name,
    sellerName: n.sellerName,
    status: n.status,
    awaiting: n.awaiting,
    deliveryMethod: n.deliveryMethod === 'TAGGED' ? 'Tagged' : 'Programmatic',
    commitment: n.commitment,
    commitmentLabel: COMMITMENT_LABEL[n.commitment],
    exchangeName,
    volume: n.volume === null ? null : Number(n.volume),
    averagePrice:
      n.averagePrice === null
        ? null
        : round2(convert(Number(n.averagePrice), DEAL_CURRENCY, currency)),
    spend: n.spend === null ? null : round2(convert(Number(n.spend), DEAL_CURRENCY, currency)),
    lastEditedAt: n.lastEditedAt.toISOString(),
  };
}

export async function listNegotiations(
  user: SessionUser,
  aid: string,
  q: { status?: NegotiationStatusKey[] } = {},
): Promise<{ rows: NegotiationRow[]; total: number; canWrite: boolean }> {
  // opening the list settles any seller reply that is due on the sim clock (4.3)
  return readCtx(user, async (tx, ctx) => {
    const adv = await loadAdvertiser(tx, ctx, aid);
    await settleNegotiations(tx, ctx, adv.partnerId);
    const statuses = q.status?.length ? q.status : DEFAULT_NEGOTIATION_STATUSES;
    const [rows, ex, convert] = await Promise.all([
      tx.negotiation.findMany({
        where: { partnerId: adv.partnerId, advertiserId: adv.id, status: { in: statuses } },
        orderBy: [{ lastEditedAt: 'desc' }, { publicId: 'asc' }],
      }),
      exchangeInfo(tx, adv.partnerId),
      loadConverter(tx, ctx.simNow),
    ]);
    return {
      rows: rows.map((n) =>
        toRow(n, ex.names.get(n.exchangeId) ?? n.sellerName, convert, adv.currencyCode),
      ),
      total: rows.length,
      canWrite: canWriteInventory(user),
    };
  });
}

function messageView(
  m: NegotiationMessage,
  convert: Converter,
  currency: string,
): NegotiationMessageView {
  return {
    id: m.id,
    authorKind: m.authorKind,
    body: m.body,
    proposedRate:
      m.proposedRate === null
        ? null
        : round2(convert(Number(m.proposedRate), DEAL_CURRENCY, currency)),
    proposedVolume: m.proposedVolume === null ? null : Number(m.proposedVolume),
    sentAt: m.sentAt.toISOString(),
  };
}

function bannerOf(n: Negotiation, t: Terms, finalOffer: boolean): string | null {
  if (n.status === 'ACCEPTED') return 'This negotiation is accepted.';
  if (n.status === 'DECLINED') return 'This negotiation was declined.';
  if (n.status === 'EXPIRED') return 'This negotiation expired.';
  if (n.awaiting === 'SELLER') return 'Waiting for the seller';
  if (n.awaiting === 'BUYER')
    return finalOffer
      ? 'Waiting for you. The seller has made a final offer.'
      : t.agreed
        ? 'Waiting for you. The seller agreed to your terms.'
        : 'Waiting for you';
  return null;
}

export async function getNegotiation(
  user: SessionUser,
  aid: string,
  id: string,
): Promise<NegotiationView> {
  return readCtx(user, async (tx, ctx) => {
    const adv = await loadAdvertiser(tx, ctx, aid);
    await settleNegotiations(tx, ctx, adv.partnerId);
    const n = await tx.negotiation.findFirst({
      where: { id, partnerId: adv.partnerId, advertiserId: adv.id },
      include: { messages: { orderBy: [{ sentAt: 'asc' }, { id: 'asc' }] } },
    });
    if (!n) throw notFound();
    const [ex, convert, deal] = await Promise.all([
      exchangeInfo(tx, adv.partnerId),
      loadConverter(tx, ctx.simNow),
      n.resultingDealId
        ? tx.inventorySourceDeal.findUnique({
            where: { id: n.resultingDealId },
            select: { id: true, publicId: true, name: true },
          })
        : null,
    ]);
    const t = termsOf(n);
    const policy = parsePolicy(n.sellerPolicy);
    const open = n.status === 'PROPOSED' || n.status === 'COUNTERED';
    const finalOffer =
      open && n.awaiting === 'BUYER' && (t.final === true || n.round >= policy.maxRounds);
    return {
      row: toRow(n, ex.names.get(n.exchangeId) ?? n.sellerName, convert, adv.currencyCode),
      terms: {
        rate: round2(convert(t.rate, DEAL_CURRENCY, adv.currencyCode)),
        volume: t.volume,
        startAt: t.startAt ?? null,
        endAt: t.endAt ?? null,
        format: t.format ?? null,
        targeting: t.targeting ?? null,
        commitment: COMMITMENT_LABEL[n.commitment],
      },
      messages: n.messages.map((m) => messageView(m, convert, adv.currencyCode)),
      round: n.round,
      maxRounds: policy.maxRounds,
      finalOffer,
      resultingDeal: deal
        ? { id: deal.id, publicId: deal.publicId.toString(), name: deal.name }
        : null,
      banner: bannerOf(n, t, finalOffer),
      currencyCode: adv.currencyCode,
      canWrite: canWriteInventory(user),
    };
  });
}

// ---------------------------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------------------------

async function loadOwn(tx: Tx, adv: AdvertiserRow, id: string): Promise<Negotiation> {
  const n = await tx.negotiation.findFirst({
    where: { id, partnerId: adv.partnerId, advertiserId: adv.id },
  });
  if (!n) throw notFound();
  return n;
}

export async function importNegotiation(
  user: SessionUser,
  aid: string,
  req: { rfpId: string },
): Promise<Result<{ negotiationId: string }>> {
  return asResult(() =>
    writeCtx(user, async (tx, ctx) => {
      const adv = await loadAdvertiser(tx, ctx, aid);
      const rfpId = req.rfpId.trim();
      const found = rfpId
        ? await tx.negotiation.findFirst({
            where: { partnerId: adv.partnerId, rfpId: { equals: rfpId, mode: 'insensitive' } },
          })
        : null;
      const issues = importNegotiationIssues({
        rfpId,
        found: !!found,
        alreadyImported: !!found?.advertiserId,
      });
      if (issues.length || !found) throw failWith(issues);
      await tx.negotiation.update({
        where: { id: found.id },
        data: { advertiserId: adv.id, lastEditedAt: ctx.simNow },
      });
      return { data: { negotiationId: found.id } };
    }),
  );
}

export async function counterNegotiation(
  user: SessionUser,
  aid: string,
  id: string,
  req: { rate: number | null; volume?: number | null; note?: string },
): Promise<Result<void>> {
  return asResult(() =>
    writeCtx(user, async (tx, ctx) => {
      const adv = await loadAdvertiser(tx, ctx, aid);
      await settleNegotiations(tx, ctx, adv.partnerId);
      const n = await loadOwn(tx, adv, id);
      const policy = parsePolicy(n.sellerPolicy);
      const awaitingBuyer =
        (n.status === 'PROPOSED' || n.status === 'COUNTERED') && n.awaiting === 'BUYER';
      if (!awaitingBuyer)
        throw failWith(
          acceptNegotiationIssues({
            status: n.status,
            awaiting: n.awaiting,
            resultingDealId: n.resultingDealId,
          }),
        );
      const issues = counterIssues({
        rate: req.rate,
        volume: req.volume,
        round: n.round,
        maxRounds: policy.maxRounds,
      });
      if (issues.length) throw failWith(issues);
      const convert = await loadConverter(tx, ctx.simNow);
      const rateInr = round2(convert(req.rate as number, adv.currencyCode, DEAL_CURRENCY));
      const t = termsOf(n);
      const volume = req.volume ?? t.volume;
      const body =
        req.note?.trim() || `We would like to propose ${req.rate} per thousand impressions.`;
      await tx.negotiationMessage.create({
        data: {
          sandboxId: ctx.sandboxId,
          negotiationId: n.id,
          authorKind: 'BUYER',
          body,
          proposedRate: rateInr,
          ...(volume === null ? {} : { proposedVolume: BigInt(volume) }),
          sentAt: ctx.simNow,
        },
      });
      const next: Terms = { ...t, agreed: false, proposal: { rate: rateInr, volume } };
      await tx.negotiation.update({
        where: { id: n.id },
        data: {
          status: 'COUNTERED',
          awaiting: 'SELLER',
          round: n.round + 1,
          replyAt: new Date(ctx.simNow.getTime() + policy.replyDelayHours * HOUR),
          lastEditedAt: ctx.simNow,
          terms: next as unknown as Prisma.InputJsonValue,
        },
      });
      return { data: undefined };
    }),
  );
}

export async function declineNegotiation(
  user: SessionUser,
  aid: string,
  id: string,
  req: { note?: string } = {},
): Promise<Result<void>> {
  return asResult(() =>
    writeCtx(user, async (tx, ctx) => {
      const adv = await loadAdvertiser(tx, ctx, aid);
      await settleNegotiations(tx, ctx, adv.partnerId);
      const n = await loadOwn(tx, adv, id);
      const issues = acceptNegotiationIssues({
        status: n.status,
        awaiting: n.awaiting,
        resultingDealId: n.resultingDealId,
      });
      if (issues.length) throw failWith(issues);
      await tx.negotiationMessage.create({
        data: {
          sandboxId: ctx.sandboxId,
          negotiationId: n.id,
          authorKind: 'BUYER',
          body: req.note?.trim() || 'We are declining this proposal.',
          sentAt: ctx.simNow,
        },
      });
      await tx.negotiation.update({
        where: { id: n.id },
        data: { status: 'DECLINED', awaiting: 'NONE', replyAt: null, lastEditedAt: ctx.simNow },
      });
      return { data: undefined };
    }),
  );
}

/** Accept the terms on the table: creates the Draft deal (PG when the commitment is Guaranteed) and links it. */
export async function acceptNegotiation(
  user: SessionUser,
  aid: string,
  id: string,
): Promise<Result<{ dealId: string }>> {
  return asResult(() =>
    writeCtx(user, async (tx, ctx) => {
      const adv = await loadAdvertiser(tx, ctx, aid);
      await settleNegotiations(tx, ctx, adv.partnerId);
      const n = await loadOwn(tx, adv, id);
      const issues = acceptNegotiationIssues({
        status: n.status,
        awaiting: n.awaiting,
        resultingDealId: n.resultingDealId,
      });
      if (issues.length) throw failWith(issues);
      const t = termsOf(n);
      const guaranteed = n.commitment === 'GUARANTEED';
      const today = new Date(
        Date.UTC(ctx.simNow.getUTCFullYear(), ctx.simNow.getUTCMonth(), ctx.simNow.getUTCDate()),
      );
      const startAt = t.startAt ? new Date(t.startAt) : new Date(today.getTime() + 3 * DAY);
      const endAt = t.endAt ? new Date(t.endAt) : new Date(startAt.getTime() + 28 * DAY);
      let order = await tx.inventoryOrder.findFirst({
        where: {
          partnerId: adv.partnerId,
          exchangeId: n.exchangeId,
          name: { endsWith: 'negotiated deals' },
        },
      });
      if (!order)
        order = await tx.inventoryOrder.create({
          data: {
            sandboxId: ctx.sandboxId,
            partnerId: adv.partnerId,
            exchangeId: n.exchangeId,
            sellerName: n.sellerName,
            externalCode: `MP-${String(60000 + (hashString(`neg:${ctx.sandboxId}:${n.exchangeId}`) % 39999))}`,
            name: `${n.sellerName} negotiated deals`,
          },
        });
      const volume = t.volume;
      const deal = await withChangeLog(
        changeCtx(ctx, tx),
        { type: 'DEAL', name: n.name, chain: { advertiserId: adv.id } },
        async (x) => {
          const d = await x.inventorySourceDeal.create({
            data: {
              sandboxId: ctx.sandboxId,
              partnerId: adv.partnerId,
              orderId: order.id,
              exchangeId: n.exchangeId,
              dealId: String(5_100_000 + (hashString(`${ctx.sandboxId}:${n.rfpId}`) % 800_000)),
              name: n.name,
              status: 'DRAFT',
              dealType: guaranteed ? 'PROGRAMMATIC_GUARANTEED' : 'PREFERRED_DEAL',
              sellerName: n.sellerName,
              sellerKind: 'EXCHANGE',
              allowPausing: true,
              commitment: guaranteed ? 'GUARANTEED' : 'NON_GUARANTEED',
              rate: t.rate,
              cost: volume === null ? null : round2((volume / 1000) * t.rate),
              quantityImpressions: volume === null ? null : BigInt(volume),
              startAt,
              endAt,
              format: (t.format as 'DISPLAY' | 'VIDEO' | 'AUDIO' | undefined) ?? 'VIDEO',
              bidRatioPct: 100,
              allAdvertisers: false,
              source: 'NEGOTIATED',
            },
            select: { id: true },
          });
          await x.dealAccess.create({
            data: {
              sandboxId: ctx.sandboxId,
              dealId: d.id,
              advertiserId: adv.id,
              isDefaultAdvertiser: true,
            },
          });
          return d;
        },
      );
      await tx.negotiation.update({
        where: { id: n.id },
        data: {
          status: 'ACCEPTED',
          awaiting: 'NONE',
          replyAt: null,
          resultingDealId: deal.id,
          averagePrice: t.rate,
          spend: volume === null ? null : round2((volume / 1000) * t.rate),
          lastEditedAt: ctx.simNow,
        },
      });
      await tx.negotiationMessage.create({
        data: {
          sandboxId: ctx.sandboxId,
          negotiationId: n.id,
          authorKind: 'BUYER',
          body: 'We accept these terms.',
          proposedRate: t.rate,
          ...(volume === null ? {} : { proposedVolume: BigInt(volume) }),
          sentAt: ctx.simNow,
        },
      });
      return { data: { dealId: deal.id } };
    }),
  );
}
