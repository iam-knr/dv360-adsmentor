import 'server-only';
// Instant deal services (module 13 S5, 4.1): seller cards, forecast and accept. The forecast is the deterministic
// stand-in of forecast.ts (RC-026); Accept needs the token the forecast issued for the same payload (INV-006).
import type { SessionUser } from '@/lib/auth/types';
import { withChangeLog } from '@/lib/changelog';
import {
  asResult,
  changeCtx,
  notFound,
  ServiceFailure,
  type Result,
} from '@/lib/campaigns/service-kit';
import type { WireIssue } from '@/lib/campaigns/wire';
import { hashString } from '@/lib/seed/prng';
import type { Issue } from '@/lib/validation/types';
import { DEAL_CURRENCY, loadConverter, round2 } from './data';
import {
  forecastInstantDeal,
  forecastTokenValid,
  issueForecastToken,
  type TokenPayload,
} from './forecast';
import { loadAdvertiser, readCtx, writeCtx } from './guard';
import { instantDealIssues } from './rules';
import type { InstantDealForecastView, InstantDealPayload, SellerCard } from './types';

const DAY = 86_400_000;
const midnight = (d: Date) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

const toWire = (i: Issue): WireIssue => ({
  path: i.path,
  severity: i.severity,
  code: i.ruleId,
  message: i.message,
});
const failWith = (issues: Issue[]) => new ServiceFailure('INVALID', issues.map(toWire));

export interface InstantContext {
  sellers: SellerCard[];
  advertisers: { id: string; name: string }[];
  currentAdvertiserId: string;
  currencyCode: string;
}

/** Seller cards plus the advertisers of the partner (for the Advertiser access checklist). */
export async function getInstantContext(user: SessionUser, aid: string): Promise<InstantContext> {
  return readCtx(user, async (tx, ctx) => {
    const adv = await loadAdvertiser(tx, ctx, aid);
    const [products, advertisers, convert] = await Promise.all([
      tx.marketplaceProduct.findMany({
        where: { isInstantSeller: true },
        orderBy: { name: 'asc' },
      }),
      tx.advertiser.findMany({
        where: { partnerId: adv.partnerId },
        select: { id: true, name: true },
        orderBy: { publicId: 'asc' },
      }),
      loadConverter(tx, ctx.simNow),
    ]);
    return {
      sellers: products.map((p) => ({
        id: p.id,
        name: p.name,
        kind: p.sellerKind === 'PUBLISHER' ? ('PUBLISHER' as const) : ('EXCHANGE' as const),
        format: (p.scale as { format: SellerCard['format'] }).format,
        floorCpm: round2(convert(Number(p.floorPrice ?? 0), p.floorCurrency, adv.currencyCode)),
        currencyCode: adv.currencyCode,
        options: (p.instantTargetingOptions as Record<string, string[]> | null) ?? {},
      })),
      advertisers,
      currentAdvertiserId: adv.id,
      currencyCode: adv.currencyCode,
    };
  });
}

const tokenPayload = (p: InstantDealPayload): TokenPayload => ({
  sellerId: p.sellerId,
  name: p.name,
  targeting: p.targeting,
  advertiserIds: p.advertiserIds,
});

/** Request forecast: INV-001, 002, 004, 005 must hold; the result carries the token that unlocks Accept. */
export async function requestInstantForecast(
  user: SessionUser,
  aid: string,
  payload: InstantDealPayload,
): Promise<Result<InstantDealForecastView>> {
  return asResult(() =>
    readCtx(user, async (tx, ctx) => {
      const adv = await loadAdvertiser(tx, ctx, aid);
      const issues = instantDealIssues({
        sellerId: payload.sellerId || null,
        name: payload.name,
        targeting: payload.targeting,
        advertiserIds: payload.advertiserIds,
        forecastToken: 'pending',
      });
      if (issues.length) throw failWith(issues);
      const seller = await tx.marketplaceProduct.findFirst({
        where: { id: payload.sellerId, isInstantSeller: true },
      });
      if (!seller) throw notFound();
      const convert = await loadConverter(tx, ctx.simNow);
      const options = (seller.instantTargetingOptions as Record<string, string[]> | null) ?? {};
      const floorCpm = convert(
        Number(seller.floorPrice ?? 0),
        seller.floorCurrency,
        adv.currencyCode,
      );
      const f = forecastInstantDeal({
        sellerId: seller.id,
        sellerImpressions7d: Number(seller.sevenDayImpressions),
        floorCpm,
        targeting: payload.targeting,
        optionCounts: Object.fromEntries(Object.entries(options).map(([k, v]) => [k, v.length])),
        seed: hashString(ctx.sandboxId),
      });
      return {
        data: {
          ...f,
          currencyCode: adv.currencyCode,
          asOf: ctx.simNow.toISOString(),
          forecastToken: issueForecastToken(tokenPayload(payload), Date.now()),
        },
      };
    }),
  );
}

