import { describe, expect, it } from 'vitest';
import {
  liTypeAllowedByIoType,
  liTypeAllowedByObjective,
} from '@/lib/validation/constants/li-compat';
import { ioKpisFor, isObjectiveEnabled, type IoType } from '@/lib/validation/constants/io-matrix';
import { hashValue } from '@/lib/seed/hash';
import { DELIVERY_STORIES, TEMPLATE_KEYS, type TemplateKey } from '@/lib/seed/knobs';
import { containsRealBrand } from '@/lib/seed/names';
import { buildSandboxPlan } from '@/lib/seed/plan';
import type { SandboxPlan } from '@/lib/seed/types';
import { TODAY, planFor } from './fixtures';

const planHash = (p: SandboxPlan) => hashValue({ ...p, profiles: p.profiles });

describe('determinism', () => {
  it.each(TEMPLATE_KEYS)(
    '%s: same template, seed, sandbox and knobs give identical rows',
    (template) => {
      const a = planFor(template, 11);
      const b = planFor(template, 11);
      expect(planHash(a)).toBe(planHash(b));
      expect(JSON.stringify(a.lineItems)).toBe(JSON.stringify(b.lineItems));
    },
  );

  it('different seed values differ', () => {
    expect(planHash(planFor('starter-agency', 1))).not.toBe(planHash(planFor('starter-agency', 2)));
    expect(planFor('starter-agency', 1).advertisers.map((a) => a.name)).not.toEqual(
      planFor('starter-agency', 2).advertisers.map((a) => a.name),
    );
  });

  it('different templates and different sandbox ids differ', () => {
    expect(planHash(planFor('starter-agency', 1))).not.toBe(planHash(planFor('healthy', 1)));
    const other = planFor('starter-agency', 1, undefined, 'sbx-other');
    expect(other.lineItems[0]?.id).not.toBe(planFor('starter-agency', 1).lineItems[0]?.id);
    expect(other.lineItems).toHaveLength(planFor('starter-agency', 1).lineItems.length);
  });

  it('is shifted, not reshaped, by a different sim date', () => {
    const a = planFor('starter-agency', 3);
    const later = buildLater();
    expect(later.lineItems.map((l) => l.name)).toEqual(a.lineItems.map((l) => l.name));
    expect(later.campaigns[0]?.plannedStart).not.toEqual(a.campaigns[0]?.plannedStart);
  });
});

function buildLater() {
  // same inputs, a sim date seven days later
  return buildSandboxPlan({
    template: 'starter-agency',
    seedValue: 3,
    sandboxId: 'sbx-test',
    classroomId: 'cls-test',
    today: '2026-11-04',
    partnerName: 'Sandbox DEMO-1',
  });
}

