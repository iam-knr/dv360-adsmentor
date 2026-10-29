// Inventory services against the database (module 13 6.1: 1, 5, 6, 7, 9, 10, 11, 12, 13, 14, 17, 18).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { run as seedMarketplace } from '../../prisma/seed/30-marketplace.seed';
import { assignInventoryToLineItems } from '@/lib/inventory/assign';
import {
  createDealGroup,
  deleteDealGroup,
  getDeal,
  getDealHistory,
  listDealGroups,
  listOrdersDeals,
  listPackages,
  updateDeal,
  updateDealGroup,
} from '@/lib/inventory/deals';
import {
  acceptInstantDeal,
  getInstantContext,
  requestInstantForecast,
} from '@/lib/inventory/instant';
import {
  assignMarketplaceItem,
  bulkAssignMarketplace,
  discover,
  getFeatured,
  getMarketplaceItem,
} from '@/lib/inventory/marketplace';
import {
  acceptNegotiation,
  counterNegotiation,
  declineNegotiation,
  getNegotiation,
  importNegotiation,
  listNegotiations,
} from '@/lib/inventory/negotiations';
import { listPlans } from '@/lib/inventory/plans';
import { dropWorld } from '../db/helpers';
import { createCreativeWorld, setSimHours, userFor } from '../creatives/helpers';

let w: Awaited<ReturnType<typeof createCreativeWorld>>;
let videoLi = '';
let videoLi2 = '';
const aid = () => w.advertiserId;
const user = () => userFor(w);

const must = <T>(r: { ok: boolean; data?: T }): T => {
  if (!r.ok) throw new Error(`expected ok: ${JSON.stringify(r)}`);
  return r.data as T;
};
const fail = (r: { ok: boolean; issues?: { code: string; message: string }[] }) => {
  expect(r.ok).toBe(false);
  return r.issues ?? [];
};

beforeAll(async () => {
  await seedMarketplace();
  w = await createCreativeWorld('inv');
  await prisma.sandbox.update({
    where: { id: w.sandboxId },
    data: { seedTemplateKey: 'starter-agency' },
  });
  const li = await prisma.lineItem.create({
    data: {
      sandboxId: w.sandboxId,
      ioId: w.ioId,
      campaignId: w.campaignId,
      advertiserId: w.advertiserId,
      name: 'Video line item',
      type: 'VIDEO',
    },
  });
  videoLi = li.id;
  videoLi2 = (
    await prisma.lineItem.create({
      data: {
        sandboxId: w.sandboxId,
        ioId: w.ioId,
        campaignId: w.campaignId,
        advertiserId: w.advertiserId,
        name: 'Second video line item',
        type: 'VIDEO',
      },
    })
  ).id;
});
afterAll(async () => {
  await dropWorld(w);
  await prisma.$disconnect();
});

describe('seed and Orders and deals (AC 1, 2)', () => {
  it('lists the planted rows with an order hierarchy and the default status filter', async () => {
    const r = await listOrdersDeals(user(), aid(), {});
    const orders = r.rest.filter((x) => x.kind === 'ORDER');
    expect(orders.length).toBeGreaterThanOrEqual(1);
    const children = orders.flatMap((o) => (o.kind === 'ORDER' ? o.children : []));
    expect(children.length).toBeGreaterThanOrEqual(2);
    expect(children.every((c) => c.status !== 'ARCHIVED')).toBe(true);
    expect(r.canWrite).toBe(true);
  });

  it('puts a guaranteed deal with no line item under Action required', async () => {
    const r = await listOrdersDeals(user(), aid(), {});
    const all = [
      ...r.actionRequired,
      ...r.rest.flatMap((x) => (x.kind === 'ORDER' ? x.children : [x])),
    ];
    const pg = all.filter((d) => d.commitment === 'GUARANTEED');
    expect(pg.length).toBeGreaterThanOrEqual(1);
    for (const d of pg) expect(d.lineItemCount === 0 ? d.actionRequired : true).toBe(true);
  });

  it('is read only for READ_ONLY and a 404 for REPORTING_ONLY (AC 17)', async () => {
    const ro = await listOrdersDeals(userFor(w, 'READ_ONLY'), aid(), {});
    expect(ro.canWrite).toBe(false);
    await expect(listOrdersDeals(userFor(w, 'REPORTING_ONLY'), aid(), {})).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    const denied = await createDealGroup(userFor(w, 'READ_ONLY'), aid(), {
      name: 'x',
      type: 'DEAL_GROUP',
      members: [],
    });
    expect(denied.ok).toBe(false);
  });
});

