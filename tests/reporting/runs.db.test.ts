// Run pipeline and scheduled runs against a seeded sandbox (module 16 6.1 items 10, 11, 15).
import ExcelJS from 'exceljs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { runDueReports } from '@/lib/reporting/due';
import { runQuery } from '@/lib/reporting/engine/query';
import { getReportFile } from '@/lib/reporting/files/store';
import { executeRun } from '@/lib/reporting/run';
import type { ReportDelivery, ReportSchedule } from '@/lib/reporting/types';
import { seedSandbox, TODAY, type Seeded } from './fixture';

let s: Seeded;
beforeAll(async () => {
  s = await seedSandbox('rr');
}, 240_000);
afterAll(async () => {
  await s.cleanup();
  await prisma.$disconnect();
});

const NOW = new Date(`${TODAY}T12:00:00Z`);

describe('executeRun', () => {
  it('stores a CSV and an XLSX that match the preview, and records the run', async () => {
    const def = s.def({ dateRange: '20260901:20260928', metrics: ['impressions', 'clicks'] });
    const report = await s.inSandbox((tx) =>
      tx.report.create({
        data: {
          sandboxId: s.sandboxId,
          partnerId: s.partnerId,
          ownerUserId: s.ownerId,
          name: def.name,
          definition: def as never,
          dateRange: def.dateRange,
        },
      }),
    );
    const out = await s.inSandbox((tx) =>
      executeRun(tx, {
        sandboxId: s.sandboxId,
        partnerId: s.partnerId,
        reportId: report.id,
        reportName: report.name,
        def,
        createdById: s.ownerId,
        allowPartnerCost: true,
        simNow: NOW,
        clockNow: NOW,
        scheduled: false,
        format: 'CSV',
      }),
    );
    expect(out.status).toBe('DONE');
    const run = await s.inSandbox((tx) => tx.reportRun.findUniqueOrThrow({ where: { id: out.runId } }));
    expect(run.dateRangeStart.toISOString().slice(0, 10)).toBe('2026-09-01');
    expect(run.fileName).toMatch(/^Test_report_20261028_1200\.csv$/);
    const preview = await s.inSandbox((tx) =>
      runQuery(tx, s.sandboxId, s.partnerId, def, { allowPartnerCost: true }),
    );
    const csv = new TextDecoder().decode((await getReportFile(run.storageKey!, 'CSV'))!);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('Advertiser,Impressions,Clicks');
    for (const [i, row] of preview.rows.entries()) expect(lines[i + 1]).toBe(row.join(','));
    expect(csv).toContain('Date Range:,2026/09/01 - 2026/09/28');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from((await getReportFile(run.storageKey!, 'XLSX'))!) as unknown as ArrayBuffer);
    expect(wb.getWorksheet('Report')?.rowCount).toBe(preview.rows.length + 1);
  });

  it('turns an invalid definition into a FAILED run', async () => {
    const def = s.def({ metrics: [] });
    const report = await s.inSandbox((tx) =>
      tx.report.create({
        data: {
          sandboxId: s.sandboxId,
          partnerId: s.partnerId,
          ownerUserId: s.ownerId,
          name: 'bad',
          definition: def as never,
          dateRange: def.dateRange,
        },
      }),
    );
    const out = await s.inSandbox((tx) =>
      executeRun(tx, {
        sandboxId: s.sandboxId,
        partnerId: s.partnerId,
        reportId: report.id,
        reportName: 'bad',
        def,
        createdById: s.ownerId,
        allowPartnerCost: true,
        simNow: NOW,
        clockNow: NOW,
        scheduled: false,
        format: 'CSV',
      }),
    );
    expect(out.status).toBe('FAILED');
    expect(out.error).toBe('Select at least one metric.');
  });
});

describe('runDueReports', () => {
  const schedule: ReportSchedule = {
    active: true,
    timeZone: 'UTC',
    repeats: 'DAILY',
    every: 1,
    starts: '2026-10-01',
  };
  const delivery: ReportDelivery = {
    format: 'CSV',
    fileName: 'daily',
    emailOwner: true,
    attachment: true,
    shareWith: [],
  };

  async function scheduled(name: string, firstDue: string) {
    const def = s.def({ name, dateRange: 'LAST_7_DAYS', metrics: ['impressions'] });
    return s.inSandbox((tx) =>
      tx.report.create({
        data: {
          sandboxId: s.sandboxId,
          partnerId: s.partnerId,
          ownerUserId: s.ownerId,
          name,
          definition: def as never,
          dateRange: def.dateRange,
          schedule: schedule as never,
          delivery: delivery as never,
          nextRunSimAt: new Date(`${firstDue}T00:00:00Z`),
        },
      }),
    );
  }

  it('makes one run per sim day owed, uses the occurrence for relative ranges, and is idempotent', async () => {
    const r = await scheduled('Daily 3', '2026-10-26');
    const first = await s.inSandbox((tx) => runDueReports(tx, s.sandboxId, NOW));
    expect(first.runs).toBe(3);
    const runs = await s.inSandbox((tx) =>
      tx.reportRun.findMany({ where: { reportId: r.id }, orderBy: { occurrenceSimAt: 'asc' } }),
    );
    expect(runs.map((x) => x.status)).toEqual(['DONE', 'DONE', 'DONE']);
    expect(runs.every((x) => x.scheduled)).toBe(true);
    // LAST_7_DAYS counts back from the day before each occurrence
    expect(runs.map((x) => x.dateRangeEnd.toISOString().slice(0, 10))).toEqual([
      '2026-10-25',
      '2026-10-26',
      '2026-10-27',
    ]);
    const again = await s.inSandbox((tx) => runDueReports(tx, s.sandboxId, NOW));
    expect(again.runs).toBe(0);
    const rep = await s.inSandbox((tx) => tx.report.findUniqueOrThrow({ where: { id: r.id } }));
    expect(rep.scheduleRunCount).toBe(3);
    expect(rep.nextRunSimAt?.toISOString()).toBe('2026-10-29T00:00:00.000Z');
    const inbox = await s.inSandbox((tx) =>
      tx.inboxMessage.findMany({ where: { userId: s.ownerId, title: 'Report ready: Daily 3' } }),
    );
    expect(inbox).toHaveLength(3);
  });

  it('caps the catch-up at 10 runs and counts the skipped ones', async () => {
    const r = await scheduled('Daily fast', '2026-10-06');
    const out = await s.inSandbox((tx) => runDueReports(tx, s.sandboxId, NOW));
    expect(out.runs).toBe(10);
    const rep = await s.inSandbox((tx) => tx.report.findUniqueOrThrow({ where: { id: r.id } }));
    expect(rep.scheduleSkipped).toBe(23 - 10);
    expect(rep.scheduleRunCount).toBe(10);
  });
});
