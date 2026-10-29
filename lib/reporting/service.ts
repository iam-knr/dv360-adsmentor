import 'server-only';
// Report services (module 16 4.1): hub list, CRUD, schedules, shares, preview query, runs and downloads. Every function
// checks access itself (routes.md 2): `report.read` to open, `report.write` to change. CREATIVE has neither (404).
import type { Prisma, ReportKind } from '@prisma/client';
import type { SessionUser } from '@/lib/auth/types';
import {
  asResult,
  conflict,
  forbidden,
  notFound,
  serviceCtx,
  ServiceFailure,
  type Result,
  type ServiceCtx,
} from '@/lib/campaigns/service-kit';
import type { WireIssue } from '@/lib/campaigns/wire';
import { peopleByIds } from '@/lib/accounts/directory';
import { prisma, withSandbox, type Tx } from '@/lib/db';
import { can } from '@/lib/rbac/can';
import { parseIdRef, whereId } from '@/lib/routes/params';
import { FIELDS, FIELD_BY_KEY } from './catalogue';
import { incompatibleWith } from './engine/compat';
import { ReportInvalid, runQuery } from './engine/query';
import { ruleShare, validateForSave } from './engine/rules';
import { CONTENT_TYPE } from './files/names';
import { getReportFile } from './files/store';
import { generateReport, type GenerateResult } from './generate';
import { executeRun, fileMetaFor, filesFor, PREVIEW_CAP, ROW_CAP } from './run';
import { nextOccurrence } from './schedule';
import { TEMPLATES, type TemplateDef } from './templates';
import type {
  QueryResult,
  ReportDefinition,
  ReportDelivery,
  ReportFormatWire,
  ReportRow,
  ReportSchedule,
  RuleIssue,
  RunRow,
} from './types';
import { loadWorld } from './engine/world';

// ---------------------------------------------------------------------------------------------
// Access
// ---------------------------------------------------------------------------------------------

const canRead = (u: SessionUser) =>
  !!u.sandboxId && can(u, 'report_view', { sandboxId: u.sandboxId, area: 'reporting' });
const canWrite = (u: SessionUser) =>
  !!u.sandboxId && can(u, 'report_build', { sandboxId: u.sandboxId, area: 'reporting' });

export const allowPartnerCost = (u: SessionUser) => u.dvRole !== 'PARTNER_CLIENT';

async function withCtx<T>(
  user: SessionUser,
  write: boolean,
  fn: (tx: Tx, ctx: ServiceCtx) => Promise<T>,
): Promise<T> {
  if (!canRead(user)) throw notFound();
  if (write && !canWrite(user)) throw forbidden();
  const ctx = await serviceCtx(user);
  return withSandbox(ctx.sandboxId, (tx) => fn(tx, ctx), { timeout: 120_000 });
}

const wire = (i: RuleIssue): WireIssue => ({
  path: i.path,
  severity: i.severity,
  code: i.ruleId,
  message: i.message,
});
const invalidRules = (issues: RuleIssue[]) =>
  new ServiceFailure('INVALID', issues.filter((i) => i.severity === 'error').map(wire));

async function partnerOf(tx: Tx, pid: string) {
  const ref = parseIdRef(pid);
  const p = ref
    ? await tx.partner.findFirst({
        where: whereId(ref),
        select: { id: true, publicId: true, name: true },
      })
    : null;
  if (!p) throw notFound();
  return p;
}

const KIND: Record<string, ReportKind> = {
  INSTANT: 'INSTANT',
  FLOODLIGHT: 'OFFLINE_FLOODLIGHT',
  INVENTORY_AVAILABILITY: 'OFFLINE_INVENTORY_AVAILABILITY',
};
const kindOf = (d: ReportDefinition): ReportKind =>
  d.kind === 'INSTANT' ? 'INSTANT' : (KIND[d.offlineType ?? 'FLOODLIGHT'] ?? 'OFFLINE_FLOODLIGHT');

const accessible = (u: SessionUser): Prisma.ReportWhereInput => ({
  OR: [{ ownerUserId: u.id }, { shares: { some: { userId: u.id } } }],
});