describe('deal status and History (AC 5, 18)', () => {
  it('pausing a deal that does not allow pausing fails with INV-014, activating a draft works and is logged', async () => {
    const all = await listOrdersDeals(user(), aid(), {
      status: ['ACTIVE', 'PAUSED', 'DRAFT', 'COMPLETED', 'NOT_SERVABLE', 'ARCHIVED'],
    });
    const deals = [
      ...all.actionRequired,
      ...all.rest.flatMap((x) => (x.kind === 'ORDER' ? x.children : [x])),
    ];
    const noPause = deals.find((d) => d.status === 'ACTIVE' && !d.allowPausing);
    if (noPause) {
      const r = await updateDeal(user(), aid(), noPause.id, { status: 'PAUSED' });
      expect(fail(r).map((i) => i.code)).toContain('INV-014');
    }
    const paused = deals.find((d) => d.status === 'ACTIVE' && d.allowPausing);
    expect(paused).toBeDefined();
    must(
      await updateDeal(user(), aid(), (paused as { id: string }).id, {
        status: 'PAUSED',
        note: 'pause for test',
      }),
    );
    must(await updateDeal(user(), aid(), (paused as { id: string }).id, { status: 'ACTIVE' }));
    const history = await getDealHistory(user(), aid(), (paused as { id: string }).id, {});
    expect(history.total).toBeGreaterThanOrEqual(2);
    expect(history.rows[0]?.summary).toBeTruthy();
  });

  it('rejects a frequency cap with a missing period', async () => {
    const all = await listOrdersDeals(user(), aid(), {});
    const d = [
      ...all.actionRequired,
      ...all.rest.flatMap((x) => (x.kind === 'ORDER' ? x.children : [x])),
    ][0];
    const r = await updateDeal(user(), aid(), (d as { id: string }).id, {
      frequencyCap: { enabled: true, maxImpressions: 3, periodCount: 1, period: null },
    });
    expect(r.ok).toBe(false);
  });
});

