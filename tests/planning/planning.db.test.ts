// Planning services against the database (module 04 6: 4, 5, 6, 7, 8, 17, 18, 19, 25, 26, 28).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { getChangeGroupsFor } from './history';
import {
  createCrossMediaReport,
  deleteCrossMediaReport,
  getCrossMediaOptions,
  getCrossMediaReport,
  listCrossMediaReports,
} from '@/lib/planning/cross-media-service';
import {
  convertPlan,
  copyPlan,
  createPlan,
  downloadPlanCsv,
  getPlan,
  getPlanColumns,
  listPlans,
  previewPlanForecast,
  removePlan,
  setPlanArchived,
  savePlanColumns,
  updatePlan,
} from '@/lib/planning/service';
import { seedCrossMediaReports, seedPlans } from '@/lib/planning/seed';
import { dropWorld } from '../db/helpers';
import { createCreativeWorld, setSimHours, userFor } from '../creatives/helpers';

let w: Awaited<ReturnType<typeof createCreativeWorld>>;
const user = () => userFor(w);
const aid = () => w.advertiserId;

const must = <T>(r: { ok: boolean; data?: T }): T => {
  if (!r.ok) throw new Error(`expected ok: ${JSON.stringify(r)}`);
  return r.data as T;
};
const issues = (r: { ok: boolean; issues?: { code: string; message: string }[] }) => {
  expect(r.ok).toBe(false);
  return r.issues ?? [];
};

const row = (name: string, start: string, end: string, budget = 5000) => ({
  name,
  buyingMethod: 'OPEN_AUCTION' as const,
  startDate: start,
  endDate: end,
  budgetNet: budget,
});

beforeAll(async () => {
  w = await createCreativeWorld('plan');
  // sim clock starts 2026-01-01T00:00Z; today is 2026-01-01 in UTC
});
afterAll(async () => {
  await dropWorld(w);
});

describe('createPlan / updatePlan', () => {
  it('creates a plan with the defaults of 4.2 (AC-04-5)', async () => {
    const created = must(await createPlan(user(), aid()));
    const plan = await getPlan(user(), aid(), created.id);
    expect(plan.header.name).toBe('New Plan (Jan 1, 2026)');
    expect(plan.header.dates).toEqual({ start: '2026-01-02', end: '2026-02-01' });
    expect(plan.header.demographics).toMatchObject({ ageMin: 18, ageMax: 120 });
    expect(plan.status).toBe('PLANNED');
    expect(plan.forecast).toBeNull();
    expect(plan.rows).toHaveLength(0);
    expect(plan.locked).toBe(false);
  });

  it('saves rows, runs the forecast and bumps the version (AC-04-8, AC-04-9)', async () => {
    const created = must(await createPlan(user(), aid(), { name: 'Rows plan' }));
    const plan0 = await getPlan(user(), aid(), created.id);
    const res = must(
      await updatePlan(user(), aid(), {
        id: created.id,
        expectedVersion: plan0.version,
        rows: [
          row('A', '2026-01-02', '2026-02-01', 20000),
          row('B', '2026-01-05', '2026-01-20', 12000),
        ],
      }),
    );
    expect(res.plan.version).toBe(plan0.version + 1);
    expect(res.plan.stale).toBe(false);
    const f = res.plan.forecast;
    expect(f).not.toBeNull();
    expect(f?.asOf.slice(0, 10)).toBe('2026-01-01');
    expect(res.plan.rows).toHaveLength(2);
    expect(Object.keys(f?.perRow ?? {})).toHaveLength(2);
    const total = res.plan.rows.reduce((s, r) => s + r.budgetTotal, 0);
    expect(f?.budget).toBeCloseTo(total, 1);
    // identity: totalCpm * impressions / 1000 = budget
    expect(((f?.totalCpm ?? 0) * (f?.impressions ?? 0)) / 1000).toBeCloseTo(f?.budget ?? 0, -1);
    const groups = await getChangeGroupsFor(w.sandboxId, created.id);
    expect(groups.length).toBeGreaterThanOrEqual(2);
  });

  it('rejects a stale version and invalid rows', async () => {
    const created = must(await createPlan(user(), aid()));
    const bad = await updatePlan(user(), aid(), { id: created.id, expectedVersion: 99, name: 'x' });
    expect(issues(bad)[0]?.code).toBe('CONFLICT');
    const rows = await updatePlan(user(), aid(), {
      id: created.id,
      rows: [
        { ...row('', '2026-01-02', '2026-02-01', 0) },
        row('Out', '2026-03-01', '2026-03-05', 100),
      ],
    });
    const codes = issues(rows).map((i) => i.code);
    expect(codes).toContain('GEN-001');
    expect(codes).toContain('GEN-002');
    expect(codes).toContain('PLN-024');
  });

  it('a save with no change is a no-op (PLN-003)', async () => {
    const created = must(await createPlan(user(), aid()));
    const first = must(
      await updatePlan(user(), aid(), {
        id: created.id,
        rows: [row('A', '2026-01-02', '2026-02-01')],
      }),
    );
    const again = must(
      await updatePlan(user(), aid(), {
        id: created.id,
        rows: first.plan.rows.map((r) => ({ ...r, dealId: r.dealId })),
      }),
    );
    expect(again.plan.version).toBe(first.plan.version);
  });
});