async function namesOf(ids: string[]): Promise<Map<string, string>> {
  const rows = await peopleByIds(ids);
  return new Map(rows.map((r) => [r.id, r.name]));
}

type ReportRec = Prisma.ReportGetPayload<{ include: { shares: true } }>;

function definitionOf(r: ReportRec): ReportDefinition {
  const d = r.definition as unknown as ReportDefinition;
  return {
    ...d,
    id: r.id,
    name: r.name,
    ...(r.schedule ? { schedule: r.schedule as unknown as ReportSchedule } : {}),
    ...(r.delivery ? { delivery: r.delivery as unknown as ReportDelivery } : {}),
  };
}

async function load(tx: Tx, u: SessionUser, id: string): Promise<ReportRec> {
  const r = await tx.report.findFirst({
    where: { AND: [{ OR: [{ id }, { publicId: /^\d+$/.test(id) ? BigInt(id) : -1n }] }, accessible(u)] },
    include: { shares: true },
  });
  if (!r) throw notFound();
  return r;
}

const canEdit = (r: ReportRec, u: SessionUser) =>
  r.ownerUserId === u.id || r.shares.some((s) => s.userId === u.id && s.canEdit);

// ---------------------------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------------------------

export interface HubQuery {
  kind?: 'instant' | 'offline';
  createdBy?: 'me' | 'any';
  q?: string;
  page?: number;
}
export const HUB_PAGE_SIZE = 20;

export async function listReports(
  user: SessionUser,
  pid: string,
  q: HubQuery,
): Promise<{ rows: ReportRow[]; total: number; page: number; pageSize: number }> {
  return withCtx(user, false, async (tx) => {
    const partner = await partnerOf(tx, pid);
    const where: Prisma.ReportWhereInput = {
      partnerId: partner.id,
      AND: [
        q.createdBy === 'me' ? { ownerUserId: user.id } : accessible(user),
        q.kind === 'offline'
          ? { kind: { not: 'INSTANT' } }
          : q.kind === 'instant'
            ? { kind: 'INSTANT' }
            : {},
        q.q?.trim() ? { name: { contains: q.q.trim(), mode: 'insensitive' } } : {},
      ],
    };
    const page = Math.max(1, q.page ?? 1);
    const [total, recs] = await Promise.all([
      tx.report.count({ where }),
      tx.report.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * HUB_PAGE_SIZE,
        take: HUB_PAGE_SIZE,
        include: { shares: true, _count: { select: { runs: { where: { status: 'DONE' } } } } },
      }),
    ]);
    const names = await namesOf([...new Set(recs.map((r) => r.ownerUserId))]);
    const rows: ReportRow[] = recs.map((r) => ({
      id: r.id,
      publicId: r.publicId.toString(),
      kind: r.kind,
      name: r.name,
      createdBy: names.get(r.ownerUserId) ?? 'Unknown',
      createdByMe: r.ownerUserId === user.id,
      modified: r.updatedAt.toISOString(),
      files: r._count.runs,
      shared: r.shares.length > 0,
      scheduled: !!(r.schedule as { active?: boolean } | null)?.active,
    }));
    return { rows, total, page, pageSize: HUB_PAGE_SIZE };
  });
}

export interface ReportView {
  definition: ReportDefinition;
  publicId: string;
  version: number;
  canEdit: boolean;
  partnerPublicId: string;
  skipped: number;
}

export async function getReport(user: SessionUser, id: string): Promise<ReportView> {
  return withCtx(user, false, async (tx) => {
    const r = await load(tx, user, id);
    const partner = await tx.partner.findFirst({
      where: { id: r.partnerId },
      select: { publicId: true },
    });
    return {
      definition: definitionOf(r),
      publicId: r.publicId.toString(),
      version: r.version,
      canEdit: canEdit(r, user) && canWrite(user),
      partnerPublicId: partner?.publicId.toString() ?? '',
      skipped: r.scheduleSkipped,
    };
  });
}

export function listTemplates(): TemplateDef[] {
  return [...TEMPLATES];
}