describe('instant deal (AC 6, 7)', () => {
  const targeting = { 'Country & Region': ['India'], Format: ['Video'] };
  it('forecasts the same numbers twice and less for narrower targeting', async () => {
    const ctx = await getInstantContext(user(), aid());
    expect(ctx.sellers).toHaveLength(9);
    const seller = ctx.sellers[0]!;
    const base = {
      sellerId: seller.id,
      name: 'Festive reach',
      targeting,
      advertiserIds: [ctx.currentAdvertiserId],
    };
    const a = must(await requestInstantForecast(user(), aid(), base));
    const b = must(await requestInstantForecast(user(), aid(), base));
    expect(a.impressions7d).toEqual(b.impressions7d);
    expect(a.impressions7d.p10).toBeLessThanOrEqual(a.impressions7d.p50);
    expect(a.impressions7d.p50).toBeLessThanOrEqual(a.impressions7d.p90);
    const narrow = must(
      await requestInstantForecast(user(), aid(), {
        ...base,
        targeting: { ...targeting, Device: ['Tablet'] },
      }),
    );
    expect(narrow.impressions7d.p50).toBeLessThan(a.impressions7d.p50);
  });

  it('blocks Accept without a forecast and with a stale payload, then creates an Active deal under an order', async () => {
    const ctx = await getInstantContext(user(), aid());
    const seller = ctx.sellers[1]!;
    const payload = {
      sellerId: seller.id,
      name: 'Instant test deal',
      targeting,
      advertiserIds: [ctx.currentAdvertiserId],
    };
    expect(
      fail(await acceptInstantDeal(user(), aid(), { ...payload, forecastToken: null })).map(
        (i) => i.code,
      ),
    ).toContain('INV-006');
    const f = must(await requestInstantForecast(user(), aid(), payload));
    expect(
      fail(
        await acceptInstantDeal(user(), aid(), {
          ...payload,
          name: 'Changed name',
          forecastToken: f.forecastToken,
        }),
      ).map((i) => i.code),
    ).toContain('INV-006');
    const ok = must(
      await acceptInstantDeal(user(), aid(), { ...payload, forecastToken: f.forecastToken }),
    );
    const deal = await getDeal(user(), aid(), ok.dealId);
    expect(deal.row.status).toBe('ACTIVE');
    expect(deal.row.name).toBe('Instant test deal');
    const history = await getDealHistory(user(), aid(), ok.dealId, {});
    expect(history.total).toBeGreaterThanOrEqual(1);
  });

  it('returns INV-001, 002, 004 for an empty form', async () => {
    const codes = fail(
      await acceptInstantDeal(user(), aid(), {
        sellerId: '',
        name: '',
        targeting: {},
        advertiserIds: [],
        forecastToken: null,
      }),
    ).map((i) => i.code);
    expect(codes).toEqual(expect.arrayContaining(['INV-001', 'INV-002', 'INV-004', 'INV-006']));
  });
});