describe('seed, lock and copy', () => {
  let pastId = '';
  it('seeds 22 plans per advertiser in every status, each with a forecast', async () => {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.sandbox_id', ${w.sandboxId}, true)`;
      const n = await seedPlans(tx, {
        sandboxId: w.sandboxId,
        template: 'starter-agency',
        seedValue: 7,
        today: '2026-01-01',
      });
      expect(n).toBeGreaterThanOrEqual(22);
    });
    const list = await listPlans(user(), aid());
    // 10 past plans (one Trafficked) and 2 archived past plans; the rest start today or later
    const seeded = list.rows.filter((r) => r.startDate < '2026-01-01');
    expect(seeded.length).toBe(12);
    expect(list.rows.filter((r) => r.status === 'TRAFFICKED')).toHaveLength(2);
    expect(list.rows.filter((r) => r.status === 'ARCHIVED')).toHaveLength(2);
    expect(new Set(list.rows.map((r) => r.currencyCode)).size).toBe(1);
    pastId = (seeded.find((r) => r.status === 'PLANNED') as { id: string }).id;
    const forecasts = await prisma.planForecast.count({ where: { sandboxId: w.sandboxId } });
    expect(forecasts).toBeGreaterThanOrEqual(22);
    const filtered = await listPlans(user(), aid(), { status: ['TRAFFICKED'] });
    expect(filtered.rows.every((r) => r.status === 'TRAFFICKED')).toBe(true);
    const countries = await prisma.plan.findMany({
      where: { sandboxId: w.sandboxId },
      select: { locationCountry: true },
    });
    expect(new Set(countries.map((c) => c.locationCountry)).size).toBeGreaterThanOrEqual(6);
    const rowsWithPanel = await prisma.planRow.count({
      where: { sandboxId: w.sandboxId, NOT: { audienceRefs: { equals: [] } } },
    });
    expect(rowsWithPanel).toBeGreaterThan(0);
  });

  it('a past-dated plan is locked (PLN-002, AC-04-6)', async () => {
    const plan = await getPlan(user(), aid(), pastId);
    expect(plan.locked).toBe(true);
    expect(plan.forecast).not.toBeNull();
    const res = await updatePlan(user(), aid(), { id: pastId, name: 'Nope' });
    expect(issues(res)[0]?.code).toBe('PLN-002');
  });

  it('copy shifts the rows, names the copy and forecasts it (AC-04-5, AC-04-7)', async () => {
    const src = await getPlan(user(), aid(), pastId);
    const res = must(
      await copyPlan(user(), aid(), { id: pastId, startDate: '2026-01-10', endDate: '2026-02-20' }),
    );
    const copy = await getPlan(user(), aid(), res.id);
    expect(copy.header.name).toBe(`Copy of ${src.header.name}`);
    expect(copy.rows).toHaveLength(src.rows.length);
    expect(copy.forecast).not.toBeNull();
    for (const r of copy.rows) {
      expect(r.startDate >= '2026-01-10').toBe(true);
      expect(r.endDate <= '2026-02-20').toBe(true);
    }
    const past = await copyPlan(user(), aid(), {
      id: pastId,
      startDate: '2025-12-01',
      endDate: '2025-12-31',
    });
    expect(issues(past)[0]?.code).toBe('PLN-021');
  });
});