describe.each(TEMPLATE_KEYS)('integrity of %s', (template: TemplateKey) => {
  const plan = planFor(template, 5);
  const ids = <T extends { id?: string }>(rows: T[]) => new Set(rows.map((r) => r.id as string));

  it('meets the layout requirements of modules 06, 07 and 08 3.4', () => {
    expect(plan.coverageGaps).toEqual([]);
    const types = new Set(plan.lineItems.map((l) => l.type));
    for (const t of [
      'DISPLAY',
      'VIDEO',
      'CTV',
      'AUDIO',
      'MOBILE_APP_INSTALL',
      'ADS_IN_MOBILE_APPS',
      'DOOH_DISPLAY',
      'DOOH_VIDEO',
      'DEMAND_GEN',
    ])
      expect(types.has(t as never), t).toBe(true);
    expect(new Set(plan.lineItems.map((l) => l.status))).toEqual(
      new Set(['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED']),
    );
    expect(new Set(plan.insertionOrders.map((o) => o.type))).toEqual(
      new Set(['STANDARD', 'CTV_OTT', 'DOOH']),
    );
    expect(new Set(plan.insertionOrders.map((o) => o.objective))).toEqual(
      new Set(['BRAND_AWARENESS', 'CLICKS', 'CONVERSIONS', 'CUSTOM', 'NONE']),
    );
    expect(new Set(plan.insertionOrders.map((o) => o.status))).toEqual(
      new Set(['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED']),
    );
    expect(new Set(plan.campaigns.map((c) => c.goal))).toEqual(
      new Set(['AWARENESS', 'ONLINE_ACTION', 'OFFLINE_SALES', 'APP_INSTALLS']),
    );
  });

  it('puts every line item in a parent that allows its type and objective', () => {
    const ioById = new Map(plan.insertionOrders.map((o) => [o.id, o]));
    for (const li of plan.lineItems) {
      const io = ioById.get(li.ioId)!;
      expect(liTypeAllowedByIoType(io.type as IoType, li.type), `${li.name} in ${io.name}`).toBe(
        true,
      );
      expect(liTypeAllowedByObjective(io.objective, li.type), `${li.name} in ${io.name}`).toBe(
        true,
      );
    }
  });

  it('uses objectives, KPIs and automation that the validation matrix accepts', () => {
    for (const io of plan.insertionOrders) {
      expect(isObjectiveEnabled(io.type as IoType, io.objective), io.name).toBe(true);
      if (io.kpi) expect(ioKpisFor(io.type as IoType, io.objective), io.name).toContain(io.kpi);
      if (io.bidBudgetControl === 'IO_AUTOMATED') {
        const children = plan.lineItems.filter((l) => l.ioId === io.id);
        for (const li of children)
          expect(['DISPLAY', 'VIDEO', 'CTV'], `${io.name}: ${li.type}`).toContain(li.type);
      }
    }
  });

  it('keeps every foreign key and soft reference inside the plan', () => {
    const adv = ids(plan.advertisers);
    const camp = ids(plan.campaigns);
    const io = ids(plan.insertionOrders);
    const li = ids(plan.lineItems);
    const cr = ids(plan.creatives);
    const aud = ids(plan.audiences);
    const tpl = ids(plan.targetingTemplates);
    for (const c of plan.campaigns) expect(adv.has(c.advertiserId)).toBe(true);
    for (const b of plan.campaignBudgets) expect(camp.has(b.campaignId)).toBe(true);
    for (const o of plan.insertionOrders) {
      expect(camp.has(o.campaignId)).toBe(true);
      expect(adv.has(o.advertiserId)).toBe(true);
    }
    for (const s of plan.budgetSegments) expect(io.has(s.ioId)).toBe(true);
    for (const l of plan.lineItems) {
      expect(io.has(l.ioId)).toBe(true);
      expect(camp.has(l.campaignId)).toBe(true);
      expect(adv.has(l.advertiserId)).toBe(true);
      if (l.targetingTemplateId) expect(tpl.has(l.targetingTemplateId)).toBe(true);
    }
    for (const f of plan.partnerCosts)
      expect(
        Boolean(f.ioId && io.has(f.ioId)) !== Boolean(f.lineItemId && li.has(f.lineItemId)),
      ).toBe(true);
    for (const c of plan.creatives) expect(adv.has(c.advertiserId)).toBe(true);
    for (const a of plan.creativeAssets) expect(cr.has(a.creativeId as string)).toBe(true);
    for (const r of plan.creativeReviews) expect(cr.has(r.creativeId)).toBe(true);
    for (const a of plan.creativeAssignments) {
      expect(li.has(a.lineItemId)).toBe(true);
      expect(cr.has(a.creativeId)).toBe(true);
    }
    for (const t of plan.targetingAssignments) {
      const owners = [t.advertiserId, t.templateId, t.lineItemId, t.adGroupId, t.partnerId].filter(
        Boolean,
      );
      expect(owners).toHaveLength(1);
      if (t.refType === 'AUDIENCE') expect(aud.has(t.refId as string)).toBe(true);
      if (t.lineItemId) expect(li.has(t.lineItemId)).toBe(true);
      if (t.templateId) expect(tpl.has(t.templateId)).toBe(true);
    }
    for (const a of plan.alerts) {
      expect(adv.has(a.advertiserId)).toBe(true);
      if (a.lineItemId) expect(li.has(a.lineItemId)).toBe(true);
      if (a.ioId) expect(io.has(a.ioId)).toBe(true);
    }
    for (const g of plan.changeGroups) {
      const all = new Set([...adv, ...camp, ...io, ...li, plan.partner.id as string]);
      expect(all.has(g.entityId)).toBe(true);
      expect(g.sandboxId).toBe(plan.meta.sandboxId);
    }
    for (const e of plan.changeEntries) expect(ids(plan.changeGroups).has(e.groupId)).toBe(true);
    for (const p of plan.profiles) expect(li.has(p.liId)).toBe(true);
  });

  it('stamps the sandbox on every row and keeps ids unique', () => {
    const tables = [
      plan.partnerExchanges,
      plan.advertisers,
      plan.campaigns,
      plan.campaignBudgets,
      plan.insertionOrders,
      plan.budgetSegments,
      plan.partnerCosts,
      plan.lineItems,
      plan.creatives,
      plan.creativeAssets,
      plan.creativeReviews,
      plan.creativeAssignments,
      plan.audiences,
      plan.targetingTemplates,
      plan.targetingAssignments,
      plan.alerts,
      plan.changeGroups,
      plan.changeEntries,
    ] as { id?: string; sandboxId: string }[][];
    const seen = new Set<string>();
    for (const rows of tables) {
      for (const r of rows) {
        expect(r.sandboxId).toBe(plan.meta.sandboxId);
        expect(seen.has(r.id as string), `duplicate id ${r.id}`).toBe(false);
        seen.add(r.id as string);
      }
    }
    expect(plan.partner.sandboxId).toBe(plan.meta.sandboxId);
  });

  it('keeps flight dates inside the parent flights and budgets sensible', () => {
    const iso = (d: unknown) => (d as Date).toISOString().slice(0, 10);
    for (const c of plan.campaigns) {
      const ios = plan.insertionOrders.filter((o) => o.campaignId === c.id);
      const segs = plan.budgetSegments.filter((s) => ios.some((o) => o.id === s.ioId));
      for (const s of segs) {
        expect(iso(s.startDate) >= iso(c.plannedStart), `${c.name} start`).toBe(true);
        if (c.plannedEnd) expect(iso(s.endDate) <= iso(c.plannedEnd), `${c.name} end`).toBe(true);
      }
    }
    for (const o of plan.insertionOrders) {
      const segs = plan.budgetSegments
        .filter((s) => s.ioId === o.id)
        .sort((a, b) => iso(a.startDate).localeCompare(iso(b.startDate)));
      expect(segs.length).toBeGreaterThan(0);
      segs.forEach((s, i) => {
        expect(iso(s.startDate) <= iso(s.endDate)).toBe(true);
        expect(Number(s.amount)).toBeGreaterThan(0);
        if (i > 0)
          expect(iso(s.startDate) > iso(segs[i - 1]!.endDate), `${o.name} segments overlap`).toBe(
            true,
          );
      });
    }
    for (const l of plan.lineItems.filter((x) => x.flightMode === 'CUSTOM')) {
      expect(iso(l.flightStart) <= iso(l.flightEnd)).toBe(true);
    }
    // campaign planned spend equals the sum of its currency budgets when it has a plan
    for (const c of plan.campaigns.filter((x) => x.plannedSpend)) {
      const ios = plan.insertionOrders.filter((o) => o.campaignId === c.id);
      const total = plan.budgetSegments
        .filter((s) => ios.some((o) => o.id === s.ioId))
        .reduce((x, s) => x + Number(s.amount), 0);
      expect(Number(c.plannedSpend)).toBeCloseTo(total, 2);
    }
  });

  it('keeps the plan relative to the sim date', () => {
    const iso = (d: unknown) => (d as Date).toISOString().slice(0, 10);
    const started = plan.campaigns.map((c) => iso(c.plannedStart));
    expect(started.every((d) => d < TODAY)).toBe(true);
    expect(plan.simClock.simStart.toISOString().slice(0, 10)).toBe('2026-07-30');
    expect(plan.simClock.tickIndex).toBe(90 * 24);
  });

  it('uses only synthetic names, .invalid e-mails and example domains', () => {
    const names = [
      plan.partner,
      ...plan.advertisers,
      ...plan.campaigns,
      ...plan.insertionOrders,
      ...plan.lineItems,
      ...plan.creatives,
      ...plan.audiences,
    ].map((r) => (r as { name: string }).name);
    for (const name of names) expect(containsRealBrand(name), name).toBe(false);
    for (const a of plan.advertisers) {
      expect(a.websiteUrl).toMatch(/^https:\/\/[a-z0-9-]+\.example$/);
      expect(a.sdfAdminEmail).toMatch(/\.invalid$/);
    }
    expect(plan.partner.sdfAdminEmail).toMatch(/\.invalid$/);
    expect(plan.partner.name).toMatch(/^Sandbox /);
  });

  it('has one INR and one SGD advertiser and one with Floodlight optimisation', () => {
    expect(plan.advertisers.map((a) => a.currencyCode)).toEqual(['INR', 'SGD']);
    expect(plan.advertisers.filter((a) => a.demandGenFloodlightOptimization)).toHaveLength(1);
    const dg = plan.lineItems.filter((l) => l.type === 'DEMAND_GEN');
    const allowed = new Set(
      plan.advertisers.filter((a) => a.demandGenFloodlightOptimization).map((a) => a.id),
    );
    for (const l of dg) expect(allowed.has(l.advertiserId)).toBe(true);
  });

  it('sets EU political ads on every line item', () => {
    for (const l of plan.lineItems) expect(l.euPoliticalAds).toBeTruthy();
  });

  it('gives each line item 2 to 8 targeting rows and covers the variety of module 08 3.4', () => {
    const rows = plan.targetingAssignments.filter((t) => t.ownerType === 'LINE_ITEM');
    for (const l of plan.lineItems) {
      const n = rows.filter((r) => r.lineItemId === l.id).length;
      expect(n, l.name).toBeGreaterThanOrEqual(2);
      expect(n, l.name).toBeLessThanOrEqual(8);
    }
    expect(rows.some((r) => r.mode === 'EXCLUDE')).toBe(true);
    expect(rows.some((r) => r.mode === 'INCLUDE')).toBe(true);
    expect(rows.some((r) => r.dimension === 'DAY_TIME')).toBe(true);
    expect(rows.some((r) => r.dimension === 'AUDIENCE_LIST' && (r.groupIndex ?? 0) > 0)).toBe(true);
    expect(rows.some((r) => r.dimension === 'THIRD_PARTY_VERIFIER')).toBe(true);
    expect(rows.some((r) => r.dimension === 'OPTIMIZED_TARGETING')).toBe(true);
    expect(plan.lineItems.filter((l) => l.targetingTemplateId)).toHaveLength(1);
    expect(plan.lineItems.filter((l) => l.optimizedTargeting)).toHaveLength(1);
    expect(plan.partnerCosts.some((c) => c.feeType === 'DOUBLEVERIFY' && c.lineItemId)).toBe(true);
    expect(
      plan.targetingAssignments.filter((t) => t.ownerType === 'ADVERTISER' && t.isLocked),
    ).toHaveLength(4);
    expect(plan.targetingTemplates.filter((t) => t.status === 'ARCHIVED')).toHaveLength(2);
  });

  it('covers every conversion counting mode and a non-primary attribution model', () => {
    expect(new Set(plan.lineItems.map((l) => l.conversionCounting))).toEqual(
      new Set(['ALL', 'POST_CLICK_ONLY', 'PERCENTAGE']),
    );
    for (const l of plan.lineItems.filter((x) => x.conversionCounting === 'PERCENTAGE'))
      expect(l.conversionCountingPct).toBe(50);
    expect(plan.lineItems.filter((l) => l.attributionModelId)).toHaveLength(1);
  });

  it('assigns 1 to 6 creatives to each non-YouTube line item that should have some', () => {
    const noCreative = new Set(
      plan.stories.filter((s) => s.tag === 'li-no-creatives').map((s) => s.entityId),
    );
    for (const l of plan.lineItems) {
      const n = plan.creativeAssignments.filter((a) => a.lineItemId === l.id).length;
      if (noCreative.has(l.id as string)) expect(n).toBe(0);
      else {
        expect(n, l.name).toBeGreaterThanOrEqual(1);
        expect(n, l.name).toBeLessThanOrEqual(6);
      }
    }
    const states = new Set(plan.creatives.map((c) => c.dv360Review));
    expect(states.has('SERVABLE')).toBe(true);
    expect(states.has('PENDING')).toBe(true);
    expect(states.has('NOT_SERVABLE')).toBe(true);
    expect(plan.creatives.some((c) => c.dv360Feedback?.startsWith('Restricted'))).toBe(true);
    for (const c of plan.creatives)
      expect(
        plan.creativeReviews.filter((r) => r.creativeId === c.id).length,
      ).toBeGreaterThanOrEqual(1);
  });

  it('writes hidden SIM_SEED change groups', () => {
    expect(plan.changeGroups.length).toBeGreaterThan(plan.lineItems.length);
    for (const g of plan.changeGroups) {
      expect(g).toMatchObject({
        actorType: 'SYSTEM',
        systemActor: 'SIM_SEED',
        source: 'SEED',
        isHidden: true,
      });
    }
  });

  it('tags exactly the stories of the template', () => {
    const tags = new Set(plan.stories.map((s) => s.tag));
    expect(tags).toEqual(new Set(plan.meta.knobs.plantedProblems));
    for (const s of plan.stories) {
      const g = plan.changeGroups.find(
        (x) => x.entityId === s.entityId && x.summary === `Seed story: ${s.tag}`,
      );
      expect(g, s.tag).toBeDefined();
      expect(plan.changeEntries.find((e) => e.groupId === g!.id)?.newValue).toBe(s.tag);
    }
  });
});