describe('Marketplace (AC 8, 9, 10)', () => {
  it('shows five carousels with the counts of the explore notes', async () => {
    const f = await getFeatured(user(), aid());
    expect(f.carousels.map((c) => c.count)).toEqual([7, 7, 15, 16, 18]);
    expect(f.carousels.every((c) => c.items.length === c.count)).toBe(true);
    expect(f.instantDealSellers).toHaveLength(9);
    expect(f.banner).not.toBeNull();
  });

  it('ranks keyword results and maps AI phrases to filter chips', async () => {
    const k = await discover(user(), aid(), {
      mode: 'KEYWORD',
      query: 'video',
      filters: { format: ['VIDEO'] },
    });
    expect(k.total).toBeGreaterThan(0);
    expect(k.rows.every((r) => r.format === 'VIDEO')).toBe(true);
    const ai = await discover(user(), aid(), {
      mode: 'AI',
      query: 'premium video for sports on connected tv in india',
      filters: {},
    });
    expect(ai.chips).toEqual(expect.arrayContaining(['Format: Video', 'Country: India']));
    const none = await discover(user(), aid(), { mode: 'KEYWORD', query: 'zzzzqqq', filters: {} });
    expect(none.total).toBe(0);
  });

  it('assigns a package once, returns INV-041 the second time, and creates no duplicate rows', async () => {
    const v = await discover(user(), aid(), {
      mode: 'KEYWORD',
      query: '',
      filters: { format: ['VIDEO'], inventoryType: ['PACKAGE'] },
    });
    const pkg = v.rows[0]!;
    const item = await getMarketplaceItem(user(), aid(), pkg.id);
    expect(item.scale.sevenDayImpressions).toBeGreaterThan(0);
    const first = must(
      await assignMarketplaceItem(user(), aid(), pkg.id, { lineItemIds: [videoLi] }),
    );
    expect(first.assigned).toBe(1);
    const again = await assignMarketplaceItem(user(), aid(), pkg.id, { lineItemIds: [videoLi] });
    expect(again.ok).toBe(true);
    if (again.ok) {
      expect(again.warnings?.map((x) => x.code)).toContain('INV-041');
      expect(again.data.assigned).toBe(0);
    }
    const rows = await prisma.lineItemInventory.count({
      where: { lineItemId: videoLi, kind: 'PACKAGE', refId: first.packageId },
    });
    expect(rows).toBe(1);
    expect(
      await prisma.inventoryPackage.count({
        where: { sandboxId: w.sandboxId, marketplaceProductId: pkg.id },
      }),
    ).toBe(1);
  });

  it('refuses a video package on a Display line item with INV-017 and creates nothing (AC 8)', async () => {
    const v = await discover(user(), aid(), {
      mode: 'KEYWORD',
      query: '',
      filters: { format: ['VIDEO'], inventoryType: ['PACKAGE'] },
    });
    const pkg = v.rows[1]!;
    const before = await prisma.inventoryPackage.count({ where: { sandboxId: w.sandboxId } });
    const r = await assignMarketplaceItem(user(), aid(), pkg.id, { lineItemIds: [w.lineItemId] });
    expect(fail(r).map((i) => i.code)).toEqual(['INV-017']);
    expect(await prisma.inventoryPackage.count({ where: { sandboxId: w.sandboxId } })).toBe(before);
    expect(fail(await assignMarketplaceItem(user(), aid(), pkg.id, {})).map((i) => i.code)).toEqual(
      ['INV-040'],
    );
  });

  it('bulk assigns to a Display and a Video line item: one success, one INV-017', async () => {
    const f = await getFeatured(user(), aid());
    const ids = f.carousels[0]!.items.slice(2, 4).map((i) => i.id);
    const r = must(
      await bulkAssignMarketplace(user(), aid(), {
        productIds: ids,
        lineItemIds: [w.lineItemId, videoLi],
      }),
    );
    expect(r.done).toBe(1);
    expect(r.failed).toBe(1);
    expect(r.errors[0]?.message).toContain("can't be assigned to Display");
    expect(
      await prisma.bulkJob.count({
        where: { sandboxId: w.sandboxId, description: { contains: 'Assigned 2 items' } },
      }),
    ).toBe(1);
  });

  it('assigns a marketplace deal and shows it in the grid and on the deal page', async () => {
    const d = await discover(user(), aid(), {
      mode: 'KEYWORD',
      query: '',
      filters: { inventoryType: ['DEAL'], format: ['DISPLAY'] },
    });
    const deal = d.rows[0]!;
    const r = must(
      await assignMarketplaceItem(user(), aid(), deal.id, { lineItemIds: [w.lineItemId] }),
    );
    expect(r.dealId).toBeTruthy();
    const view = await getDeal(user(), aid(), r.dealId as string);
    expect(view.row.lineItemCount).toBe(1);
    const history = await getDealHistory(user(), aid(), r.dealId as string, {});
    expect(history.total).toBeGreaterThanOrEqual(2);
  });
});

describe('assignInventoryToLineItems and packages (M13-11)', () => {
  it('assigns a deal to a line item and is idempotent', async () => {
    const all = await listOrdersDeals(user(), aid(), {});
    const pg = [
      ...all.actionRequired,
      ...all.rest.flatMap((x) => (x.kind === 'ORDER' ? x.children : [x])),
    ].find((d) => d.commitment === 'GUARANTEED')!;
    const first = must(
      await assignInventoryToLineItems(user(), aid(), {
        lineItemIds: [videoLi2],
        items: [{ kind: 'DEAL', id: pg.id, mode: 'INCLUDE' }],
      }),
    );
    expect(first.assigned).toBe(1);
    const second = await assignInventoryToLineItems(user(), aid(), {
      lineItemIds: [videoLi2],
      items: [{ kind: 'DEAL', id: pg.id, mode: 'INCLUDE' }],
    });
    expect(second.ok && second.data.assigned).toBe(0);
    const after = await listOrdersDeals(user(), aid(), {});
    const row = [
      ...after.actionRequired,
      ...after.rest.flatMap((x) => (x.kind === 'ORDER' ? x.children : [x])),
    ].find((d) => d.id === pg.id)!;
    expect(row.lineItemCount).toBe(pg.lineItemCount + 1);
  });

  it('lists the seeded package with the original currency', async () => {
    const pk = await listPackages(user(), aid());
    expect(pk.length).toBeGreaterThanOrEqual(1);
    expect(pk.some((p) => p.rateOriginal?.currency === 'EUR')).toBe(true);
  });
});

