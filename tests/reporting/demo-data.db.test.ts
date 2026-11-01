// Fidelity audit "reports with demo data": the saved reports of a new sandbox run to believable, non-empty results.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { runQuery } from '@/lib/reporting/engine/query';
import { seedReports } from '@/lib/reporting/seed';
import type { ReportDefinition } from '@/lib/reporting/types';
import { seedSandbox, TODAY, type Seeded } from './fixture';

let s: Seeded;
let defs: ReportDefinition[] = [];
beforeAll(async () => {
  s = await seedSandbox('rdemo');
  await s.inSandbox((tx) =>
    seedReports(tx, {
      sandboxId: s.sandboxId,
      partnerId: s.partnerId,
      partnerPublicId: s.partnerPublicId,
      ownerUserId: s.ownerId,
      template: 'starter-agency',
      today: TODAY,
    }),
  );
  const recs = await s.inSandbox((tx) =>
    tx.report.findMany({ where: { sandboxId: s.sandboxId }, orderBy: { updatedAt: 'desc' } }),
  );
  defs = recs.map((r) => r.definition as unknown as ReportDefinition);
}, 240_000);
afterAll(async () => {
  await s.cleanup();
  await prisma.$disconnect();
});

const run = (def: ReportDefinition, limit = 5000) =>
  s.inSandbox((tx) => runQuery(tx, s.sandboxId, s.partnerId, def, { allowPartnerCost: true, limit }));

describe('seeded reports show believable demo data', () => {
  it('lists the saved reports newest first, in sim time', async () => {
    const recs = await s.inSandbox((tx) =>
      tx.report.findMany({ where: { sandboxId: s.sandboxId }, orderBy: { updatedAt: 'desc' } }),
    );
    expect(recs.length).toBeGreaterThanOrEqual(10);
    const stamps = recs.map((r) => r.updatedAt.toISOString());
    expect(new Set(stamps).size).toBe(stamps.length);
    for (const t of stamps) {
      expect(t >= '2026-10-15' && t < '2026-10-29').toBe(true);
    }
  });

  it('no seeded instant report is empty and every result has a total row where it has several rows', async () => {
    for (const def of defs.filter((d) => d.kind === 'INSTANT')) {
      const r = await run(def);
      expect(r.rows.length, def.name).toBeGreaterThan(0);
      if (r.rows.length > 1) expect(r.totals, def.name).toBeDefined();
    }
  });

  it('click rate stays between 0.05 and 3 percent and eCPM in a believable band', async () => {
    const r = await run(
      s.def({ dateRange: 'LAST_30_DAYS', dimensions: ['line_item'], metrics: ['impressions', 'clicks', 'click_rate_ctr', 'media_cost_ecpm_adv'] }),
    );
    expect(r.rows.length).toBeGreaterThan(0);
    let delivering = 0;
    let believable = 0;
    for (const row of r.rows) {
      const [, impr, , ctr, ecpm] = row as number[];
      if (!impr) continue;
      expect(ctr, String(row[0])).toBeLessThanOrEqual(3);
      expect(ecpm, String(row[0])).toBeGreaterThan(0.05);
      expect(ecpm, String(row[0])).toBeLessThan(2000);
      delivering++;
      if ((ctr as number) >= 0.05) believable++;
    }
    // CTV and DOOH have no clickable ads, so a few zero-click rows are realistic (docs/gaps/fid-reports.md).
    expect(believable / delivering).toBeGreaterThan(0.5);
    const ctrTotal = Number(r.totals?.[3]);
    expect(ctrTotal).toBeGreaterThanOrEqual(0.05);
    expect(ctrTotal).toBeLessThanOrEqual(3);
    expect(r.totals).toBeDefined();
  });

  it('daily impressions follow a weekday pattern (not flat)', async () => {
    const r = await run(s.def({ dateRange: 'LAST_30_DAYS', dimensions: ['date'], metrics: ['impressions'] }));
    const vals = r.rows.map((x) => Number(x[1]));
    const max = Math.max(...vals);
    const min = Math.min(...vals);
    expect(min).toBeGreaterThan(0);
    expect(max / min).toBeGreaterThan(1.05);
  });

  it('the total row of an additive metric equals the sum of the rows', async () => {
    const r = await run(s.def({ dateRange: 'LAST_14_DAYS', dimensions: ['date'], metrics: ['impressions', 'clicks'] }));
    const sum = r.rows.reduce((a, x) => a + Number(x[1]), 0);
    expect(Number(r.totals?.[1])).toBe(sum);
    expect(r.totals?.[0]).toBe('Total');
  });
});
