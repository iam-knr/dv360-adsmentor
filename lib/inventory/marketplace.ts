import 'server-only';
// Marketplace services (module 13 S6, S7): Featured, Discover, item slide-over, Assign and Bulk assign. The catalogue
// is the global `MarketplaceProduct` table; assigning a product copies it into the partner's inventory once
// (a package, or a deal under an order of its seller) and then writes the line item rows (INV-040, INV-041, INV-017).
import type { MarketplaceProduct, Prisma } from '@prisma/client';
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
import { MSG } from '@/lib/validation/messages';
import { assignToLineItems, bulkAssign } from './assign';
import { FEATURED_CAROUSELS, MARKETPLACE_BANNERS, type ProductScale } from './catalogue';
import { loadConverter, round2, type Converter } from './data';
import { rank, type DiscoverFilters, type SearchableProduct } from './discover';
import { formatFitsLineItem, FORMAT_LABEL, LINE_ITEM_TYPE_LABEL } from './format-compat';
import { loadAdvertiser, readCtx, writeCtx, type AdvertiserRow } from './guard';
import { INV_MSG, packageCantAssign } from './messages';
import type {
  BulkResponse,
  DiscoverRequest,
  DiscoverResult,
  DiscoverRow,
  FeaturedView,
  Format,
  MarketplaceItem,
  PackageCard,
  SellerCard,
} from './types';

const wire = (
  path: string,
  code: string,
  message: string,
  severity: WireIssue['severity'] = 'error',
): WireIssue => ({
  path,
  severity,
  code,
  message,
});
const fail = (...issues: WireIssue[]) => new ServiceFailure('INVALID', issues);

export const PRODUCT_TYPE_LABEL: Record<string, string> = {
  PACKAGE: 'Package',
  DEAL: 'Deal',
  PUBLISHER: 'Publisher',
  CENTRAL_PARTNER_DEAL: 'Central partner deal',
};

const DAY = 86_400_000;
const midnight = (d: Date) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

const scaleOf = (p: MarketplaceProduct): ProductScale => p.scale as unknown as ProductScale;
const num = (v: Prisma.Decimal | null): number => (v === null ? 0 : Number(v));

/** 7-day impressions are stored as bigint up to 5T; JS numbers hold that exactly. */
const impressions = (p: MarketplaceProduct): number => Number(p.sevenDayImpressions);

function sellerCard(p: MarketplaceProduct, convert: Converter, currency: string): SellerCard {
  const s = scaleOf(p);
  return {
    id: p.id,
    name: p.name,
    kind: p.sellerKind === 'PUBLISHER' ? 'PUBLISHER' : 'EXCHANGE',
    format: s.format,
    floorCpm: round2(convert(num(p.floorPrice), p.floorCurrency, currency)),
    currencyCode: currency,
    options: (p.instantTargetingOptions as Record<string, string[]> | null) ?? {},
  };
}

function packageCard(p: MarketplaceProduct): PackageCard {
  return {
    id: p.id,
    name: p.name,
    type: PRODUCT_TYPE_LABEL[p.type] ?? p.type,
    sevenDayImpressions: impressions(p),
    format: scaleOf(p).format,
  };
}

export async function getFeatured(user: SessionUser, aid: string): Promise<FeaturedView> {
  return readCtx(user, async (tx, ctx) => {
    const adv = await loadAdvertiser(tx, ctx, aid);
    const [products, convert] = await Promise.all([
      tx.marketplaceProduct.findMany({
        orderBy: [{ featuredCarouselOrder: 'asc' }, { name: 'asc' }],
      }),
      loadConverter(tx, ctx.simNow),
    ]);
    const banner =
      MARKETPLACE_BANNERS.find((b) => products.some((p) => p.bannerKey === b.key)) ?? null;
    return {
      banner: banner ? { ...banner } : null,
      carousels: FEATURED_CAROUSELS.map((c) => {
        const items = products.filter((p) => p.featuredCarousel === c.key);
        return { key: c.key, title: c.title, count: items.length, items: items.map(packageCard) };
      }),
      instantDealSellers: products
        .filter((p) => p.isInstantSeller)
        .map((p) => sellerCard(p, convert, adv.currencyCode)),
    };
  });
}

