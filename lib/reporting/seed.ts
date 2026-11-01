// Seed data of module 16 (M16-01 reference rows, 3.3 sandbox rows). Relative imports only: prisma/seed runs under tsx.
// Idempotent. Fields are generated from the catalogue, never typed by hand.
import type { Prisma, PrismaClient, ReportKind } from '@prisma/client';
import fxJson from '../../data/reference/fx-rates.json';
import { FIELDS } from './catalogue';
import { TEMPLATES, TEMPLATE_BY_KEY } from './templates';
import type { ReportDefinition, ReportDelivery, ReportSchedule } from './types';

type Db = PrismaClient | Prisma.TransactionClient;

const OFFLINE: Record<string, ReportKind> = {
  FLOODLIGHT: 'OFFLINE_FLOODLIGHT',
  INVENTORY_AVAILABILITY: 'OFFLINE_INVENTORY_AVAILABILITY',
};

export interface ReportReferenceResult {
  fields: number;
  templates: number;
  fxRates: number;
}

export async function seedReportReference(db: Db): Promise<ReportReferenceResult> {
  const have = await db.reportField.count();
  if (have !== FIELDS.length) {
    await db.reportField.deleteMany({});
    for (let i = 0; i < FIELDS.length; i += 400) {
      await db.reportField.createMany({
        data: FIELDS.slice(i, i + 400).map((f, k) => ({
          key: f.key,
          label: f.label,
          category: f.category,
          kind: f.kind,
          dataType: f.dataType,
          currency: f.currency ?? null,
          sourceKind: f.source.t,
          sourceSpec: f.source,
          status: f.status,
          downloadOnly: !!f.downloadOnly,
          frequentlyUsed: !!f.frequentlyUsed,
          offlineTypes: (f.offline ?? []).flatMap((o) => OFFLINE[o] ?? []),
          sensitivity: f.sensitivity ?? 'NONE',
          compatGroups: f.compat ?? [],
          ordinal: i + k,
        })),
      });
    }
  }
  for (const [i, t] of TEMPLATES.entries()) {
    await db.reportTemplate.upsert({
      where: { family_title: { family: t.family, title: t.title } },
      create: {
        family: t.family,
        title: t.title,
        description: t.description,
        definition: t.definition,
        ordinal: i,
      },
      update: {
        description: t.description,
        definition: t.definition,
        ordinal: i,
      },
    });
  }
  // Fixed, invented rates (RC-025): USD to each currency, valid from the beginning.
  const validFrom = new Date('2000-01-01T00:00:00Z');
  let fxRates = 0;
  for (const [cur, rate] of Object.entries(fxJson.perUSD)) {
    if (cur === 'USD') continue;
    await db.fxRate.upsert({
      where: {
        fromCurrency_toCurrency_validFrom: { fromCurrency: 'USD', toCurrency: cur, validFrom },
      },
      create: { fromCurrency: 'USD', toCurrency: cur, rate, validFrom },
      update: { rate },
    });
    fxRates++;
  }
  return { fields: FIELDS.length, templates: TEMPLATES.length, fxRates };
}

// ---------------------------------------------------------------------------------------------
// Sandbox rows
// ---------------------------------------------------------------------------------------------

interface SeedReport {
  name: string;
  template?: string;
  dimensions: string[];
  metrics: string[];
  dateRange: string;
  viz?: ReportDefinition['viz'];
  runs: number;
}

const INSTANT: SeedReport[] = [
  {
    name: 'Advertiser Overview',
    template: 'advertiser-overview',
    dimensions: [],
    metrics: [],
    dateRange: 'LAST_7_DAYS',
    runs: 2,
  },
  {
    name: 'Insertion Order Pacing',
    template: 'io-pacing',
    dimensions: [],
    metrics: [],
    dateRange: 'MONTH_TO_DATE',
    runs: 1,
  },
  {
    name: 'Creative performance',
    dimensions: ['creative'],
    metrics: ['impressions', 'clicks', 'click_rate_ctr', 'total_conversions'],
    dateRange: 'LAST_14_DAYS',
    runs: 3,
  },
  {
    name: 'Daily impressions trend',
    dimensions: ['date'],
    metrics: ['impressions', 'clicks'],
    dateRange: 'LAST_30_DAYS',
    viz: { type: 'TIME_SERIES' },
    runs: 1,
  },
];

