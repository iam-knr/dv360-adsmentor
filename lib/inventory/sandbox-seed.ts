import 'server-only';
// Per-sandbox inventory seed (module 13 3.3): orders, deals, a package, an empty group and two negotiations, plus the
// planted cases of `troubleshooting-lab`. Runs inside the sandbox transaction the first time inventory is read, so
// sandboxes provisioned before this module existed get the same rows without a change to lib/seed (owner P3-05b).
import type { Tx } from '@/lib/db';
import { stableId } from '@/lib/seed/prng';
import { exchangeId } from '@/lib/seed/reference';

const DAY = 86_400_000;
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY);
const midnight = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

export interface SeedInput {
  sandboxId: string;
  partnerId: string;
  templateKey: string;
  simNow: Date;
}

/** True when rows were written. Safe to call on every read: it returns at once when the partner already has inventory. */
export async function ensureSandboxInventory(tx: Tx, input: SeedInput): Promise<boolean> {
  const { sandboxId, partnerId, templateKey } = input;
  if (templateKey === 'blank') return false;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`inv:${sandboxId}`}))`;
  const [deals, packages, negotiations] = await Promise.all([
    tx.inventorySourceDeal.count({ where: { partnerId } }),
    tx.inventoryPackage.count({ where: { partnerId } }),
    tx.negotiation.count({ where: { partnerId } }),
  ]);
  if (deals + packages + negotiations > 0) return false;

  const today = midnight(input.simNow);
  const advertisers = await tx.advertiser.findMany({
    where: { partnerId },
    select: { id: true, currencyCode: true },
    orderBy: { publicId: 'asc' },
  });
  const first = advertisers[0];
  const lis = first
    ? await tx.lineItem.findMany({
        where: { advertiserId: { in: advertisers.map((a) => a.id) } },
        select: { id: true, type: true },
        orderBy: { publicId: 'asc' },
        take: 60,
      })
    : [];
  const displayLi = lis.find((l) => l.type === 'DISPLAY');
  const videoLi = lis.find((l) => l.type === 'VIDEO' || l.type === 'CTV') ?? lis[0];

  const order = (code: string, name: string, seller: string, ext: string) =>
    tx.inventoryOrder.create({
      data: { sandboxId, partnerId, exchangeId: exchangeId(code), sellerName: seller, externalCode: ext, name },
    });
  const access = (dealId: string) =>
    tx.dealAccess.create({ data: { sandboxId, dealId, partnerId, advertiserId: null } });

  const o1 = await order('index-exchange', 'Reach and frequency order', 'Index Exchange', 'MP-48210');
  const baseDeal = {
    sandboxId,
    partnerId,
    status: 'ACTIVE' as const,
    allAdvertisers: true,
    source: 'NEGOTIATED' as const,
    creativeSource: 'Advertiser provided',
  };
  const preferred = await tx.inventorySourceDeal.create({
    data: {
      ...baseDeal,
      orderId: o1.id,
      exchangeId: o1.exchangeId,
      dealId: '5310021',
      name: 'Reach Plus Preferred Deal',
      description: 'Display inventory with first look at a fixed rate.',
      dealType: 'PREFERRED_DEAL',
      sellerName: 'Index Exchange',
      sellerKind: 'EXCHANGE',
      allowPausing: true,
      rate: 220,
      rateType: 'FIXED',
      bidRatioPct: 42,
      format: 'DISPLAY',
      sizes: ['300x250', '728x90', '320x50'],
      startAt: addDays(today, -20),
      endAt: addDays(today, 70),
    },
  });
  const auction = await tx.inventorySourceDeal.create({
    data: {
      ...baseDeal,
      orderId: o1.id,
      exchangeId: o1.exchangeId,
      dealId: '5310022',
      name: 'Streaming Private Auction',
      description: 'Invited-bidder auction with a floor price.',
      dealType: 'PRIVATE_AUCTION',
      sellerName: 'Index Exchange',
      sellerKind: 'EXCHANGE',
      allowPausing: true,
      rate: 95,
      floorPrice: 95,
      rateType: 'FLOOR',
      bidRatioPct: 31,
      format: 'VIDEO',
      sizes: ['640x360', '1280x720'],
      startAt: addDays(today, -20),
      endAt: addDays(today, 70),
    },
  });
  const o2 = await order('magnite-dv', 'Guaranteed video order', 'Magnite DV+', 'MP-48377');
  const pg = await tx.inventorySourceDeal.create({
    data: {
      ...baseDeal,
      orderId: o2.id,
      exchangeId: o2.exchangeId,
      dealId: '5310377',
      name: 'Prime Video PG Deal',
      description: 'Programmatic Guaranteed video, 2M impressions over 14 days.',
      dealType: 'PROGRAMMATIC_GUARANTEED',
      sellerName: 'Magnite DV+',
      sellerKind: 'EXCHANGE',
      commitment: 'GUARANTEED',
      allowPausing: false,
      rate: 145,
      rateType: 'FIXED',
      cost: 290000,
      quantityImpressions: 2_000_000n,
      format: 'VIDEO',
      durationSeconds: 30,
      sizes: ['640x360', '1280x720'],
      startAt: addDays(today, -3),
      endAt: addDays(today, 11),
      bidRatioPct: 100,
    },
  });
  for (const d of [preferred, auction, pg]) await access(d.id);
  const assignTo = [
    { li: displayLi, kind: 'DEAL' as const, id: preferred.id },
    { li: videoLi, kind: 'DEAL' as const, id: pg.id },
  ];
  for (const a of assignTo)
    if (a.li)
      await tx.lineItemInventory.create({
        data: { sandboxId, lineItemId: a.li.id, kind: a.kind, refId: a.id },
      });

  const pkg = await tx.inventoryPackage.create({
    data: {
      sandboxId,
      partnerId,
      exchangeId: exchangeId('google-ad-manager'),
      name: 'Prime Homepage Takeover',
      packageUuid: stableId('package', `${sandboxId}:homepage`).replace(/^c/, '').padEnd(32, '0'),
      format: 'DISPLAY',
      dealType: 'PRIVATE_AUCTION',
      rate: 529.29,
      floorPrice: 480,
      currencyCode: first?.currencyCode ?? 'INR',
      rateCurrencyOriginal: 'EUR',
      rateOriginal: 5,
      bidRatioPct: 38,
      startAt: addDays(today, -10),
      endAt: addDays(today, 80),
    },
  });
  if (displayLi)
    await tx.lineItemInventory.create({
      data: { sandboxId, lineItemId: displayLi.id, kind: 'PACKAGE', refId: pkg.id },
    });

  if (first)
    await tx.dealGroup.create({
      data: { sandboxId, advertiserId: first.id, name: 'Priority deals', kind: 'DEAL_GROUP' },
    });

  const policy = { minRate: 140, maxVolume: 2_000_000, maxRounds: 3, replyDelayHours: 12 };
  const proposed = await tx.negotiation.create({
    data: {
      sandboxId,
      partnerId,
      advertiserId: null,
      exchangeId: exchangeId('magnite-dv'),
      sellerName: 'Magnite DV+',
      name: 'Festival Video Reach',
      rfpId: 'RFP-100231',
      status: 'PROPOSED',
      awaiting: 'BUYER',
      round: 0,
      commitment: 'GUARANTEED',
      volume: 1_500_000n,
      averagePrice: 180,
      sellerPolicy: policy,
      terms: {
        rate: 180,
        sellerRate: 180,
        volume: 1_500_000,
        startAt: addDays(today, 3).toISOString(),
        endAt: addDays(today, 31).toISOString(),
        format: 'VIDEO',
        commitment: 'GUARANTEED',
        targeting: 'India, Video, Connected TV',
        expiresAt: addDays(today, 45).toISOString(),
      },
    },
  });
  await tx.negotiationMessage.create({
    data: {
      sandboxId,
      negotiationId: proposed.id,
      authorKind: 'SELLER',
      body: 'We drafted this proposal for your review. Counter with your preferred rate and volume.',
      proposedRate: 180,
      proposedVolume: 1_500_000n,
    },
  });
  const accepted = await tx.negotiation.create({
    data: {
      sandboxId,
      partnerId,
      advertiserId: first?.id ?? null,
      exchangeId: o2.exchangeId,
      sellerName: 'Magnite DV+',
      name: 'Prime Video PG Deal',
      rfpId: 'RFP-100118',
      status: 'ACCEPTED',
      awaiting: 'NONE',
      round: 1,
      commitment: 'GUARANTEED',
      volume: 2_000_000n,
      averagePrice: 145,
      spend: 290000,
      sellerPolicy: policy,
      resultingDealId: pg.id,
      terms: {
        rate: 145,
        sellerRate: 145,
        volume: 2_000_000,
        startAt: addDays(today, -3).toISOString(),
        endAt: addDays(today, 11).toISOString(),
        format: 'VIDEO',
        commitment: 'GUARANTEED',
        targeting: 'India, Video',
      },
    },
  });
  await tx.negotiationMessage.createMany({
    data: [
      { sandboxId, negotiationId: accepted.id, authorKind: 'SELLER' as const, body: 'Proposal drafted.', proposedRate: 160, proposedVolume: 2_000_000n },
      { sandboxId, negotiationId: accepted.id, authorKind: 'BUYER' as const, body: 'Countering at 145.', proposedRate: 145, proposedVolume: 2_000_000n },
      { sandboxId, negotiationId: accepted.id, authorKind: 'SELLER' as const, body: 'Your terms work for us. We accept this proposal.', proposedRate: 145, proposedVolume: 2_000_000n },
    ],
  });

  if (templateKey === 'troubleshooting-lab') {
    const lab = await order('openx', 'Troubleshooting order', 'OpenX', 'MP-49002');
    const common = { ...baseDeal, orderId: lab.id, exchangeId: lab.exchangeId, sellerName: 'OpenX', sellerKind: 'EXCHANGE' as const, commitment: 'GUARANTEED' as const, dealType: 'PROGRAMMATIC_GUARANTEED' as const, format: 'DISPLAY' as const, rate: 130, rateType: 'FIXED' as const, bidRatioPct: 100 };
    const expired = await tx.inventorySourceDeal.create({
      data: {
        ...common,
        dealId: '5320001',
        name: 'Expired PG, 40% delivered',
        quantityImpressions: 1_000_000n,
        shortfallImpressions: 600_000n,
        startAt: addDays(today, -40),
        endAt: addDays(today, -10),
        lastDeliveredAt: addDays(today, -10),
      },
    });
    const orphan = await tx.inventorySourceDeal.create({
      data: {
        ...common,
        dealId: '5320002',
        name: 'PG with no line item',
        quantityImpressions: 800_000n,
        startAt: addDays(today, -1),
        endAt: addDays(today, 20),
      },
    });
    const offline = await tx.inventorySourceDeal.create({
      data: {
        ...common,
        commitment: 'NON_GUARANTEED',
        dealType: 'PREFERRED_DEAL',
        dealId: '5320003',
        name: 'Deal on a disabled exchange',
        rate: 160,
        startAt: addDays(today, -15),
        endAt: addDays(today, 60),
      },
    });
    for (const d of [expired, orphan, offline]) await access(d.id);
    await tx.partnerExchange.upsert({
      where: { partnerId_exchangeId: { partnerId, exchangeId: lab.exchangeId } },
      create: { sandboxId, partnerId, exchangeId: lab.exchangeId, enabled: false },
      update: { enabled: false },
    });
  }
  return true;
}