describe('deal groups (AC 14)', () => {
  it('needs a name and a type, warns on zero deals, edits and deletes', async () => {
    expect(
      fail(await createDealGroup(user(), aid(), { name: '  ', type: null, members: [] })).map(
        (i) => i.code,
      ),
    ).toEqual(expect.arrayContaining(['INV-015', 'INV-042']));
    const made = await createDealGroup(user(), aid(), {
      name: 'Empty group',
      type: 'DEAL_GROUP',
      members: [],
    });
    expect(made.ok && made.warnings?.map((x) => x.code)).toContain('INV-016');
    const id = must(made).id;
    const all = await listOrdersDeals(user(), aid(), {});
    const deal = [
      ...all.actionRequired,
      ...all.rest.flatMap((x) => (x.kind === 'ORDER' ? x.children : [x])),
    ][0]!;
    must(
      await updateDealGroup(user(), aid(), id, {
        name: 'Renamed group',
        type: 'PREFERRED_DEAL_GROUP',
        members: [{ kind: 'DEAL', id: deal.id }],
      }),
    );
    const rows = await listDealGroups(user(), aid());
    const g = rows.find((x) => x.id === id)!;
    expect(g.name).toBe('Renamed group');
    expect(g.members).toHaveLength(1);
    must(await deleteDealGroup(user(), aid(), id));
    expect((await listDealGroups(user(), aid())).some((x) => x.id === id)).toBe(false);
  });
});