// ---------------------------------------------------------------------------------------------
// Discover
// ---------------------------------------------------------------------------------------------

const FILTER_KEYS: Record<string, keyof DiscoverFilters> = {
  inventoryType: 'inventoryType',
  deviceType: 'deviceType',
  format: 'format',
  gender: 'gender',
  age: 'age',
  audience: 'audience',
  country: 'country',
  category: 'category',
  genre: 'genre',
  exchange: 'exchange',
};

function searchable(
  p: MarketplaceProduct,
  exchangeName: string,
): SearchableProduct & { raw: MarketplaceProduct } {
  const s = scaleOf(p);
  return {
    raw: p,
    id: p.id,
    type: p.type,
    exchangeId: p.exchangeId,
    exchangeName,
    name: p.name,
    searchText: p.searchText,
    sevenDayImpressions: impressions(p),
    format: s.format,
    device: s.devices,
    categories: p.categories,
    country: s.countries,
    genre: s.genres,
  };
}

const exchangeShare = (id: string): number => 5 + (hashString(`share:${id}`) % 31);

function discoverRow(
  s: ReturnType<typeof searchable>,
  convert: Converter,
  currency: string,
): DiscoverRow {
  const p = s.raw;
  return {
    id: p.id,
    name: p.name,
    type: p.type,
    typeLabel: PRODUCT_TYPE_LABEL[p.type] ?? p.type,
    exchangeId: p.exchangeId,
    exchangeName: s.exchangeName,
    exchangeSharePct: exchangeShare(p.id),
    sevenDayImpressions: impressions(p),
    googleAudiences: p.googleAudienceCount,
    categories: p.categories,
    format: s.format as Format,
    floorPrice: round2(convert(num(p.floorPrice), p.floorCurrency, currency)),
  };
}

export async function discover(
  user: SessionUser,
  aid: string,
  req: DiscoverRequest,
): Promise<DiscoverResult> {
  return readCtx(user, async (tx, ctx) => {
    const adv = await loadAdvertiser(tx, ctx, aid);
    const [products, exchanges, convert] = await Promise.all([
      tx.marketplaceProduct.findMany({ orderBy: { name: 'asc' } }),
      tx.exchange.findMany({ select: { id: true, name: true } }),
      loadConverter(tx, ctx.simNow),
    ]);
    const names = new Map(exchanges.map((e) => [e.id, e.name]));
    const all = products.map((p) => searchable(p, names.get(p.exchangeId) ?? ''));
    const filters: DiscoverFilters = {};
    for (const [k, v] of Object.entries(req.filters ?? {})) {
      const key = FILTER_KEYS[k];
      if (key && v.length) filters[key] = v;
    }
    const ranked = rank(all, req.query ?? '', filters, req.mode);
    const pageSize = Math.min(req.pageSize ?? 25, 100);
    const page = Math.max(1, req.page ?? 1);
    const facet = (
      values: (s: (typeof all)[number]) => string[],
      label: (v: string) => string = (v) => v,
    ) => {
      const set = [...new Set(all.flatMap(values))].sort();
      return set.map((value) => ({ value, label: label(value) }));
    };
    return {
      rows: ranked.rows
        .slice((page - 1) * pageSize, page * pageSize)
        .map((s) => discoverRow(s, convert, adv.currencyCode)),
      total: ranked.rows.length,
      page,
      pageSize,
      chips: ranked.chips,
      facets: {
        inventoryType: facet(
          (s) => [s.type],
          (v) => PRODUCT_TYPE_LABEL[v] ?? v,
        ),
        deviceType: facet((s) => s.device),
        format: facet(
          (s) => [s.format],
          (v) => FORMAT_LABEL[v as Format] ?? v,
        ),
        country: facet((s) => s.country),
        category: facet((s) => s.categories),
        genre: facet((s) => s.genre),
        exchange: [...new Map(all.map((s) => [s.exchangeId, s.exchangeName])).entries()]
          .map(([value, label]) => ({ value, label }))
          .sort((a, b) => a.label.localeCompare(b.label)),
      },
    };
  });
}

const dealIdOf = (productId: string): string =>
  String(1_000_000 + (hashString(`deal:${productId}`) % 8_999_999));