export interface FieldView {
  key: string;
  label: string;
  kind: 'DIMENSION' | 'METRIC';
  category: string;
  dataType: string;
  downloadOnly: boolean;
  frequentlyUsed: boolean;
}

export interface FieldList {
  fields: FieldView[];
  incompatible: Record<string, string>;
}

/** The picker's data (S2). PARTNER_COST fields are removed for PARTNER_CLIENT. Offline types limit the list. */
export function listFields(
  user: SessionUser,
  q: { offline?: 'FLOODLIGHT' | 'INVENTORY_AVAILABILITY'; selected?: string[] },
): FieldList {
  const fields = FIELDS.filter((f) => {
    if (f.sensitivity === 'PARTNER_COST' && !allowPartnerCost(user)) return false;
    if (q.offline) return !!f.offline?.includes(q.offline);
    return !f.offlineOnly;
  }).map((f) => ({
    key: f.key,
    label: f.label,
    kind: f.kind,
    category: f.category,
    dataType: f.dataType,
    downloadOnly: !!f.downloadOnly,
    frequentlyUsed: !!f.frequentlyUsed,
  }));
  return { fields, incompatible: q.selected?.length ? incompatibleWith(q.selected) : {} };
}

// ---------------------------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------------------------

export interface SaveMeta {
  expectedVersion?: number;
}

function checkFields(user: SessionUser, def: ReportDefinition): RuleIssue[] {
  const out: RuleIssue[] = [];
  for (const key of [...def.dimensions, ...def.metrics]) {
    const f = FIELD_BY_KEY.get(key);
    if (f?.sensitivity === 'PARTNER_COST' && !allowPartnerCost(user))
      out.push({
        ruleId: 'RPT-017',
        path: `fields.${key}`,
        severity: 'error',
        message: "You don't have access to this field.",
      });
  }
  return out;
}

function dataOf(def: ReportDefinition) {
  const { id: _id, schedule: _s, delivery: _d, ...rest } = def;
  void _id;
  void _s;
  void _d;
  return rest;
}

export function saveReport(
  user: SessionUser,
  pid: string,
  def: ReportDefinition,
  meta: SaveMeta = {},
): Promise<Result<{ id: string; publicId: string; version: number }>> {
  return asResult(() =>
    withCtx(user, true, async (tx, ctx) => {
      const issues = [...validateForSave(def), ...checkFields(user, def)];
      if (issues.some((i) => i.severity === 'error')) throw invalidRules(issues);
      const partner = await partnerOf(tx, pid);
      const base = {
        name: def.name.trim(),
        kind: kindOf(def),
        definition: dataOf(def) as unknown as Prisma.InputJsonValue,
        timeZone: def.timeZone,
        dateRange: def.dateRange as unknown as Prisma.InputJsonValue,
        autoRun: !!def.autoRun,
        template: def.template ?? null,
        ...(def.delivery
          ? { delivery: def.delivery as unknown as Prisma.InputJsonValue }
          : {}),
        ...(def.schedule
          ? {
              schedule: def.schedule as unknown as Prisma.InputJsonValue,
              nextRunSimAt: nextOccurrence(def.schedule, ctx.simNow),
            }
          : {}),
      };
      if (def.id) {
        const cur = await load(tx, user, def.id);
        if (!canEdit(cur, user)) throw forbidden();
        if (meta.expectedVersion !== undefined && meta.expectedVersion !== cur.version)
          throw conflict();
        const upd = await tx.report.update({
          where: { id: cur.id },
          data: { ...base, version: { increment: 1 } },
          select: { id: true, publicId: true, version: true },
        });
        return { data: { id: upd.id, publicId: upd.publicId.toString(), version: upd.version } };
      }
      const created = await tx.report.create({
        data: { sandboxId: ctx.sandboxId, partnerId: partner.id, ownerUserId: user.id, ...base },
        select: { id: true, publicId: true, version: true },
      });
      return {
        data: { id: created.id, publicId: created.publicId.toString(), version: created.version },
      };
    }).then((data) => data),
  );
}

