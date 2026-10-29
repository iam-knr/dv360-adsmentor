// One report run (module 16 4.1 runReport, 4.4 files): query, build CSV and XLSX, store both, record the `ReportRun`.
// Shared by the signed-in actions and by the engine hook for scheduled runs.
import { TZDate } from '@date-fns/tz';
import { format } from 'date-fns';
import type { Prisma } from '@prisma/client';
import type { Tx } from '@/lib/db';
import { buildCsv } from './files/csv';
import type { FileMeta } from './files/layout';
import { runFileName } from './files/names';
import { putReportFile } from './files/store';
import { buildXlsx } from './files/xlsx';
import { ReportInvalid, runQuery } from './engine/query';
import { loadWorld, type World } from './engine/world';
import type { QueryResult, ReportDefinition, ReportFormatWire } from './types';

/** Rows in a file (Δ16-9, `reporting.maxRows`) and in the canvas preview. */
export const ROW_CAP = 200_000;
export const PREVIEW_CAP = 1_000;

export function fileMetaFor(world: World, def: ReportDefinition, simNow: Date): FileMeta {
  const adv = [...world.advertisers.values()][0];
  const tz = adv?.timeZone ?? world.partner.timeZone;
  return {
    reportTime: format(new TZDate(simNow.getTime(), tz), 'yyyy/MM/dd HH:mm'),
    timeZoneLabel: def.timeZone === 'UTC' ? 'UTC' : tz,
    currency: adv?.currencyCode ?? world.partner.currencyCode,
  };
}

export async function filesFor(
  result: QueryResult,
  meta: FileMeta,
  fmt: ReportFormatWire,
): Promise<Uint8Array> {
  return fmt === 'XLSX'
    ? buildXlsx(result, meta, ROW_CAP)
    : new TextEncoder().encode(buildCsv(result, meta, ROW_CAP));
}

export interface ExecuteArgs {
  sandboxId: string;
  partnerId: string;
  reportId: string;
  reportName: string;
  def: ReportDefinition;
  createdById: string;
  allowPartnerCost: boolean;
  /** Sim now when the run is made; for a scheduled run the occurrence instant (relative ranges resolve against it). */
  simNow: Date;
  /** Real sim clock now, for the completion time. */
  clockNow: Date;
  scheduled: boolean;
  occurrenceSimAt?: Date;
  format: ReportFormatWire;
  fileStem?: string;
}

export interface ExecutedRun {
  runId: string;
  status: 'DONE' | 'FAILED';
  error?: string;
}

/** Creates the `ReportRun` row and fills it in. Failures of the report itself become a FAILED run, never a throw. */
export async function executeRun(tx: Tx, a: ExecuteArgs): Promise<ExecutedRun> {
  const run = await tx.reportRun.create({
    data: {
      sandboxId: a.sandboxId,
      reportId: a.reportId,
      dateRangeStart: new Date('2000-01-01T00:00:00Z'),
      dateRangeEnd: new Date('2000-01-01T00:00:00Z'),
      createdById: a.createdById,
      status: 'RUNNING',
      scheduled: a.scheduled,
      format: a.format,
      ...(a.occurrenceSimAt ? { occurrenceSimAt: a.occurrenceSimAt } : {}),
    },
    select: { id: true },
  });
  try {
    const world = { ...(await loadWorld(tx, a.sandboxId, a.partnerId)), simNow: a.simNow };
    const result = await runQuery(tx, a.sandboxId, a.partnerId, a.def, {
      allowPartnerCost: a.allowPartnerCost,
      limit: ROW_CAP,
      world,
    });
    const meta = fileMetaFor(world, a.def, a.simNow);
    const [csv, xlsx] = await Promise.all([filesFor(result, meta, 'CSV'), filesFor(result, meta, 'XLSX')]);
    const keyBase = `reports/${a.sandboxId}/${run.id}`;
    await Promise.all([putReportFile(keyBase, 'CSV', csv), putReportFile(keyBase, 'XLSX', xlsx)]);
    const chosen = a.format === 'XLSX' ? xlsx : csv;
    await tx.reportRun.update({
      where: { id: run.id },
      data: {
        status: 'DONE',
        dateRangeStart: new Date(`${result.range.from}T00:00:00Z`),
        dateRangeEnd: new Date(`${result.range.to}T00:00:00Z`),
        completedAt: new Date(),
        completedAtSim: a.clockNow,
        fileName: runFileName(a.fileStem ?? a.reportName, a.clockNow, a.format),
        storageKey: keyBase,
        sizeBytes: BigInt(chosen.byteLength),
        rowCount: result.rows.length,
        definitionSnapshot: a.def as unknown as Prisma.InputJsonValue,
        warnings: result.warnings,
        error: null,
      },
    });
    return { runId: run.id, status: 'DONE' };
  } catch (e) {
    const message =
      e instanceof ReportInvalid ? e.message : 'The report could not be generated. Try again.';
    if (!(e instanceof ReportInvalid)) console.error('report run failed', e);
    await tx.reportRun.update({
      where: { id: run.id },
      data: { status: 'FAILED', error: message, completedAt: new Date(), completedAtSim: a.clockNow },
    });
    return { runId: run.id, status: 'FAILED', error: message };
  }
}