describe('negotiations (AC 11, 12, 13)', () => {
  it('reports an unknown RFP and imports the seeded one', async () => {
    expect(
      fail(await importNegotiation(user(), aid(), { rfpId: 'RFP-999999' })).map((i) => i.code),
    ).toEqual(['INV-018']);
    expect(
      fail(await importNegotiation(user(), aid(), { rfpId: '' })).map((i) => i.message),
    ).toEqual(['Enter a value']);
    const before = await listNegotiations(user(), aid());
    expect(before.rows.some((r) => r.rfpId === 'RFP-100231')).toBe(false);
    must(await importNegotiation(user(), aid(), { rfpId: 'rfp-100231' }));
    expect(
      fail(await importNegotiation(user(), aid(), { rfpId: 'RFP-100231' })).map((i) => i.code),
    ).toEqual(['INV-032']);
    const after = await listNegotiations(user(), aid());
    const row = after.rows.find((r) => r.rfpId === 'RFP-100231')!;
    expect(row.status).toBe('PROPOSED');
    expect(row.awaiting).toBe('BUYER');
  });

  it('counter, wait for the seller on the sim clock, accept, and a Draft PG deal appears', async () => {
    const row = (await listNegotiations(user(), aid())).rows.find((r) => r.rfpId === 'RFP-100231')!;
    expect(
      fail(await counterNegotiation(user(), aid(), row.id, { rate: 0 })).map((i) => i.code),
    ).toContain('INV-030');
    must(
      await counterNegotiation(user(), aid(), row.id, {
        rate: 150,
        volume: 1_000_000,
        note: 'Lower rate please',
      }),
    );
    let v = await getNegotiation(user(), aid(), row.id);
    expect(v.row.status).toBe('COUNTERED');
    expect(v.row.awaiting).toBe('SELLER');
    expect(v.banner).toBe('Waiting for the seller');
    // the seller's reply is not due yet
    expect(fail(await acceptNegotiation(user(), aid(), row.id)).map((i) => i.code)).toEqual([
      'INV-033',
    ]);
    await setSimHours(w, 48);
    v = await getNegotiation(user(), aid(), row.id);
    expect(v.row.awaiting).toBe('BUYER');
    expect(v.messages.at(-1)?.authorKind).toBe('SELLER');
    // 150 is above the seller floor of 140, so the seller agrees to the buyer's terms
    expect(v.terms.rate).toBe(150);
    const accepted = must(await acceptNegotiation(user(), aid(), row.id));
    const deal = await getDeal(user(), aid(), accepted.dealId);
    expect(deal.row.status).toBe('DRAFT');
    expect(deal.row.commitment).toBe('GUARANTEED');
    expect(deal.row.dealType).toBe('PROGRAMMATIC_GUARANTEED');
    const done = await getNegotiation(user(), aid(), row.id);
    expect(done.row.status).toBe('ACCEPTED');
    expect(done.resultingDeal?.id).toBe(accepted.dealId);
    // a Draft deal is activated by the student
    must(await updateDeal(user(), aid(), accepted.dealId, { status: 'ACTIVE' }));
    expect((await getDeal(user(), aid(), accepted.dealId)).row.status).toBe('ACTIVE');
  });

  it('declines after three low counters get a final offer (INV-034) and the student can decline', async () => {
    const t = await prisma.negotiation.create({
      data: {
        sandboxId: w.sandboxId,
        partnerId: w.partnerId,
        advertiserId: w.advertiserId,
        exchangeId: w.exchangeId,
        sellerName: 'Test Seller',
        name: 'Low ball',
        rfpId: 'RFP-LOWBALL',
        status: 'PROPOSED',
        awaiting: 'BUYER',
        round: 0,
        commitment: 'NON_GUARANTEED',
        volume: 500_000n,
        averagePrice: 200,
        sellerPolicy: { minRate: 180, maxVolume: 1_000_000, maxRounds: 3, replyDelayHours: 6 },
        terms: {
          rate: 200,
          sellerRate: 200,
          volume: 500_000,
          format: 'DISPLAY',
          commitment: 'NON_GUARANTEED',
        },
      },
    });
    let hours = 100;
    for (let i = 0; i < 3; i++) {
      must(await counterNegotiation(user(), aid(), t.id, { rate: 50 }));
      hours += 12;
      await setSimHours(w, hours);
    }
    const v = await getNegotiation(user(), aid(), t.id);
    expect(v.finalOffer).toBe(true);
    expect(v.terms.rate).toBe(180);
    expect(
      fail(await counterNegotiation(user(), aid(), t.id, { rate: 100 })).map((i) => i.code),
    ).toEqual(['INV-034']);
    must(await declineNegotiation(user(), aid(), t.id));
    expect((await getNegotiation(user(), aid(), t.id)).row.status).toBe('DECLINED');
  });

  it('expires an open negotiation after its expiry time', async () => {
    const t = await prisma.negotiation.create({
      data: {
        sandboxId: w.sandboxId,
        partnerId: w.partnerId,
        advertiserId: w.advertiserId,
        exchangeId: w.exchangeId,
        sellerName: 'Test Seller',
        name: 'Short lived',
        rfpId: 'RFP-SHORT',
        status: 'PROPOSED',
        awaiting: 'BUYER',
        expiresAt: new Date('2026-01-01T00:00:00Z'),
        terms: { rate: 100, volume: 1000 },
      },
    });
    await setSimHours(w, 200);
    expect((await getNegotiation(user(), aid(), t.id)).row.status).toBe('EXPIRED');
  });
});

describe('Plans list', () => {
  it('lists planned and trafficked plans of the advertiser', async () => {
    await prisma.plan.create({
      data: {
        sandboxId: w.sandboxId,
        advertiserId: w.advertiserId,
        name: 'Diwali plan',
        locationCountry: 'IN',
        currencyCode: 'INR',
        startDate: new Date('2026-10-01'),
        endDate: new Date('2026-11-15'),
        totalBudget: 500000,
        channels: ['DIGITAL'],
      },
    });
    const rows = await listPlans(user(), aid());
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      name: 'Diwali plan',
      channels: ['Digital'],
      status: 'PLANNED',
    });
    expect(await listPlans(user(), aid(), { status: ['TRAFFICKED'] })).toHaveLength(0);
  });
});