/** plan-parity: more saved reports so the list, the run history and the previews have data (all synthetic). */
const EXTRA_INSTANT: SeedReport[] = [
  {
    name: 'Campaign performance by device',
    dimensions: ['campaign', 'device_type'],
    metrics: ['impressions', 'clicks', 'click_rate_ctr', 'total_conversions'],
    dateRange: 'LAST_30_DAYS',
    runs: 2,
  },
  {
    name: 'Exchange mix and viewability',
    dimensions: ['exchange'],
    metrics: ['impressions', 'clicks', 'viewable_impressions'],
    dateRange: 'LAST_14_DAYS',
    runs: 2,
  },
  {
    name: 'Weekly delivery by line item',
    dimensions: ['week', 'line_item'],
    metrics: ['impressions', 'clicks'],
    dateRange: 'LAST_30_DAYS',
    runs: 1,
  },
  {
    name: 'Geography: country and region',
    dimensions: ['country', 'region'],
    metrics: ['impressions', 'clicks', 'click_rate_ctr'],
    dateRange: 'LAST_30_DAYS',
    runs: 2,
  },
  {
    name: 'Video completions by creative',
    dimensions: ['creative'],
    metrics: ['impressions', 'video_completions'],
    dateRange: 'LAST_14_DAYS',
    runs: 1,
  },
  {
    name: 'Browser and environment',
    dimensions: ['browser', 'environment'],
    metrics: ['impressions', 'clicks'],
    dateRange: 'LAST_7_DAYS',
    runs: 1,
  },
  {
    name: 'Daily clicks trend',
    dimensions: ['date'],
    metrics: ['clicks', 'click_rate_ctr'],
    dateRange: 'LAST_14_DAYS',
    viz: { type: 'TIME_SERIES' },
    runs: 2,
  },
];

const LAB: SeedReport = {
  name: 'Conversions by Floodlight activity',
  dimensions: ['floodlight_activity'],
  metrics: ['impressions', 'clicks', 'total_conversions'],
  dateRange: 'LAST_14_DAYS',
  runs: 1,
};

const addDays = (iso: string, n: number): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export interface SeedReportsInput {
  sandboxId: string;
  partnerId: string;
  partnerPublicId: string;
  ownerUserId: string | null;
  template: string;
  today: string;
}

