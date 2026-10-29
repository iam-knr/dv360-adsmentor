// The entity side of a report: partner tree, lookups for slice keys, and the FX table (module 16 4.3 step 4).
// Loaded once per query inside the caller's transaction; pure after that.
import { fxRate, loadFxTable, type FxTable } from '@/lib/metrics/fx';
import type { Tx } from '@/lib/db';

export interface PartnerInfo {
  id: string;
  publicId: string;
  name: string;
  status: string;
  currencyCode: string;
  timeZone: string;
}
export interface AdvertiserInfo {
  id: string;
  publicId: string;
  name: string;
  status: string;
  currencyCode: string;
  timeZone: string;
  integrationCode: string | null;
}
export interface CampaignInfo {
  id: string;
  publicId: string;
  advertiserId: string;
  name: string;
  status: string;
  goal: string | null;
  start: string;
  end: string | null;
}
export interface SegmentInfo {
  id: string;
  ioId: string;
  name: string;
  amount: number;
  start: string;
  end: string;
  ordinal: number;
}
export interface IoInfo {
  id: string;
  publicId: string;
  campaignId: string;
  advertiserId: string;
  name: string;
  status: string;
  kpi: string | null;
  kpiValue: number | null;
  integrationCode: string | null;
  dailyFrequency: string;
  segments: SegmentInfo[];
}
export interface LineItemInfo {
  id: string;
  publicId: string;
  ioId: string;
  campaignId: string;
  advertiserId: string;
  name: string;
  status: string;
  type: string;
  budget: number | null;
  start: string | null;
  end: string | null;
  integrationCode: string | null;
  dailyFrequency: string;
  lifetimeFrequency: string;
  bidStrategyType: string;
  optimizedTargeting: boolean;
  creativeIds: string[];
}
export interface CreativeInfo {
  id: string;
  publicId: string;
  name: string;
  kind: string;
  status: string;
  source: string;
  width: number;
  height: number;
  integrationCode: string | null;
  companionId: string | null;
}
export interface ExchangeInfo {
  id: string;
  code: string;
  name: string;
}
export interface NamedRef {
  id: string;
  publicId: string;
  name: string;
}

export interface World {
  partner: PartnerInfo;
  advertisers: Map<string, AdvertiserInfo>;
  campaigns: Map<string, CampaignInfo>;
  ios: Map<string, IoInfo>;
  lineItems: Map<string, LineItemInfo>;
  creatives: Map<string, CreativeInfo>;
  exchangesById: Map<string, ExchangeInfo>;
  exchangesByCode: Map<string, ExchangeInfo>;
  activities: Map<string, NamedRef>;
  adGroups: Map<string, NamedRef>;
  fx: FxTable;
  simNow: Date;
  /** Hourly retention in sim days (RC-024). */
  hourlyDays: number;
}

const iso = (d: Date | null | undefined): string | null =>
  d ? d.toISOString().slice(0, 10) : null;
const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));
const HOUR_MS = 3_600_000;

function freqText(
  mode: string,
  max: number | null,
  unit: string | null,
  count: number | null,
): string {
  if (mode === 'UNLIMITED') return 'Unlimited';
  if (mode === 'INHERIT') return 'Inherited';
  return `${max ?? 0} per ${count ?? 1} ${(unit ?? 'day').toLowerCase()}`;
}

// Defaults used when the table has no rows (a dev database that was not seeded): the same invented rates as
// data/reference/fx-rates.json (RC-025).
const DEFAULT_PER_USD: Record<string, number> = {
  INR: 88,
  SGD: 1.34,
  AED: 3.67,
  GBP: 0.78,
  EUR: 0.92,
  AUD: 1.52,
  IDR: 16300,
  BRL: 5.4,
};

function withDefaults(table: FxTable): FxTable {
  const out: FxTable = new Map(table);
  for (const [cur, rate] of Object.entries(DEFAULT_PER_USD)) {
    if (!out.has(`USD>${cur}`) && !out.has(`${cur}>USD`)) out.set(`USD>${cur}`, rate);
  }
  return out;
}

