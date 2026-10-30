import 'server-only';
// Loads the stored entities of an advertiser as SDF models (module 11 4.4, ENG 8.3 read-only snapshot).
import type { Tx } from '@/lib/db';
import { campaignToWire } from '@/lib/campaigns/mapping';
import { ioToWire } from '@/lib/insertion-orders/mapping';
import { LI_INCLUDE, rowToForm } from '@/lib/line-items/load';
import { campaignMaps, type CampaignModel } from './map-campaign';
import { ioMaps, type IoModel } from './map-io';
import { emptyRefs, liMaps, type LiModel, type LiRefs } from './map-li';
import { adCells, adGroupCells, mediaCells } from './map-other';
import { columnsFor } from './layouts';
import type { ColMaps } from './map-common';
import type { SdfEntity, SdfVersion } from './versions';

export interface LoadOpts {
  includeArchived: boolean;
  /** Restrict to these row ids (a bulk selection). Descendants of the selection are handled by the caller. */
  campaignIds?: string[];
  ioIds?: string[];
  liIds?: string[];
}

const live = (includeArchived: boolean) =>
  includeArchived ? {} : { status: { not: 'ARCHIVED' as const } };

export async function loadRefs(tx: Tx, advertiserId: string): Promise<LiRefs> {
  const refs = emptyRefs();
  const creatives = await tx.creative.findMany({
    where: { advertiserId },
    select: { id: true, publicId: true },
  });
  for (const c of creatives) {
    refs.creativeToPublic.set(c.id, c.publicId.toString());
    refs.creativeFromPublic.set(c.publicId.toString(), c.id);
  }
  const acts = await tx.floodlightActivity.findMany({
    where: { group: { advertiserId } },
    select: { id: true, publicId: true },
  });
  for (const a of acts) {
    refs.activityToPublic.set(a.id, a.publicId.toString());
    refs.activityFromPublic.set(a.publicId.toString(), a.id);
  }
  return refs;
}

export async function loadCampaignModels(
  tx: Tx,
  advertiserId: string,
  o: LoadOpts,
): Promise<(CampaignModel & { id: string })[]> {
  const rows = await tx.campaign.findMany({
    where: {
      advertiserId,
      ...live(o.includeArchived),
      ...(o.campaignIds ? { id: { in: o.campaignIds } } : {}),
    },
    include: { budgets: { orderBy: { id: 'asc' } }, advertiser: { select: { publicId: true } } },
    orderBy: { publicId: 'asc' },
  });
  return rows.map((c) => ({
    id: c.id,
    publicId: c.publicId.toString(),
    advertiserPublicId: c.advertiser.publicId.toString(),
    updatedAt: c.updatedAt,
    wire: campaignToWire(c),
  }));
}

export async function loadIoModels(
  tx: Tx,
  advertiserId: string,
  o: LoadOpts,
): Promise<(IoModel & { id: string; campaignId: string })[]> {
  const rows = await tx.insertionOrder.findMany({
    where: {
      advertiserId,
      ...live(o.includeArchived),
      ...(o.ioIds ? { id: { in: o.ioIds } } : {}),
      ...(o.campaignIds ? { campaignId: { in: o.campaignIds } } : {}),
    },
    include: { segments: true, fees: true, campaign: { select: { publicId: true } } },
    orderBy: { publicId: 'asc' },
  });
  return rows.map((io) => ({
    id: io.id,
    campaignId: io.campaignId,
    publicId: io.publicId.toString(),
    campaignPublicId: io.campaign.publicId.toString(),
    updatedAt: io.updatedAt,
    wire: ioToWire(io),
  }));
}

export async function loadLiModels(
  tx: Tx,
  advertiserId: string,
  o: LoadOpts,
  refs?: LiRefs,
): Promise<(LiModel & { id: string; ioId: string })[]> {
  const adv = await tx.advertiser.findUniqueOrThrow({
    where: { id: advertiserId },
    select: { partnerId: true },
  });
  const r = refs ?? (await loadRefs(tx, advertiserId));
  const rows = await tx.lineItem.findMany({
    where: {
      advertiserId,
      ...live(o.includeArchived),
      ...(o.liIds ? { id: { in: o.liIds } } : {}),
      ...(o.ioIds ? { ioId: { in: o.ioIds } } : {}),
      ...(o.campaignIds ? { campaignId: { in: o.campaignIds } } : {}),
    },
    include: { ...LI_INCLUDE, io: { select: { publicId: true } } },
    orderBy: { publicId: 'asc' },
  });
  const out = [];
  for (const li of rows) {
    out.push({
      id: li.id,
      ioId: li.ioId,
      publicId: li.publicId.toString(),
      ioPublicId: li.io.publicId.toString(),
      updatedAt: li.updatedAt,
      value: await rowToForm(tx, li, adv.partnerId),
      refs: r,
    });
  }
  return out;
}