/** Saved reports with a few completed runs (the files are rebuilt on download when the store has none). */
export async function seedReports(tx: Db, input: SeedReportsInput): Promise<number> {
  if (!input.ownerUserId) return 0;
  const list = input.template === 'troubleshooting-lab' ? [LAB] : [...INSTANT, ...EXTRA_INSTANT];
  // Real row counts: each saved report is run once against the metric history, so the run list shows result sizes.
  const { runQuery } = await import('./engine/query');
  const { loadWorld } = await import('./engine/world');
  const world = await loadWorld(tx as never, input.sandboxId, input.partnerId).catch(() => null);
  const countRows = async (def: ReportDefinition): Promise<number> => {
    if (!world) return 0;
    try {
      const r = await runQuery(tx, input.sandboxId, input.partnerId, def, {
        allowPartnerCost: false,
        limit: 1_000,
        world,
      });
      return r.rows.length;
    } catch {
      return 0;
    }
  };
  const partnerFilter = [{ field: 'partner', op: 'IN' as const, values: [input.partnerPublicId] }];
  let made = 0;
  const mk = async (
    def: ReportDefinition,
    runs: number,
    extra: { schedule?: ReportSchedule; delivery?: ReportDelivery } = {},
  ) => {
    const rep = await tx.report.create({
      data: {
        sandboxId: input.sandboxId,
        partnerId: input.partnerId,
        ownerUserId: input.ownerUserId as string,
        kind:
          def.kind === 'INSTANT'
            ? 'INSTANT'
            : (OFFLINE[def.offlineType ?? 'FLOODLIGHT'] ?? 'OFFLINE_FLOODLIGHT'),
        name: def.name,
        // Sim time, staggered over the last days, so the list sorts and prints like a used account.
        updatedAt: new Date(
          `${addDays(input.today, -(1 + ((made * 3) % 9)))}T${String(8 + ((made * 5) % 11)).padStart(2, '0')}:${String((made * 17) % 60).padStart(2, '0')}:00Z`,
        ),
        definition: def as unknown as Prisma.InputJsonValue,
        timeZone: def.timeZone,
        dateRange: def.dateRange,
        template: def.template ?? null,
        ...(extra.schedule
          ? {
              schedule: extra.schedule as unknown as Prisma.InputJsonValue,
              nextRunSimAt: new Date(`${addDays(input.today, 1)}T00:00:00Z`),
            }
          : {}),
        ...(extra.delivery ? { delivery: extra.delivery as unknown as Prisma.InputJsonValue } : {}),
      },
      select: { id: true },
    });
    const sampleRows = await countRows(def);
    for (let i = 0; i < runs; i++) {
      const end = addDays(input.today, -1 - i * 3);
      const days = Number(/(\d+)D_/.exec(def.dateRange)?.[1] ?? 7);
      await tx.reportRun.create({
        data: {
          sandboxId: input.sandboxId,
          reportId: rep.id,
          dateRangeStart: new Date(`${addDays(end, -(days - 1))}T00:00:00Z`),
          dateRangeEnd: new Date(`${end}T00:00:00Z`),
          createdById: input.ownerUserId as string,
          status: 'DONE',
          completedAt: new Date(`${end}T12:00:00Z`),
          completedAtSim: new Date(`${end}T12:00:00Z`),
          format: 'CSV',
          fileName: `${def.name.replace(/\s+/g, '_')}_${end.replace(/-/g, '')}_1200.csv`,
          storageKey: `reports/${input.sandboxId}/seed-${rep.id}-${i}`,
          sizeBytes: BigInt(Math.max(2048, 160 + sampleRows * 96)),
          rowCount: sampleRows,
          definitionSnapshot: {
            ...def,
            dateRange: `${addDays(end, -(days - 1)).replace(/-/g, '')}:${end.replace(/-/g, '')}`,
          } as unknown as Prisma.InputJsonValue,
        },
      });
    }
    made++;
  };
  for (const s of list) {
    const t = s.template ? TEMPLATE_BY_KEY.get(s.template) : undefined;
    await mk(
      {
        kind: 'INSTANT',
        name: s.name,
        timeZone: 'ADVERTISER',
        dateRange: s.dateRange,
        filters: partnerFilter,
        dimensions: t ? [...t.definition.dimensions] : s.dimensions,
        metrics: t ? [...t.definition.metrics] : s.metrics,
        viz: s.viz ?? { type: 'TABLE' },
        ...(s.template ? { template: s.template } : {}),
      },
      s.runs,
    );
  }
  if (input.template !== 'troubleshooting-lab') {
    await mk(
      {
        kind: 'OFFLINE',
        offlineType: 'FLOODLIGHT',
        name: 'Floodlight impressions (daily)',
        timeZone: 'ADVERTISER',
        dateRange: 'LAST_7_DAYS',
        filters: partnerFilter,
        dimensions: ['date', 'advertiser'],
        metrics: ['impressions', 'clicks', 'floodlight_impressions'],
        viz: { type: 'TABLE' },
        template: 'floodlight-impressions',
      },
      1,
      {
        schedule: {
          active: true,
          timeZone: 'UTC',
          repeats: 'DAILY',
          every: 1,
          starts: input.today,
        },
        delivery: {
          format: 'CSV',
          fileName: 'floodlight_impressions',
          emailOwner: true,
          attachment: true,
          shareWith: [],
        },
      },
    );
  }
  if (input.template !== 'troubleshooting-lab') {
    await mk(
      {
        kind: 'OFFLINE',
        offlineType: 'INVENTORY_AVAILABILITY',
        name: 'Availability by exchange (weekly)',
        timeZone: 'ADVERTISER',
        dateRange: 'LAST_7_DAYS',
        filters: partnerFilter,
        dimensions: ['date', 'availability_exchange'],
        metrics: ['available_impressions', 'bid_able_impressions'],
        viz: { type: 'TABLE' },
        template: 'availability-exchange',
      },
      2,
      {
        schedule: {
          active: true,
          timeZone: 'UTC',
          repeats: 'WEEKLY',
          every: 1,
          starts: input.today,
        },
        delivery: {
          format: 'CSV',
          fileName: 'availability_exchange',
          emailOwner: true,
          attachment: true,
          shareWith: [],
        },
      },
    );
    await mk(
      {
        kind: 'OFFLINE',
        offlineType: 'FLOODLIGHT',
        name: 'Floodlight order IDs',
        timeZone: 'ADVERTISER',
        dateRange: 'LAST_14_DAYS',
        filters: partnerFilter,
        dimensions: ['date', 'order_id', 'floodlight_activity'],
        metrics: ['total_conversions', 'post_click_conversions', 'post_view_conversions'],
        viz: { type: 'TABLE' },
        template: 'floodlight-order-id',
      },
      1,
    );
  }
  return made;
}