describe('convert, remove, columns, csv', () => {
  it('converts a plan into a campaign, a draft IO and draft line items (AC-04-18)', async () => {
    const created = must(await createPlan(user(), aid(), { name: 'Convert me' }));
    must(
      await updatePlan(user(), aid(), {
        id: created.id,
        rows: [
          row('One', '2026-01-02', '2026-02-01'),
          row('Two', '2026-01-02', '2026-02-01'),
          row('Three', '2026-01-02', '2026-02-01'),
        ],
      }),
    );
    const out = must(await convertPlan(user(), aid(), { id: created.id, target: 'CAMPAIGN' }));
    expect(out.lineItemIds).toHaveLength(3);
    const io = await prisma.insertionOrder.findUniqueOrThrow({
      where: { id: out.ioId },
      include: { segments: true, lineItems: true },
    });
    expect(io.status).toBe('DRAFT');
    expect(io.objective).toBe('NONE');
    expect(io.segments).toHaveLength(1);
    expect(io.lineItems.every((l) => l.status === 'DRAFT' && l.type === 'DISPLAY')).toBe(true);
    const plan = await getPlan(user(), aid(), created.id);
    expect(plan.status).toBe('TRAFFICKED');
    expect(plan.convertedCampaignId).toBe(out.campaignId);
    const again = await convertPlan(user(), aid(), { id: created.id, target: 'CAMPAIGN' });
    expect(issues(again)[0]?.code).toBe('PLN-004');
  });

  it('a plan without rows creates nothing (AC-04-19)', async () => {
    const created = must(await createPlan(user(), aid(), { name: 'Empty plan' }));
    const before = await prisma.campaign.count({ where: { advertiserId: w.advertiserId } });
    const res = await convertPlan(user(), aid(), { id: created.id, target: 'CAMPAIGN' });
    expect(issues(res)[0]?.code).toBe('PLN-028');
    expect(await prisma.campaign.count({ where: { advertiserId: w.advertiserId } })).toBe(before);
  });

  it('removes a plan and keeps its history (AC-04-17)', async () => {
    const created = must(await createPlan(user(), aid(), { name: 'Remove me' }));
    must(await removePlan(user(), aid(), created.id));
    await expect(getPlan(user(), aid(), created.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect((await getChangeGroupsFor(w.sandboxId, created.id)).length).toBeGreaterThanOrEqual(2);
  });

  it('persists the column order per user and downloads the CSV in that order (AC-04-13, AC-04-16)', async () => {
    const order = ['name', 'budget', 'trps'];
    const saved = must(await savePlanColumns(user(), aid(), order));
    expect(saved.order).toEqual(order);
    expect(await getPlanColumns(user(), aid())).toEqual(order);
    const created = must(await createPlan(user(), aid(), { name: 'Csv plan' }));
    must(
      await updatePlan(user(), aid(), {
        id: created.id,
        rows: [row('Only row', '2026-01-02', '2026-02-01')],
      }),
    );
    const file = await downloadPlanCsv(user(), aid(), created.id);
    const lines = file.body.trim().split('\r\n');
    expect(lines[0]).toBe('Plan,Csv plan');
    expect(lines.some((l) => l === 'Name,Budget,TRPs')).toBe(true);
    expect(file.fileName.endsWith('.csv')).toBe(true);
  });

  it('a read only role cannot write (AC-04-20)', async () => {
    const ro = userFor(w, 'READ_ONLY');
    const res = await createPlan(ro, aid()).catch((e: { code?: string }) => e);
    expect((res as { code?: string }).code ?? (res as { ok: boolean; code: string }).code).toBe(
      'FORBIDDEN',
    );
    const list = await listPlans(ro, aid());
    expect(list.canWrite).toBe(false);
  });
});

describe('cross-media reach', () => {
  let ioId = '';
  beforeAll(async () => {
    // this world counts as seeded (an unseeded one is healed on first list, see plan-fix2 #1 below)
    await prisma.userPreference.create({
      data: {
        sandboxId: w.sandboxId,
        userId: user().id,
        key: 'seed:cross-media-reports',
        value: true,
      },
    });
  });
  it('lists options with zero-spend campaigns disabled (AC-04-24)', async () => {
    await setSimHours(w, 24);
    const opts = await getCrossMediaOptions(user(), {
      country: 'AUSTRALIA',
      scope: { partnerId: w.partnerId, advertiserId: w.advertiserId },
    });
    expect(opts.currency.code).toBe('AUD');
    expect(opts.subLocations.length).toBeGreaterThanOrEqual(4);
    expect(opts.tvCompanies.length).toBe(6);
    const camp = opts.tree[0]?.campaigns[0];
    expect(camp).toBeDefined();
    ioId = camp?.ios[0]?.id ?? '';
    expect(ioId).not.toBe('');
  });

  it('creates, lists, opens and deletes a report (AC-04-25, AC-04-26)', async () => {
    const opts = await getCrossMediaOptions(user(), {
      country: 'AUSTRALIA',
      scope: { partnerId: w.partnerId, advertiserId: w.advertiserId },
    });
    const tv = opts.tvCompanies[0]?.campaigns.slice(0, 2).map((c) => c.id) ?? [];
    const bad = await createCrossMediaReport(user(), {
      scope: { partnerId: w.partnerId, advertiserId: w.advertiserId },
      country: 'AUSTRALIA',
      reportScope: 'NATIONAL',
      ioIds: [],
      tvCampaignIds: [],
    });
    expect(issues(bad)[0]?.code).toBe('PLN-012');
    const created = must(
      await createCrossMediaReport(user(), {
        scope: { partnerId: w.partnerId, advertiserId: w.advertiserId },
        country: 'AUSTRALIA',
        reportScope: 'NATIONAL',
        ioIds: [ioId],
        tvCampaignIds: tv,
      }),
    );
    const list = await listCrossMediaReports(user(), {
      partnerId: w.partnerId,
      advertiserId: w.advertiserId,
    });
    expect(list.rows.find((r) => r.id === created.id)?.status).toBe('DONE');
    const detail = await getCrossMediaReport(
      user(),
      { partnerId: w.partnerId, advertiserId: w.advertiserId },
      created.id,
    );
    const r = detail.result;
    expect(r).not.toBeNull();
    const d = r?.digital.reachPct ?? 0;
    const t = r?.tv.reachPct ?? 0;
    const u = r?.combined.uniqueReachPct ?? 0;
    expect(u).toBeGreaterThanOrEqual(Math.max(d, t) - 0.01);
    expect(u).toBeLessThanOrEqual(Math.min(100, d + t) + 0.01);
    must(await deleteCrossMediaReport(user(), { partnerId: w.partnerId }, created.id));
    expect((await listCrossMediaReports(user(), { partnerId: w.partnerId })).rows).toHaveLength(0);
  });

  it('a partner scope sees every advertiser report', async () => {
    const res = await listCrossMediaReports(user(), { partnerId: w.partnerId });
    expect(res.partner).toBe(true);
  });
});

describe('plan-parity: archive, live preview, wizard fields, targeting copy', () => {
  it('archive hides the plan from edits and restore brings it back', async () => {
    const created = must(await createPlan(user(), aid(), { name: 'Archive me' }));
    const a = must(await setPlanArchived(user(), aid(), created.id, true));
    expect(a.status).toBe('ARCHIVED');
    const locked = await updatePlan(user(), aid(), { id: created.id, name: 'Nope' });
    expect(issues(locked)[0]?.code).toBe('PLN-002');
    expect(
      (await listPlans(user(), aid(), { status: ['ARCHIVED'] })).rows.map((r) => r.id),
    ).toContain(created.id);
    const b = must(await setPlanArchived(user(), aid(), created.id, false));
    expect(b.status).toBe('PLANNED');
    must(await updatePlan(user(), aid(), { id: created.id, name: 'Back again' }));
  });

  it('the wizard fields reach the stored plan and Additional Settings persist', async () => {
    const created = must(
      await createPlan(user(), aid(), {
        name: 'Wizard plan',
        location: 'US',
        channels: ['DIGITAL', 'TV'],
        demographics: { genders: ['FEMALE'], ageMin: 25, ageMax: 44 },
        subLocation: 'Texas',
        start: '2026-02-01',
        end: '2026-02-28',
      }),
    );
    const plan = await getPlan(user(), aid(), created.id);
    expect(plan.header).toMatchObject({
      location: 'US',
      channels: ['DIGITAL', 'TV'],
      demographics: { genders: ['FEMALE'], ageMin: 25, ageMax: 44 },
      dates: { start: '2026-02-01', end: '2026-02-28' },
    });
    const saved = must(
      await updatePlan(user(), aid(), {
        id: created.id,
        additional: {
          frequencyGoal: 5,
          reachBasis: 'DIGITAL',
          includeYoutube: false,
          inventoryQuality: 'AUTHORIZED',
          publicInventory: false,
          viewability: 'MRC_50',
          brandSuitability: 'EXCLUDE_SENSITIVE',
        },
      }),
    );
    expect(saved.plan.header.additional).toMatchObject({
      frequencyGoal: 5,
      reachBasis: 'DIGITAL',
      includeYoutube: false,
      inventoryQuality: 'AUTHORIZED',
      publicInventory: false,
      viewability: 'MRC_50',
      brandSuitability: 'EXCLUDE_SENSITIVE',
    });
  });

  it('the live preview forecasts an unsaved draft and writes nothing', async () => {
    const created = must(await createPlan(user(), aid(), { name: 'Preview plan' }));
    const before = await prisma.planForecast.count({ where: { planId: created.id } });
    const p = must(
      await previewPlanForecast(user(), aid(), {
        id: created.id,
        location: 'SG',
        dates: { start: '2026-01-02', end: '2026-02-01' },
        demographics: { genders: ['MALE', 'FEMALE', 'UNKNOWN'], ageMin: 18, ageMax: 64 },
        additional: { frequencyGoal: 3, reachBasis: 'CENSUS', includeYoutube: true },
        rows: [row('A', '2026-01-02', '2026-02-01', 20000)],
      }),
    );
    expect(p.forecast.reachPct).toBeGreaterThan(0);
    const bigger = must(
      await previewPlanForecast(user(), aid(), {
        id: created.id,
        location: 'SG',
        dates: { start: '2026-01-02', end: '2026-02-01' },
        demographics: { genders: ['MALE', 'FEMALE', 'UNKNOWN'], ageMin: 18, ageMax: 64 },
        additional: { frequencyGoal: 3, reachBasis: 'CENSUS', includeYoutube: true },
        rows: [row('A', '2026-01-02', '2026-02-01', 40000)],
      }),
    );
    expect(bigger.forecast.reachPct).toBeGreaterThanOrEqual(p.forecast.reachPct);
    expect(await prisma.planForecast.count({ where: { planId: created.id } })).toBe(before);
  });

  it('Create campaign copies every supported targeting dimension to the drafts (gap p4-08 #2)', async () => {
    const created = must(await createPlan(user(), aid(), { name: 'Targeted plan' }));
    const { dates } = (await getPlan(user(), aid(), created.id)).header;
    must(
      await updatePlan(user(), aid(), {
        id: created.id,
        rows: [
          {
            ...row('Targeted', dates.start, dates.end),
            targeting: {
              version: 1,
              lineItemType: 'DISPLAY',
              criteria: {
                keywords: { include: ['sports', 'travel'], exclude: ['gossip'] },
                environment: { web: true, app: false },
                demographics: {
                  gender: ['FEMALE'],
                  ageRange: [25, 45],
                  ageUnknown: false,
                  parental: [],
                  income: [],
                },
                audienceLists: {
                  include: { firstPartyGroups: [], google: ['7000037'], combined: [], custom: [] },
                  exclude: { firstParty: [], google: [] },
                },
              },
            },
          },
        ],
      }),
    );
    const saved = await getPlan(user(), aid(), created.id);
    expect(saved.rows[0]?.audienceRefs).toEqual(['7000037']);
    const out = must(await convertPlan(user(), aid(), { id: created.id, target: 'CAMPAIGN' }));
    const rows = await prisma.targetingAssignment.findMany({
      where: { lineItemId: out.lineItemIds[0] as string },
      select: { dimension: true, mode: true, valueText: true },
    });
    const dims = new Set(rows.map((r) => r.dimension));
    expect(dims.has('GEOGRAPHY')).toBe(true);
    expect(dims.has('KEYWORD')).toBe(true);
    expect(dims.has('AUDIENCE_LIST')).toBe(true);
    expect(dims.has('AGE')).toBe(true);
    expect(dims.has('ENVIRONMENT')).toBe(true);
  });
});

describe('plan-parity: Cross-media reach seed', () => {
  it('writes finished reports with results at advertiser and partner scope', async () => {
    const made = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.sandbox_id', ${w.sandboxId}, true)`;
      return seedCrossMediaReports(tx, {
        sandboxId: w.sandboxId,
        ownerUserId: user().id,
        seedValue: 7,
        today: '2026-01-01',
      });
    });
    expect(made).toBeGreaterThanOrEqual(3);
    const reports = await prisma.crossMediaReachReport.findMany({
      where: { sandboxId: w.sandboxId, name: { contains: 'reach' } },
    });
    expect(reports.every((r) => r.status === 'DONE' && r.result !== null)).toBe(true);
    const unique = reports.map(
      (r) => (r.result as { combined: { uniqueReachPct: number } }).combined.uniqueReachPct,
    );
    expect(unique.every((u) => u > 0 && u <= 100)).toBe(true);
    expect(reports.some((r) => r.advertiserId === null)).toBe(true);
    const list = await listCrossMediaReports(user(), { partnerId: w.partnerId });
    expect(list.rows.length).toBeGreaterThanOrEqual(made);
  });
});