export const MAPS = {
  CAMPAIGNS: campaignMaps,
  INSERTION_ORDERS: ioMaps,
  LINE_ITEMS: liMaps,
} as Record<string, ColMaps<never>>;

/** Cells of a model for one version: every column of the layout, blank where the simulator has no value. */
export function cellsOf(
  entity: 'CAMPAIGNS' | 'INSERTION_ORDERS' | 'LINE_ITEMS',
  model: unknown,
  version: SdfVersion,
): Record<string, string> {
  const maps = MAPS[entity]!;
  const out: Record<string, string> = {};
  for (const c of columnsFor(entity, version))
    out[c.name] = (maps[c.name]?.get as ((m: unknown) => string) | undefined)?.(model) ?? '';
  return out;
}

export interface EntityTable {
  entity: SdfEntity;
  headers: string[];
  rows: Record<string, string>[];
}

/** One entity file as header plus cell rows, in Id order. */
export async function exportTable(
  tx: Tx,
  advertiserId: string,
  entity: SdfEntity,
  version: SdfVersion,
  o: LoadOpts,
): Promise<EntityTable> {
  const headers = columnsFor(entity, version).map((c) => c.name);
  let rows: Record<string, string>[] = [];
  if (entity === 'CAMPAIGNS')
    rows = (await loadCampaignModels(tx, advertiserId, o)).map((m) => cellsOf(entity, m, version));
  else if (entity === 'INSERTION_ORDERS')
    rows = (await loadIoModels(tx, advertiserId, o)).map((m) => cellsOf(entity, m, version));
  else if (entity === 'LINE_ITEMS')
    rows = (await loadLiModels(tx, advertiserId, o)).map((m) => cellsOf(entity, m, version));
  else if (entity === 'AD_GROUPS') {
    const groups = await tx.adGroup.findMany({
      where: {
        advertiserId,
        ...live(o.includeArchived),
        ...(o.liIds ? { lineItemId: { in: o.liIds } } : {}),
        ...(o.ioIds || o.campaignIds
          ? {
              lineItem: {
                ...(o.ioIds ? { ioId: { in: o.ioIds } } : {}),
                ...(o.campaignIds ? { campaignId: { in: o.campaignIds } } : {}),
              },
            }
          : {}),
      },
      include: { lineItem: { select: { publicId: true } } },
      orderBy: { publicId: 'asc' },
    });
    rows = groups.map((g) => ({
      ...Object.fromEntries(headers.map((h) => [h, ''])),
      ...adGroupCells({ ...g, lineItemPublicId: g.lineItem.publicId }),
    }));
  } else if (entity === 'ADS') {
    const ads = await tx.ad.findMany({
      where: {
        advertiserId,
        ...live(o.includeArchived),
        ...(o.liIds || o.ioIds || o.campaignIds
          ? {
              adGroup: {
                lineItem: {
                  ...(o.liIds ? { id: { in: o.liIds } } : {}),
                  ...(o.ioIds ? { ioId: { in: o.ioIds } } : {}),
                  ...(o.campaignIds ? { campaignId: { in: o.campaignIds } } : {}),
                },
              },
            }
          : {}),
      },
      include: { adGroup: { select: { publicId: true } } },
      orderBy: { publicId: 'asc' },
    });
    rows = ads.map((a) => ({
      ...Object.fromEntries(headers.map((h) => [h, ''])),
      ...adCells({ ...a, adGroupPublicId: a.adGroup.publicId }),
    }));
  } else {
    const adv = await tx.advertiser.findUniqueOrThrow({
      where: { id: advertiserId },
      select: { partnerId: true, publicId: true },
    });
    const deals = await tx.inventorySourceDeal.findMany({
      where: {
        partnerId: adv.partnerId,
        OR: [{ allAdvertisers: true }, { access: { some: { advertiserId } } }],
      },
      include: { access: { include: { advertiser: { select: { publicId: true } } } } },
      orderBy: { publicId: 'asc' },
    });
    const exchanges = await tx.exchange.findMany({
      where: { id: { in: [...new Set(deals.map((d) => d.exchangeId))] } },
      select: { id: true, name: true },
    });
    const exchangeName = new Map(exchanges.map((e) => [e.id, e.name]));
    rows = deals.map((d) =>
      mediaCells({
        dealId: d.dealId,
        name: d.name,
        dealType: d.dealType,
        exchangeName: exchangeName.get(d.exchangeId) ?? '',
        status: d.status,
        rate: d.rate,
        startAt: d.startAt,
        endAt: d.endAt,
        advertiserPublicIds: d.access.flatMap((a) =>
          a.advertiser ? [a.advertiser.publicId.toString()] : [],
        ),
      }),
    );
  }
  return { entity, headers, rows };
}