export async function loadWorld(tx: Tx, sandboxId: string, partnerId: string): Promise<World> {
  const partnerRow = await tx.partner.findFirst({ where: { id: partnerId, sandboxId } });
  if (!partnerRow) throw new Error('PARTNER_NOT_FOUND');
  const [
    advs,
    camps,
    ios,
    lis,
    segs,
    creatives,
    exchanges,
    acts,
    adGroups,
    clock,
    assigns,
    fxTable,
  ] = await Promise.all([
    tx.advertiser.findMany({ where: { sandboxId, partnerId } }),
    tx.campaign.findMany({ where: { sandboxId, advertiser: { partnerId } } }),
    tx.insertionOrder.findMany({ where: { sandboxId, advertiser: { partnerId } } }),
    tx.lineItem.findMany({ where: { sandboxId, advertiser: { partnerId } } }),
    tx.budgetSegment.findMany({ where: { sandboxId, io: { advertiser: { partnerId } } } }),
    tx.creative.findMany({ where: { sandboxId, advertiser: { partnerId } } }),
    tx.exchange.findMany(),
    tx.floodlightActivity.findMany({ where: { sandboxId } }),
    tx.adGroup.findMany({ where: { sandboxId, advertiser: { partnerId } } }),
    tx.simClock.findUnique({ where: { sandboxId } }),
    tx.creativeAssignment.findMany({ where: { sandboxId } }),
    loadFxTable(tx),
  ]);

  const segmentsByIo = new Map<string, SegmentInfo[]>();
  for (const s of segs) {
    const list = segmentsByIo.get(s.ioId) ?? [];
    list.push({
      id: s.id,
      ioId: s.ioId,
      name: s.description?.trim() || `Segment ${s.ordinal + 1}`,
      amount: Number(s.amount),
      start: iso(s.startDate) as string,
      end: iso(s.endDate) as string,
      ordinal: s.ordinal,
    });
    segmentsByIo.set(s.ioId, list);
  }
  const creativesByLi = new Map<string, string[]>();
  for (const a of assigns) {
    const list = creativesByLi.get(a.lineItemId) ?? [];
    list.push(a.creativeId);
    creativesByLi.set(a.lineItemId, list);
  }

  const w: World = {
    partner: {
      id: partnerRow.id,
      publicId: String(partnerRow.publicId),
      name: partnerRow.name,
      status: partnerRow.status,
      currencyCode: partnerRow.currencyCode,
      timeZone: partnerRow.timeZone,
    },
    advertisers: new Map(
      advs.map((a) => [
        a.id,
        {
          id: a.id,
          publicId: String(a.publicId),
          name: a.name,
          status: a.status,
          currencyCode: a.currencyCode,
          timeZone: a.timeZone,
          integrationCode: a.integrationCode,
        },
      ]),
    ),
    campaigns: new Map(
      camps.map((c) => [
        c.id,
        {
          id: c.id,
          publicId: String(c.publicId),
          advertiserId: c.advertiserId,
          name: c.name,
          status: c.status,
          goal: c.goal,
          start: iso(c.plannedStart) as string,
          end: iso(c.plannedEnd),
        },
      ]),
    ),
    ios: new Map(
      ios.map((io) => [
        io.id,
        {
          id: io.id,
          publicId: String(io.publicId),
          campaignId: io.campaignId,
          advertiserId: io.advertiserId,
          name: io.name,
          status: io.status,
          kpi: io.kpi,
          kpiValue: num(io.kpiValue),
          integrationCode: io.integrationCode,
          dailyFrequency: freqText(io.freqMode, io.freqMaxExposures, io.freqUnit, io.freqUnitCount),
          segments: (segmentsByIo.get(io.id) ?? []).sort((a, b) => a.start.localeCompare(b.start)),
        },
      ]),
    ),
    lineItems: new Map(
      lis.map((li) => [
        li.id,
        {
          id: li.id,
          publicId: String(li.publicId),
          ioId: li.ioId,
          campaignId: li.campaignId,
          advertiserId: li.advertiserId,
          name: li.name,
          status: li.status,
          type: li.type,
          budget: num(li.budgetAmount),
          start: iso(li.flightStart),
          end: iso(li.flightEnd),
          integrationCode: li.integrationCode,
          dailyFrequency: freqText(li.freqMode, li.freqMaxExposures, li.freqUnit, li.freqUnitCount),
          lifetimeFrequency: freqText(
            li.viewFreqMode,
            li.viewFreqMax,
            li.viewFreqUnit,
            li.viewFreqUnitCount,
          ),
          bidStrategyType: li.bidKind,
          optimizedTargeting: li.optimizedTargeting,
          creativeIds: (creativesByLi.get(li.id) ?? []).sort(),
        },
      ]),
    ),
    creatives: new Map(
      creatives.map((c) => [
        c.id,
        {
          id: c.id,
          publicId: String(c.publicId),
          name: c.name,
          kind: c.kind,
          status: c.status,
          source: c.source,
          width: c.width,
          height: c.height,
          integrationCode: c.integrationCode,
          companionId: c.companionOfCreativeId,
        },
      ]),
    ),
    exchangesById: new Map(exchanges.map((e) => [e.id, { id: e.id, code: e.code, name: e.name }])),
    exchangesByCode: new Map(
      exchanges.map((e) => [e.code, { id: e.id, code: e.code, name: e.name }]),
    ),
    activities: new Map(
      acts.map((a) => [a.id, { id: a.id, publicId: String(a.publicId), name: a.name }]),
    ),
    adGroups: new Map(
      adGroups.map((g) => [g.id, { id: g.id, publicId: String(g.id), name: g.name }]),
    ),
    fx: withDefaults(fxTable),
    simNow: clock
      ? new Date(clock.simStart.getTime() + Number(clock.tickIndex) * HOUR_MS)
      : new Date(),
    hourlyDays: 14,
  };
  return w;
}

/** FX multiplier from `from` to `to`; 1 when a rate is missing (a missing rate must not break a report). */
export function fx(world: World, from: string, to: string): number {
  try {
    return fxRate(world.fx, from, to);
  } catch {
    return 1;
  }
}

export function targetCurrency(
  world: World,
  advCurrency: string,
  target: 'ADV' | 'PARTNER' | 'USD',
): number {
  if (target === 'ADV') return 1;
  return fx(world, advCurrency, target === 'USD' ? 'USD' : world.partner.currencyCode);
}