async function isAssigned(tx: Tx, partnerId: string, p: MarketplaceProduct): Promise<boolean> {
  if (p.type === 'PACKAGE' || p.type === 'PUBLISHER')
    return (
      (await tx.inventoryPackage.count({
        where: { partnerId, marketplaceProductId: p.id, status: { not: 'ARCHIVED' } },
      })) > 0
    );
  return (
    (await tx.inventorySourceDeal.count({
      where: { partnerId, exchangeId: p.exchangeId, dealId: dealIdOf(p.id) },
    })) > 0
  );
}

export async function getMarketplaceItem(
  user: SessionUser,
  aid: string,
  id: string,
): Promise<MarketplaceItem> {
  return readCtx(user, async (tx, ctx) => {
    const adv = await loadAdvertiser(tx, ctx, aid);
    const p = await tx.marketplaceProduct.findUnique({ where: { id } });
    if (!p) throw notFound();
    const [ex, convert, assigned] = await Promise.all([
      tx.exchange.findUnique({ where: { id: p.exchangeId }, select: { name: true } }),
      loadConverter(tx, ctx.simNow),
      isAssigned(tx, adv.partnerId, p),
    ]);
    const s = scaleOf(p);
    const start = p.startAt ?? midnight(ctx.simNow);
    return {
      id: p.id,
      name: p.name,
      type: p.type,
      typeLabel: PRODUCT_TYPE_LABEL[p.type] ?? p.type,
      exchangeName: ex?.name ?? '',
      sellerName: ex?.name ?? p.name,
      floorPrice: round2(convert(num(p.floorPrice), p.floorCurrency, adv.currencyCode)),
      currencyCode: adv.currencyCode,
      startAt: start.toISOString(),
      endAt: p.endAt ? p.endAt.toISOString() : null,
      format: s.format,
      dealType: s.dealType,
      scale: {
        sevenDayImpressions: impressions(p),
        gender: s.gender,
        geo: s.geo,
        device: s.device,
        formatMix: s.formatMix,
      },
      audiences: s.audiences,
      capabilities: p.googleAudienceCount > 0 ? ['Supports Google audiences'] : [],
      about: p.description ?? '',
      assigned,
    };
  });
}

// ---------------------------------------------------------------------------------------------
// Assign
// ---------------------------------------------------------------------------------------------