export async function acceptInstantDeal(
  user: SessionUser,
  aid: string,
  payload: InstantDealPayload & { forecastToken: string | null },
): Promise<Result<{ dealId: string; orderId: string }>> {
  return asResult(() =>
    writeCtx(user, async (tx, ctx) => {
      const adv = await loadAdvertiser(tx, ctx, aid);
      const valid = forecastTokenValid(payload.forecastToken, tokenPayload(payload), Date.now());
      const issues = instantDealIssues({
        sellerId: payload.sellerId || null,
        name: payload.name,
        targeting: payload.targeting,
        advertiserIds: payload.advertiserIds,
        forecastToken: valid ? payload.forecastToken : null,
      });
      if (issues.length) throw failWith(issues);
      const seller = await tx.marketplaceProduct.findFirst({
        where: { id: payload.sellerId, isInstantSeller: true },
      });
      if (!seller) throw notFound();
      const own = await tx.advertiser.findMany({
        where: { partnerId: adv.partnerId, id: { in: payload.advertiserIds } },
        select: { id: true },
      });
      if (own.length !== new Set(payload.advertiserIds).size) throw notFound();

      let order = await tx.inventoryOrder.findFirst({
        where: {
          partnerId: adv.partnerId,
          exchangeId: seller.exchangeId,
          name: { endsWith: 'instant deals' },
        },
      });
      if (!order)
        order = await tx.inventoryOrder.create({
          data: {
            sandboxId: ctx.sandboxId,
            partnerId: adv.partnerId,
            exchangeId: seller.exchangeId,
            sellerName: seller.name,
            externalCode: `MP-${String(50000 + (hashString(`io:${ctx.sandboxId}:${seller.id}`) % 49999))}`,
            name: `${seller.name} instant deals`,
          },
        });
      const convert = await loadConverter(tx, ctx.simNow);
      const floorInr = round2(
        convert(Number(seller.floorPrice ?? 0), seller.floorCurrency, DEAL_CURRENCY),
      );
      const today = midnight(ctx.simNow);
      const taken = await tx.inventorySourceDeal.count({
        where: { partnerId: adv.partnerId, source: 'INSTANT' },
      });
      const targeting = Object.fromEntries(
        Object.entries(payload.targeting).filter(([, v]) => v.length),
      );
      const deal = await withChangeLog(
        changeCtx(ctx, tx),
        { type: 'DEAL', name: payload.name.trim(), chain: { advertiserId: adv.id } },
        async (t) => {
          const d = await t.inventorySourceDeal.create({
            data: {
              sandboxId: ctx.sandboxId,
              partnerId: adv.partnerId,
              orderId: order.id,
              exchangeId: seller.exchangeId,
              dealId: String(
                2_000_000 +
                  (hashString(`${ctx.sandboxId}:${seller.id}:${payload.name.trim()}`) % 900_000) +
                  taken,
              ),
              name: payload.name.trim(),
              description: seller.description,
              status: 'ACTIVE',
              dealType: 'PRIVATE_AUCTION',
              sellerName: seller.name,
              sellerKind: seller.sellerKind,
              allowPausing: true,
              commitment: 'NON_GUARANTEED',
              rate: round2(floorInr * 1.3),
              floorPrice: floorInr,
              startAt: today,
              endAt: new Date(today.getTime() + 90 * DAY),
              format: (seller.scale as { format: 'DISPLAY' | 'VIDEO' | 'AUDIO' }).format,
              targetingSummary: targeting,
              bidRatioPct: 40,
              allAdvertisers: false,
              source: 'INSTANT',
            },
            select: { id: true },
          });
          await t.dealAccess.createMany({
            data: own.map((a) => ({
              sandboxId: ctx.sandboxId,
              dealId: d.id,
              advertiserId: a.id,
              isDefaultAdvertiser: a.id === adv.id,
            })),
          });
          return d;
        },
      );
      return { data: { dealId: deal.id, orderId: order.id } };
    }),
  );
}