describe('planted problems', () => {
  it('starter-agency and the lab plant every delivery story of module 08 3.4', () => {
    for (const template of ['starter-agency', 'troubleshooting-lab'] as const) {
      const tags = new Set(planFor(template).stories.map((s) => s.tag));
      for (const story of DELIVERY_STORIES)
        expect(tags.has(story), `${template}: ${story}`).toBe(true);
    }
  });

  it('healthy plants only the healthy story and raises no alerts', () => {
    const plan = planFor('healthy');
    expect(plan.stories.map((s) => s.tag)).toEqual(['healthy']);
    expect(plan.alerts).toEqual([]);
  });

  it('the lab adds conflicting settings and a small audience on top of starter', () => {
    const lab = new Set(planFor('troubleshooting-lab').stories.map((s) => s.tag));
    const starter = new Set(planFor('starter-agency').stories.map((s) => s.tag));
    expect(lab.has('io-conflicting-settings') && lab.has('audience-too-small')).toBe(true);
    expect(starter.has('io-conflicting-settings') || starter.has('audience-too-small')).toBe(false);
  });

  it('alerts carry the engine codes of engine.md 3.7 and the story in the payload', () => {
    const plan = planFor('troubleshooting-lab');
    const codes = new Set(plan.alerts.map((a) => a.diagnosticCode));
    for (const c of [
      'NO_SPEND_LI',
      'UNDERPACING_IO',
      'CONFLICT_IO',
      'LIMITED_AUDIENCE_LI',
      'UNDERPERFORMING_IO',
      'CREATIVE_REJECTED',
    ])
      expect(codes.has(c), c).toBe(true);
    for (const a of plan.alerts) expect((a.payload as { story?: string }).story).toBeTruthy();
    expect(
      plan.alerts.filter((a) => a.severity === 'CRITICAL').every((a) => a.type === 'NO_SPEND'),
    ).toBe(true);
  });

  it('creates the three setups behind the disapproval and size stories', () => {
    const plan = planFor('starter-agency');
    const disapproved = plan.creativeReviews.filter((r) => r.status === 'DISAPPROVED');
    expect(disapproved.length).toBeGreaterThan(0);
    const exchangeIds = new Set(disapproved.map((r) => r.exchangeId));
    expect(exchangeIds.size).toBe(2);
    const mismatch = plan.stories.find((s) => s.tag === 'creative-size-mismatch')!;
    const assigned = plan.creativeAssignments.filter((a) => a.lineItemId === mismatch.entityId);
    expect(assigned).toHaveLength(1);
    const creative = plan.creatives.find((c) => c.id === assigned[0]!.creativeId)!;
    expect([creative.width, creative.height]).toEqual([468, 60]);
    const future = plan.lineItems.find(
      (l) => l.id === plan.stories.find((s) => s.tag === 'li-future-flight')!.entityId,
    )!;
    expect((future.flightStart as Date).toISOString().slice(0, 10) > TODAY).toBe(true);
    const frequency = plan.lineItems.find(
      (l) => l.id === plan.stories.find((s) => s.tag === 'frequency-cap-too-tight')!.entityId,
    )!;
    expect(frequency).toMatchObject({
      freqMode: 'LIMITED',
      freqMaxExposures: 1,
      freqUnit: 'MONTH',
    });
    const bid = plan.lineItems.find(
      (l) => l.id === plan.stories.find((s) => s.tag === 'bid-too-low')!.entityId,
    )!;
    expect(bid.bidKind).toBe('FIXED');
    expect(Number(bid.fixedBidCpm)).toBeLessThan(10);
    const underPaused = plan.lineItems.find(
      (l) => l.id === plan.stories.find((s) => s.tag === 'li-under-paused-io')!.entityId,
    )!;
    expect(underPaused.status).toBe('ACTIVE');
    expect(plan.insertionOrders.find((o) => o.id === underPaused.ioId)!.status).toBe('PAUSED');
  });

  it('covers the IO requirements of module 07 3.4', () => {
    const plan = planFor('starter-agency');
    const io = plan.insertionOrders;
    expect(io.some((o) => o.bidBudgetControl === 'IO_AUTOMATED')).toBe(true);
    expect(io.some((o) => o.bidBudgetControl === 'LI_CONTROLLED' && o.autoBudgetAllocation)).toBe(
      true,
    );
    expect(io.some((o) => o.ytReachFreqOptimization)).toBe(true);
    expect(io.some((o) => o.budgetUnit === 'IMPRESSIONS')).toBe(true);
    expect(io.some((o) => o.pacingPeriod === 'DAILY' && o.dailyMaxAmount)).toBe(true);
    expect(
      io.some((o) => o.freqMode === 'LIMITED' && o.freqMaxExposures === 10 && o.freqUnit === 'DAY'),
    ).toBe(true);
    const segCount = new Map<string, number>();
    for (const s of plan.budgetSegments) segCount.set(s.ioId, (segCount.get(s.ioId) ?? 0) + 1);
    expect([...segCount.values()]).toContain(3);
    expect(
      plan.partnerCosts.some(
        (c) => c.feeType === 'THIRD_PARTY_AD_SERVER' && c.kind === 'CPM_FEE' && c.slot === 1,
      ),
    ).toBe(true);
    expect(
      plan.partnerCosts.some(
        (c) => c.feeType === 'AGENCY_TRADING_DESK' && c.kind === 'MEDIA_FEE' && c.slot === 2,
      ),
    ).toBe(true);
    expect(plan.partnerCosts.filter((c) => c.feeType === 'DV360_FEE' && c.isSystem)).toHaveLength(
      io.length,
    );
    // campaign requirements of module 06 3.4
    const camps = plan.campaigns;
    expect(camps.some((c) => c.kpi === 'OTHER' && c.kpiOtherText)).toBe(true);
    expect(camps.some((c) => c.goal === 'AWARENESS' && c.kpi === 'CPC')).toBe(true);
    expect(
      camps.some(
        (c) => c.freqMode === 'LIMITED' && c.freqMaxExposures === 3 && c.freqUnit === 'WEEK',
      ),
    ).toBe(true);
    expect(
      camps.some(
        (c) => (c.landingPageUrls as string[]).length > 0 && (c.keywords as string[]).length > 0,
      ),
    ).toBe(true);
    const budgetRows = (id: string) =>
      plan.campaignBudgets.filter((b) => b.campaignId === id).length;
    expect(camps.some((c) => budgetRows(c.id as string) === 3)).toBe(true);
    expect(camps.some((c) => budgetRows(c.id as string) === 0)).toBe(true);
  });
});