/** Copy a catalogue product into the partner's inventory (once per product) and return the new or existing id. */
async function materialise(
  tx: Tx,
  ctx: ServiceCtx,
  adv: AdvertiserRow,
  p: MarketplaceProduct,
  convert: Converter,
): Promise<{ kind: 'PACKAGE' | 'DEAL'; id: string; created: boolean }> {
  const s = scaleOf(p);
  const today = midnight(ctx.simNow);
  if (p.type === 'PACKAGE' || p.type === 'PUBLISHER') {
    const existing = await tx.inventoryPackage.findFirst({
      where: { partnerId: adv.partnerId, marketplaceProductId: p.id, status: { not: 'ARCHIVED' } },
      select: { id: true },
    });
    if (existing) return { kind: 'PACKAGE', id: existing.id, created: false };
    const floor = num(p.floorPrice);
    const rate = round2(floor * 1.2);
    const row = await tx.inventoryPackage.create({
      data: {
        sandboxId: ctx.sandboxId,
        partnerId: adv.partnerId,
        exchangeId: p.exchangeId,
        name: p.name,
        packageUuid:
          `${hashString(`pkg:${ctx.sandboxId}:${p.id}`).toString(16).padStart(8, '0')}${p.id.slice(-24)}`.slice(
            0,
            32,
          ),
        format: s.format,
        dealType: s.dealType,
        rate: round2(convert(rate, p.floorCurrency, adv.currencyCode)),
        floorPrice: round2(convert(floor, p.floorCurrency, adv.currencyCode)),
        currencyCode: adv.currencyCode,
        rateCurrencyOriginal: p.floorCurrency === adv.currencyCode ? null : p.floorCurrency,
        rateOriginal: p.floorCurrency === adv.currencyCode ? null : rate,
        bidRatioPct: 40,
        startAt: today,
        endAt: new Date(today.getTime() + 180 * DAY),
        marketplaceProductId: p.id,
      },
      select: { id: true },
    });
    return { kind: 'PACKAGE', id: row.id, created: true };
  }
  const dealId = dealIdOf(p.id);
  const existing = await tx.inventorySourceDeal.findFirst({
    where: { partnerId: adv.partnerId, exchangeId: p.exchangeId, dealId },
    select: { id: true },
  });
  if (existing) return { kind: 'DEAL', id: existing.id, created: false };
  const ex = await tx.exchange.findUnique({ where: { id: p.exchangeId }, select: { name: true } });
  const sellerName = ex?.name ?? p.name;
  let order = await tx.inventoryOrder.findFirst({
    where: {
      partnerId: adv.partnerId,
      exchangeId: p.exchangeId,
      externalCode: { startsWith: 'MP-9' },
    },
  });
  if (!order)
    order = await tx.inventoryOrder.create({
      data: {
        sandboxId: ctx.sandboxId,
        partnerId: adv.partnerId,
        exchangeId: p.exchangeId,
        sellerName,
        externalCode: `MP-9${String(hashString(`order:${p.exchangeId}`) % 10000).padStart(4, '0')}`,
        name: `${sellerName} marketplace order`,
      },
    });
  const floor = num(p.floorPrice);
  const created = await withChangeLog(
    changeCtx(ctx, tx),
    { type: 'DEAL', name: p.name, chain: { advertiserId: adv.id } },
    async (t) => {
      const d = await t.inventorySourceDeal.create({
        data: {
          sandboxId: ctx.sandboxId,
          partnerId: adv.partnerId,
          orderId: order.id,
          exchangeId: p.exchangeId,
          dealId,
          name: p.name,
          description: p.description,
          status: 'ACTIVE',
          dealType: s.dealType,
          sellerName,
          sellerKind: p.sellerKind,
          allowPausing: true,
          commitment: 'NON_GUARANTEED',
          rate: round2(convert(floor * 1.2, p.floorCurrency, 'INR')),
          floorPrice: round2(convert(floor, p.floorCurrency, 'INR')),
          startAt: today,
          endAt: new Date(today.getTime() + 180 * DAY),
          format: s.format,
          bidRatioPct: 40,
          centralPartnerDeal: p.type === 'CENTRAL_PARTNER_DEAL',
          allAdvertisers: true,
          sizes: s.format === 'DISPLAY' ? ['300x250', '728x90'] : [],
          source: 'MARKETPLACE',
        },
        select: { id: true },
      });
      await t.dealAccess.create({
        data: {
          sandboxId: ctx.sandboxId,
          dealId: d.id,
          partnerId: adv.partnerId,
          advertiserId: null,
        },
      });
      return d;
    },
  );
  return { kind: 'DEAL', id: created.id, created: true };
}

function noFit(types: string[]): WireIssue[] {
  return types.map((t) =>
    wire(
      'lineItem',
      'INV-017',
      packageCantAssign(LINE_ITEM_TYPE_LABEL[t as keyof typeof LINE_ITEM_TYPE_LABEL] ?? t),
    ),
  );
}