export function saveReportAs(
  user: SessionUser,
  pid: string,
  id: string,
  name: string,
): Promise<Result<{ id: string; publicId: string }>> {
  return asResult(() =>
    withCtx(user, true, async (tx, ctx) => {
      const issues = validateForSave({
        kind: 'INSTANT',
        name,
        timeZone: 'ADVERTISER',
        dateRange: 'LAST_7_DAYS',
        filters: [{ field: 'partner', op: 'IN', values: ['x'] }],
        dimensions: [],
        metrics: [],
        viz: { type: 'TABLE' },
      }).filter((i) => i.path === 'name');
      if (issues.length) throw invalidRules(issues);
      const src = await load(tx, user, id);
      const copy = await tx.report.create({
        data: {
          sandboxId: ctx.sandboxId,
          partnerId: src.partnerId,
          advertiserId: src.advertiserId,
          ownerUserId: user.id,
          kind: src.kind,
          name: name.trim(),
          definition: src.definition as Prisma.InputJsonValue,
          timeZone: src.timeZone,
          dateRange: src.dateRange as Prisma.InputJsonValue,
          autoRun: src.autoRun,
          template: src.template,
        },
        select: { id: true, publicId: true },
      });
      void pid;
      return { data: { id: copy.id, publicId: copy.publicId.toString() } };
    }),
  );
}

export function deleteReport(user: SessionUser, id: string): Promise<Result<null>> {
  return asResult(() =>
    withCtx(user, true, async (tx) => {
      const r = await load(tx, user, id);
      if (r.ownerUserId !== user.id) throw forbidden();
      await tx.report.delete({ where: { id: r.id } });
      return { data: null };
    }),
  );
}

export function scheduleReport(
  user: SessionUser,
  id: string,
  schedule: ReportSchedule,
  delivery: ReportDelivery,
): Promise<Result<{ nextRunSimAt: string | null }>> {
  return asResult(() =>
    withCtx(user, true, async (tx, ctx) => {
      const r = await load(tx, user, id);
      if (!canEdit(r, user)) throw forbidden();
      const issues = validateForSave({ ...definitionOf(r), schedule, delivery });
      if (issues.some((i) => i.severity === 'error')) throw invalidRules(issues);
      const next = nextOccurrence(schedule, ctx.simNow);
      await tx.report.update({
        where: { id: r.id },
        data: {
          schedule: schedule as unknown as Prisma.InputJsonValue,
          delivery: delivery as unknown as Prisma.InputJsonValue,
          nextRunSimAt: schedule.active ? next : null,
          version: { increment: 1 },
        },
      });
      return { data: { nextRunSimAt: schedule.active && next ? next.toISOString() : null } };
    }),
  );
}

export interface ShareTarget {
  id: string;
  name: string;
  email: string;
}

/** People in this sandbox with report access (the owner and anyone with a grant but CREATIVE), minus the viewer. */
export async function listShareTargets(user: SessionUser): Promise<ShareTarget[]> {
  return withCtx(user, false, async (tx, ctx) => {
    const sb = await tx.sandbox.findUnique({
      where: { id: ctx.sandboxId },
      select: { ownerUserId: true },
    });
    const grants = await prisma.userAccessGrant.findMany({
      where: { sandboxId: ctx.sandboxId, role: { not: 'CREATIVE' } },
      select: { userId: true },
    });
    const ids = [...new Set([sb?.ownerUserId, ...grants.map((g) => g.userId)])].filter(
      (x): x is string => !!x && x !== user.id,
    );
    return peopleByIds(ids);
  });
}

export function shareReport(
  user: SessionUser,
  id: string,
  req: { userIds: string[]; canEdit: boolean },
): Promise<Result<null>> {
  return asResult(() =>
    withCtx(user, true, async (tx) => {
      const r = await load(tx, user, id);
      if (r.ownerUserId !== user.id) throw forbidden();
      const targets = new Set((await listShareTargets(user)).map((t) => t.id));
      const bad = req.userIds.filter((u) => !targets.has(u));
      if (bad.length) throw invalidRules(bad.flatMap(() => ruleShare(false)));
      await tx.reportShare.deleteMany({ where: { reportId: r.id } });
      if (req.userIds.length)
        await tx.reportShare.createMany({
          data: req.userIds.map((userId) => ({
            sandboxId: r.sandboxId,
            reportId: r.id,
            userId,
            canEdit: req.canEdit,
          })),
        });
      return { data: null };
    }),
  );
}