describe('plan-fix2 #1: a sandbox built before the Cross-media seed', () => {
  it('lists the seeded reports once, at partner and advertiser scope, and a report opens with data', async () => {
    await prisma.crossMediaReachReport.deleteMany({ where: { sandboxId: w.sandboxId } });
    await prisma.userPreference.deleteMany({
      where: { sandboxId: w.sandboxId, key: 'seed:cross-media-reports' },
    });
    const partnerList = await listCrossMediaReports(user(), { partnerId: w.partnerId });
    expect(partnerList.rows.length).toBeGreaterThanOrEqual(3);
    const again = await listCrossMediaReports(user(), { partnerId: w.partnerId });
    expect(again.rows).toHaveLength(partnerList.rows.length);
    const advList = await listCrossMediaReports(user(), {
      partnerId: w.partnerId,
      advertiserId: w.advertiserId,
    });
    expect(advList.rows.length).toBeGreaterThan(0);
    const detail = await getCrossMediaReport(user(), { partnerId: w.partnerId }, partnerList.rows[0]!.publicId);
    expect(detail.status).toBe('DONE');
  });

  it('a student who deleted every report keeps the Welcome screen (no re-seed)', async () => {
    await prisma.crossMediaReachReport.deleteMany({ where: { sandboxId: w.sandboxId } });
    const list = await listCrossMediaReports(user(), { partnerId: w.partnerId });
    expect(list.rows).toHaveLength(0);
  });
});