export async function assignMarketplaceItem(
  user: SessionUser,
  aid: string,
  productId: string,
  req: { lineItemIds?: string[]; advertiserIds?: string[] },
): Promise<Result<{ packageId?: string; dealId?: string; assigned: number }>> {
  return asResult(() =>
    writeCtx(user, async (tx, ctx) => {
      const adv = await loadAdvertiser(tx, ctx, aid);
      const lineItemIds = [...new Set(req.lineItemIds ?? [])];
      const advertiserIds = [...new Set(req.advertiserIds ?? [])];
      if (lineItemIds.length === 0 && advertiserIds.length === 0)
        throw fail(wire('target', 'INV-040', MSG.SELECTION_REQUIRED));
      const p = await tx.marketplaceProduct.findUnique({ where: { id: productId } });
      if (!p) throw notFound();
      const format = scaleOf(p).format;
      if (lineItemIds.length) {
        const lis = await tx.lineItem.findMany({
          where: { id: { in: lineItemIds }, advertiser: { partnerId: adv.partnerId } },
          select: { id: true, type: true },
        });
        if (lis.length !== lineItemIds.length) throw notFound();
        // nothing is created when no target line item can take the product (INV-017)
        if (lis.every((l) => !formatFitsLineItem(format, l.type)))
          throw fail(...noFit([...new Set(lis.map((l) => l.type))]));
      }
      const convert = await loadConverter(tx, ctx.simNow);
      const m = await materialise(tx, ctx, adv, p, convert);
      const warnings: WireIssue[] = [];
      let assigned = 0;
      if (advertiserIds.length && m.kind === 'DEAL') {
        const own = await tx.advertiser.findMany({
          where: { partnerId: adv.partnerId, id: { in: advertiserIds } },
          select: { id: true },
        });
        if (own.length !== advertiserIds.length) throw notFound();
        await tx.dealAccess.deleteMany({ where: { dealId: m.id } });
        await tx.dealAccess.createMany({
          data: own.map((a) => ({ sandboxId: ctx.sandboxId, dealId: m.id, advertiserId: a.id })),
        });
        await tx.inventorySourceDeal.update({
          where: { id: m.id },
          data: { allAdvertisers: false },
        });
      }
      if (lineItemIds.length) {
        const item = { kind: m.kind, id: m.id, mode: 'INCLUDE' as const };
        if (lineItemIds.length > 1) {
          const { outcome } = await bulkAssign(
            tx,
            ctx,
            adv,
            { lineItemIds, items: [item] },
            `Assigned ${p.name} to ${lineItemIds.length} line items`,
          );
          assigned = outcome.assigned;
          warnings.push(...outcome.warnings);
          if (outcome.alreadyAssigned)
            warnings.push(wire('target', 'INV-041', INV_MSG.ALREADY_ASSIGNED, 'warning'));
        } else {
          const o = await assignToLineItems(tx, ctx, adv, { lineItemIds, items: [item] });
          assigned = o.assigned;
          warnings.push(...o.warnings);
          if (o.alreadyAssigned)
            warnings.push(wire('target', 'INV-041', INV_MSG.ALREADY_ASSIGNED, 'warning'));
        }
      } else if (!m.created) {
        warnings.push(wire('target', 'INV-041', INV_MSG.ALREADY_ASSIGNED, 'warning'));
      }
      return {
        data: { ...(m.kind === 'PACKAGE' ? { packageId: m.id } : { dealId: m.id }), assigned },
        warnings,
      };
    }),
  );
}

export async function bulkAssignMarketplace(
  user: SessionUser,
  aid: string,
  req: { productIds: string[]; lineItemIds: string[] },
): Promise<Result<BulkResponse>> {
  return asResult(() =>
    writeCtx(user, async (tx, ctx) => {
      const adv = await loadAdvertiser(tx, ctx, aid);
      const productIds = [...new Set(req.productIds)];
      const lineItemIds = [...new Set(req.lineItemIds)];
      if (productIds.length === 0 || lineItemIds.length === 0)
        throw fail(wire('target', 'INV-040', MSG.SELECTION_REQUIRED));
      const products = await tx.marketplaceProduct.findMany({ where: { id: { in: productIds } } });
      if (products.length !== productIds.length) throw notFound();
      const lis = await tx.lineItem.findMany({
        where: { id: { in: lineItemIds }, advertiser: { partnerId: adv.partnerId } },
        select: { id: true, type: true },
      });
      if (lis.length !== lineItemIds.length) throw notFound();
      const convert = await loadConverter(tx, ctx.simNow);
      // only products that fit at least one target are copied into the inventory
      const usable = products.filter((p) =>
        lis.some((l) => formatFitsLineItem(scaleOf(p).format, l.type)),
      );
      if (usable.length === 0) throw fail(...noFit([...new Set(lis.map((l) => l.type))]));
      const items: { kind: 'DEAL' | 'PACKAGE'; id: string; mode: 'INCLUDE' }[] = [];
      for (const p of usable) {
        const m = await materialise(tx, ctx, adv, p, convert);
        items.push({ kind: m.kind, id: m.id, mode: 'INCLUDE' });
      }
      const { response, outcome } = await bulkAssign(
        tx,
        ctx,
        adv,
        { lineItemIds, items },
        `Assigned ${products.length} ${products.length === 1 ? 'item' : 'items'} to ${lineItemIds.length} line items`,
      );
      return { data: response, warnings: outcome.warnings };
    }),
  );
}