// ---------------------------------------------------------------------------------------------
// Query, runs, downloads
// ---------------------------------------------------------------------------------------------

export function queryReport(
  user: SessionUser,
  pid: string,
  def: ReportDefinition,
  limit: number = PREVIEW_CAP,
): Promise<Result<QueryResult>> {
  return asResult(async () => {
    try {
      const data = await withCtx(user, false, async (tx, ctx) => {
        const partner = await partnerOf(tx, pid);
        return runQuery(tx, ctx.sandboxId, partner.id, def, {
          limit: Math.min(limit, ROW_CAP),
          allowPartnerCost: allowPartnerCost(user),
        });
      });
      return { data };
    } catch (e) {
      if (e instanceof ReportInvalid) throw invalidRules(e.issues);
      throw e;
    }
  });
}

export function runReport(
  user: SessionUser,
  pid: string,
  req: { reportId?: string; definition?: ReportDefinition },
): Promise<Result<{ runId: string; status: 'DONE' | 'FAILED'; reportId: string }>> {
  return asResult(() =>
    withCtx(user, true, async (tx, ctx) => {
      const partner = await partnerOf(tx, pid);
      let rec: ReportRec | null = null;
      let def = req.definition;
      if (req.reportId) {
        rec = await load(tx, user, req.reportId);
        def = def ?? definitionOf(rec);
      }
      if (!def) throw notFound();
      if (!rec) {
        // an unsaved definition is stored first, so the run has a report to hang on (the hub lists it)
        const saved = await saveReport(user, pid, def).then((r) => {
          if (!r.ok) throw new ServiceFailure(r.code, r.issues);
          return r.data;
        });
        rec = await load(tx, user, saved.id);
      }
      const delivery = (rec.delivery as unknown as ReportDelivery | null) ?? undefined;
      const out = await executeRun(tx, {
        sandboxId: ctx.sandboxId,
        partnerId: partner.id,
        reportId: rec.id,
        reportName: rec.name,
        def,
        createdById: user.id,
        allowPartnerCost: allowPartnerCost(user),
        simNow: ctx.simNow,
        clockNow: ctx.simNow,
        scheduled: false,
        format: delivery?.format ?? 'CSV',
        ...(delivery?.fileName ? { fileStem: delivery.fileName } : {}),
      });
      await tx.report.update({ where: { id: rec.id }, data: { lastRunAt: new Date() } });
      if (out.status === 'FAILED')
        throw new ServiceFailure('INVALID', [
          { path: '*', severity: 'error', code: 'RPT-RUN', message: out.error ?? 'Run failed.' },
        ]);
      return { data: { runId: out.runId, status: out.status, reportId: rec.id } };
    }),
  );
}

export async function listRuns(
  user: SessionUser,
  reportId: string,
): Promise<{ report: { id: string; publicId: string; name: string; kind: string }; runs: RunRow[] }> {
  return withCtx(user, false, async (tx) => {
    const r = await load(tx, user, reportId);
    const recs = await tx.reportRun.findMany({
      where: { reportId: r.id },
      orderBy: [{ completedAt: { sort: 'desc', nulls: 'first' } }, { id: 'desc' }],
      take: 100,
    });
    const names = await namesOf([...new Set(recs.map((x) => x.createdById))]);
    const runs: RunRow[] = recs.map((x) => ({
      id: x.id,
      fileId: x.publicId.toString(),
      dateRange: {
        from: x.dateRangeStart.toISOString().slice(0, 10),
        to: x.dateRangeEnd.toISOString().slice(0, 10),
      },
      createdBy: x.scheduled ? 'Schedule' : (names.get(x.createdById) ?? 'Unknown'),
      completedAt: (x.completedAtSim ?? x.completedAt)?.toISOString() ?? null,
      status: x.status,
      format: x.format,
      fileName: x.fileName,
      sizeBytes: x.sizeBytes === null ? null : Number(x.sizeBytes),
      scheduled: x.scheduled,
      error: x.error,
      warnings: Array.isArray(x.warnings) ? (x.warnings as string[]) : [],
    }));
    return {
      report: { id: r.id, publicId: r.publicId.toString(), name: r.name, kind: r.kind },
      runs,
    };
  });
}

export interface DownloadFile {
  bytes: Uint8Array;
  fileName: string;
  contentType: string;
}

export async function downloadRun(
  user: SessionUser,
  runId: string,
  fmt: ReportFormatWire,
): Promise<DownloadFile> {
  return withCtx(user, false, async (tx) => {
    const run = await tx.reportRun.findFirst({
      where: { OR: [{ id: runId }, { publicId: /^\d+$/.test(runId) ? BigInt(runId) : -1n }] },
    });
    if (!run || run.status !== 'DONE' || !run.storageKey) throw notFound();
    await load(tx, user, run.reportId);
    const bytes = await getReportFile(run.storageKey, fmt);
    if (!bytes) throw notFound();
    const stem = (run.fileName ?? 'report').replace(/\.(csv|xlsx)$/i, '');
    return {
      bytes,
      fileName: `${stem}.${fmt === 'XLSX' ? 'xlsx' : 'csv'}`,
      contentType: CONTENT_TYPE[fmt],
    };
  });
}

/** Toolbar Download without a stored run (4.1 directDownload). */
export async function directDownload(
  user: SessionUser,
  pid: string,
  def: ReportDefinition,
  fmt: ReportFormatWire,
): Promise<DownloadFile> {
  return withCtx(user, false, async (tx, ctx) => {
    const partner = await partnerOf(tx, pid);
    try {
      const world = await loadWorld(tx, ctx.sandboxId, partner.id);
      const result = await runQuery(tx, ctx.sandboxId, partner.id, def, {
        limit: ROW_CAP,
        allowPartnerCost: allowPartnerCost(user),
        world,
      });
      const bytes = await filesFor(result, fileMetaFor(world, def, ctx.simNow), fmt);
      const p = (n: number) => String(n).padStart(2, '0');
      const d = ctx.simNow;
      const stamp = `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}_${p(d.getUTCHours())}${p(d.getUTCMinutes())}`;
      const stem = def.name.trim().replace(/[^\p{L}\p{N}._ -]+/gu, '').replace(/\s+/g, '_') || 'report';
      return {
        bytes,
        fileName: `${stem}_${stamp}.${fmt === 'XLSX' ? 'xlsx' : 'csv'}`,
        contentType: CONTENT_TYPE[fmt],
      };
    } catch (e) {
      if (e instanceof ReportInvalid) throw invalidRules(e.issues);
      throw e;
    }
  });
}

export async function generate(
  user: SessionUser,
  pid: string,
  prompt: string,
): Promise<GenerateResult> {
  return withCtx(user, true, async (tx) => {
    const partner = await partnerOf(tx, pid);
    return generateReport(prompt, partner.publicId.toString());
  });
}

// ---------------------------------------------------------------------------------------------
// Inbox (bell entries for scheduled runs, Δ16-5)
// ---------------------------------------------------------------------------------------------

export interface InboxItem {
  id: string;
  kind: string;
  title: string;
  body: string;
  reportRunId: string | null;
  createdAt: string;
  read: boolean;
}

export async function listInbox(user: SessionUser): Promise<InboxItem[]> {
  if (!user.sandboxId) return [];
  const sandboxId = user.sandboxId;
  return withSandbox(sandboxId, async (tx) => {
    const rows = await tx.inboxMessage.findMany({
      where: { userId: user.id },
      orderBy: { createdAtSim: 'desc' },
      take: 50,
    });
    return rows.map((m) => ({
      id: m.id,
      kind: m.kind,
      title: m.title,
      body: m.body,
      reportRunId: m.reportRunId,
      createdAt: m.createdAtSim.toISOString(),
      read: !!m.readAt,
    }));
  });
}
