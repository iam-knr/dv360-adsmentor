import 'server-only';
// SDF upload pipeline (module 11 K12, 4.7). Files are checked, then processed Campaigns -> IOs -> line items ->
// ad groups -> ads. Each row goes through the same validation and service as the form, in its own transaction
// (the "savepoint per row", C-11-2), so one failing row never rolls back its neighbours. Existing rows are
// compared with a fresh export: only the columns that differ are applied, which makes download-then-upload of an
// unchanged file a no-op (AC-11-04).
import { zipSync, strToU8 } from 'fflate';
import type { SessionUser } from '@/lib/auth/types';
import { ambientChange, runWithAmbient } from '@/lib/changelog/ambient';
import { withSandbox } from '@/lib/db';
import { archiveCampaigns, createCampaign, setCampaignStatus, updateCampaign } from '@/lib/campaigns/service';
import { assertWrite, asResult, serviceCtx, ServiceFailure, type Result, type ServiceCtx } from '@/lib/campaigns/service-kit';
import { newCampaignValue } from '@/lib/campaigns/wire';
import { archiveInsertionOrders, createInsertionOrder, setIoStatus, updateInsertionOrder } from '@/lib/insertion-orders/service';
import { newIoValue } from '@/lib/insertion-orders/wire';
import { createLineItem, getDraftInit, setLineItemStatus, updateLineItem } from '@/lib/line-items/service';
import { getAdGroupDetail, setAdGroupStatus, setAdStatus, updateAdGroup } from '@/lib/youtube/service';
import { createJob, finishJob, jobPayload, putResult } from '@/lib/bulk/jobs';
import { todayIn } from '@/lib/validation/primitives';
import { LIMITS } from '@/lib/validation/constants/limits';
import { CellError, parseCsv, writeCsv, decNum } from './codec';
import { detectEntity, headerProblems } from './detect';
import { columnsFor, ID_COLUMN, PARENT_COLUMN, type ColumnDef } from './layouts';
import { cellsOf, loadCampaignModels, loadIoModels, loadLiModels, loadRefs } from './load';
import { campaignMaps, type CampaignModel } from './map-campaign';
import { ioMaps, type IoModel } from './map-io';
import { liMaps, type LiModel } from './map-li';
import { BLK, blk021, blk025, blk026, blk033 } from './rules';
import { ENTITY_FILE, ENTITY_LABEL, SDF9_END, UPLOAD_ORDER, fromDbVersion, type SdfEntity, type SdfVersion } from './versions';
import { parseIdRef, whereId } from '@/lib/routes/params';

export interface UploadFileIn {
  name: string;
  text: string;
}

export interface SdfUploadRequest {
  advertiserId: string;
  files: UploadFileIn[];
}

export interface FileSummary {
  entity: string;
  rows: number;
  succeeded: number;
  failed: number;
  warnings: number;
}

export interface SdfUploadResult {
  jobId: string;
  status: 'COMPLETED' | 'FAILED';
  perFile: FileSummary[];
  fileErrors: { file: string; ruleId: string; message: string }[];
  /** BLK-004 applied to this many line item rows. */
  euDefaulted: number;
}

interface RowOutcome {
  rowNumber: number;
  cells: string[];
  ok: boolean;
  id?: string;
  ruleId?: string;
  message?: string;
  warnings: { ruleId: string; message: string }[];
  unchanged?: boolean;
}

type Env = {
  user: SessionUser;
  ctx: ServiceCtx;
  advertiserId: string;
  advertiserPublicId: string;
  version: SdfVersion;
  today: string;
  /** ext id (lower case) -> created entity, per entity type. */
  created: Map<string, { id: string; publicId: string }>;
  failedExt: Set<string>;
  euDefaulted: number;
};

const extKey = (entity: SdfEntity, id: string) => `${entity}:${id.toLowerCase()}`;
const isExt = (id: string) => id === '' || /^ext/i.test(id);

const fail = (message: string, ruleId: string) => ({ ruleId, message });

/** Compare two cells by value, not text: 1500 equals 1500.00, TRUE equals true. */
function sameCell(kind: ColumnDef['kind'], a: string, b: string): boolean {
  const x = a.trim();
  const y = b.trim();
  if (x === y) return true;
  if (kind === 'money' || kind === 'pct' || kind === 'int') {
    const nx = x === '' ? null : Number(x);
    const ny = y === '' ? null : Number(y);
    return nx !== null && ny !== null && Number.isFinite(nx) && nx === ny;
  }
  if (kind === 'bool' || kind === 'enum' || kind === 'text') return x.toLowerCase() === y.toLowerCase() && kind !== 'text';
  if (kind === 'list') return x.split(';').map((s) => s.trim()).join(';') === y.split(';').map((s) => s.trim()).join(';');
  return false;
}

const LOCKED: Partial<Record<SdfEntity, Record<string, string>>> = {
  INSERTION_ORDERS: { 'Io Type': 'The insertion order type', 'Budget Type': 'The budget type' },
  LINE_ITEMS: {
    Type: 'The line item type',
    Subtype: 'The subtype',
    'Mobile App Platform': 'The app',
    'Mobile App Id': 'The app',
    'App Ad Format': 'The ad format',
  },
};

function resultFail(res: { ok: false; issues?: { message: string; code?: string; ruleId?: string; severity?: string; blocking?: boolean }[]; code?: string }) {
  const issues = res.issues ?? [];
  const first = issues.find((i) => i.blocking !== false && i.severity !== 'warning') ?? issues[0];
  return fail(first?.message ?? 'The row could not be saved.', first?.ruleId ?? first?.code ?? 'BLK-005');
}

// ---------------------------------------------------------------------------------------------
// One row
// ---------------------------------------------------------------------------------------------

async function processRow(
  env: Env,
  entity: SdfEntity,
  headers: string[],
  raw: string[],
  rowNumber: number,
  seenIds: Set<string>,
): Promise<RowOutcome> {
  const cells: Record<string, string> = {};
  headers.forEach((h, i) => (cells[h] = (raw[i] ?? '').trim()));
  const out: RowOutcome = { rowNumber, cells: raw, ok: false, warnings: [] };
  const done = (ruleId: string, message: string): RowOutcome => ({ ...out, ruleId, message });
  const idCol = ID_COLUMN[entity];
  const rawId = cells[idCol] ?? '';

  if (rawId !== '') {
    if (seenIds.has(rawId.toLowerCase())) return done('BLK-027', BLK['BLK-027']);
    seenIds.add(rawId.toLowerCase());
  }
  // legacy campaign and IO targeting columns (BLK-003)
  for (const c of columnsFor(entity, env.version))
    if (c.legacy && (cells[c.name] ?? '') !== '') return done('BLK-003', BLK['BLK-003']);

  // parent
  const parentCol = PARENT_COLUMN[entity];
  let parent: { id: string; publicId: string } | null = null;
  if (entity === 'CAMPAIGNS') {
    const adv = cells['Advertiser Id'] ?? '';
    if (adv !== env.advertiserPublicId) return done('BLK-026', blk026('advertiser'));
  } else if (parentCol) {
    const raw = cells[parentCol] ?? '';
    const parentEntity = entity === 'INSERTION_ORDERS' ? 'CAMPAIGNS' : entity === 'LINE_ITEMS' ? 'INSERTION_ORDERS' : entity === 'AD_GROUPS' ? 'LINE_ITEMS' : 'AD_GROUPS';
    const noun = { CAMPAIGNS: 'campaign', INSERTION_ORDERS: 'insertion order', LINE_ITEMS: 'line item', AD_GROUPS: 'ad group' }[parentEntity]!;
    if (/^ext/i.test(raw)) {
      const k = extKey(parentEntity, raw);
      if (env.failedExt.has(k)) return done('BLK-029', BLK['BLK-029']);
      parent = env.created.get(k) ?? null;
    } else if (/^\d+$/.test(raw)) {
      parent = await findByPublicId(env, parentEntity, raw);
    }
    if (!parent) return done('BLK-026', blk026(noun));
  }

  const isNew = isExt(rawId);
  const noun = ENTITY_LABEL[entity].toLowerCase();
  try {
    if (entity === 'AD_GROUPS' || entity === 'ADS') return await processYoutubeRow(env, entity, cells, out, isNew, rawId);
    if (isNew) return await createRow(env, entity, cells, out, parent!, rawId);
    const found = await findByPublicId(env, entity, rawId);
    if (!found) return done('BLK-025', blk025(noun.replace(/s$/, '')));
    return await updateRow(env, entity, cells, out, found, parent);
  } catch (e) {
    if (e instanceof CellError) return done(e.ruleId, e.message);
    if (e instanceof ServiceFailure) return done(e.issues[0]?.code ?? 'BLK-005', e.issues[0]?.message ?? 'The row could not be saved.');
    throw e;
  }
}

async function findByPublicId(env: Env, entity: SdfEntity, publicId: string) {
  return withSandbox(env.ctx.sandboxId, async (tx) => {
    const where = { publicId: BigInt(publicId), advertiserId: env.advertiserId };
    const row =
      entity === 'CAMPAIGNS'
        ? await tx.campaign.findFirst({ where, select: { id: true, publicId: true } })
        : entity === 'INSERTION_ORDERS'
          ? await tx.insertionOrder.findFirst({ where, select: { id: true, publicId: true } })
          : entity === 'LINE_ITEMS'
            ? await tx.lineItem.findFirst({ where, select: { id: true, publicId: true } })
            : entity === 'AD_GROUPS'
              ? await tx.adGroup.findFirst({ where, select: { id: true, publicId: true } })
              : await tx.ad.findFirst({ where, select: { id: true, publicId: true } });
    return row ? { id: row.id, publicId: row.publicId.toString() } : null;
  });
}

type AnyMaps = Record<string, { get?: (m: never) => string; set?: (m: never, v: string) => void }>;
const MAPS: Record<string, AnyMaps> = {
  CAMPAIGNS: campaignMaps as unknown as AnyMaps,
  INSERTION_ORDERS: ioMaps as unknown as AnyMaps,
  LINE_ITEMS: liMaps as unknown as AnyMaps,
};

const SKIP_ON_APPLY = new Set(['Timestamp', 'Advertiser Id']);

function applyCells(env: Env, entity: SdfEntity, model: unknown, cells: Record<string, string>, only: Set<string> | null, out: RowOutcome) {
  const maps = MAPS[entity]!;
  for (const col of columnsFor(entity, env.version)) {
    const name = col.name;
    if (SKIP_ON_APPLY.has(name) || name === ID_COLUMN[entity] || name === PARENT_COLUMN[entity] || name === 'Status') continue;
    if (only && !only.has(name)) continue;
    const v = cells[name];
    if (v === undefined || (!only && v === '')) continue;
    const map = maps[name];
    if (!map?.set) {
      if (v !== '') out.warnings.push({ ruleId: 'BLK-028', message: BLK['BLK-028'] });
      continue;
    }
    (map.set as (m: unknown, v: string) => void)(model, v);
  }
}

async function createRow(env: Env, entity: SdfEntity, cells: Record<string, string>, out: RowOutcome, parent: { id: string; publicId: string }, rawId: string): Promise<RowOutcome> {
  const { user } = env;
  const rememberExt = (created: { id: string; publicId: string }) => {
    if (rawId !== '') env.created.set(extKey(entity, rawId), created);
  };
  if (entity === 'CAMPAIGNS') {
    const model = { publicId: '', advertiserPublicId: env.advertiserPublicId, updatedAt: new Date(), wire: newCampaignValue(env.today) } as CampaignModel;
    model.wire.budgets = [];
    applyCells(env, entity, model, cells, null, out);
    setNewStatus(cells, (s) => (model.wire.status = s === 'PAUSED' ? 'PAUSED' : 'ACTIVE'));
    const res = await createCampaign(user, env.advertiserId, model.wire);
    if (!res.ok) return { ...out, ...resultFail(res) };
    rememberExt(res.data);
    return { ...out, ok: true, id: res.data.publicId };
  }
  if (entity === 'INSERTION_ORDERS') {
    const type = new Map([['standard', 'STANDARD'], ['connected tv and ott streaming', 'CTV_OTT'], ['digital out of home', 'DOOH']]).get((cells['Io Type'] ?? '').toLowerCase()) as 'STANDARD' | 'CTV_OTT' | 'DOOH' | undefined;
    const probe = { wire: newIoValue(type ?? 'STANDARD', 'NONE', env.today) } as unknown as IoModel;
    ioMaps.Objective!.set!(probe, cells.Objective ?? '');
    const model = { publicId: '', campaignPublicId: parent.publicId, updatedAt: new Date(), wire: newIoValue(probe.wire.type ?? type ?? 'STANDARD', probe.wire.objective ?? 'NONE', env.today) } as IoModel;
    applyCells(env, entity, model, cells, null, out);
    setNewStatus(cells, (s) => (model.wire.status = s === 'ACTIVE' ? 'ACTIVE' : 'DRAFT'));
    const res = await createInsertionOrder(user, parent.id, model.wire);
    if (!res.ok) return { ...out, ...resultFail(res) };
    rememberExt(res.data);
    return { ...out, ok: true, id: res.data.publicId };
  }
  // line item
  const typeKey = ((): string | null => {
    const m = { value: {} } as unknown as LiModel;
    (liMaps.Type!.set as (m: LiModel, v: string) => void)(m, cells.Type ?? '');
    return m.value.type;
  })();
  if (!typeKey) return { ...out, ruleId: 'BLK-031', message: `"" isn't a valid option for Type.` };
  const init = await getDraftInit(user, parent.id, typeKey, { name: cells.Name ?? '' });
  if (!init) return { ...out, ruleId: 'BLK-026', message: blk026('insertion order') };
  const refs = await withSandbox(env.ctx.sandboxId, (tx) => loadRefs(tx, env.advertiserId));
  const model: LiModel = { publicId: '', ioPublicId: parent.publicId, updatedAt: new Date(), value: init.value, refs };
  applyCells(env, entity, model, cells, null, out);
  // BLK-004: a blank EU political ads answer becomes No
  if (!model.value.euPoliticalAds) {
    model.value.euPoliticalAds = 'NO';
    env.euDefaulted += 1;
  }
  setNewStatus(cells, (s) => (model.value.status = s === 'ACTIVE' ? 'ACTIVE' : 'DRAFT'));
  const res = await createLineItem(user, parent.id, model.value);
  if (!res.ok) return { ...out, ...resultFail(res) };
  rememberExt(res.data);
  return { ...out, ok: true, id: res.data.publicId };
}

function setNewStatus(cells: Record<string, string>, set: (s: 'ACTIVE' | 'PAUSED' | 'DRAFT' | 'ARCHIVED') => void) {
  const s = (cells.Status ?? '').toUpperCase();
  if (s === 'ACTIVE' || s === 'PAUSED' || s === 'DRAFT' || s === 'ARCHIVED') set(s);
}

async function updateRow(env: Env, entity: SdfEntity, cells: Record<string, string>, out: RowOutcome, found: { id: string; publicId: string }, parent: { id: string; publicId: string } | null): Promise<RowOutcome> {
  const { user } = env;
  const opts = { includeArchived: true } as const;
  const refs = entity === 'LINE_ITEMS' ? await withSandbox(env.ctx.sandboxId, (tx) => loadRefs(tx, env.advertiserId)) : undefined;
  const model = await withSandbox(env.ctx.sandboxId, async (tx) => {
    if (entity === 'CAMPAIGNS') return (await loadCampaignModels(tx, env.advertiserId, { ...opts, campaignIds: [found.id] }))[0];
    if (entity === 'INSERTION_ORDERS') return (await loadIoModels(tx, env.advertiserId, { ...opts, ioIds: [found.id] }))[0];
    return (await loadLiModels(tx, env.advertiserId, { ...opts, liIds: [found.id] }, refs))[0];
  });
  if (!model) return { ...out, ruleId: 'BLK-025', message: blk025('row') };
  const e = entity as 'CAMPAIGNS' | 'INSERTION_ORDERS' | 'LINE_ITEMS';
  if ((cells.Timestamp ?? '') !== String(model.updatedAt.getTime())) return { ...out, ruleId: 'BLK-024', message: BLK['BLK-024'] };
  // the parent cannot change in a file
  const parentCol = PARENT_COLUMN[entity];
  if (parentCol && parent && cellsOf(e, model, env.version)[parentCol] !== parent.publicId)
    return { ...out, ruleId: 'BLK-033', message: blk033('The parent') };

  const current = cellsOf(e, model, env.version);
  const changed = new Set<string>();
  for (const col of columnsFor(entity, env.version)) {
    if (SKIP_ON_APPLY.has(col.name) || col.name === ID_COLUMN[entity] || col.name === parentCol) continue;
    const cell = cells[col.name];
    if (cell === undefined) continue;
    if (!sameCell(col.kind, cell, current[col.name] ?? '')) changed.add(col.name);
  }
  const locks = LOCKED[entity] ?? {};
  for (const name of changed)
    if (locks[name]) return { ...out, ruleId: 'BLK-033', message: blk033(locks[name]!) };
  for (const name of [...changed]) {
    const col = columnsFor(entity, env.version).find((c) => c.name === name)!;
    if (col.readOnly) {
      out.warnings.push({ ruleId: 'BLK-028', message: BLK['BLK-028'] });
      changed.delete(name);
    }
  }
  if (changed.size === 0) return { ...out, ok: true, id: found.publicId, unchanged: true };

  const statusChanged = changed.delete('Status');
  const dataColumns = new Set(changed);
  if (dataColumns.size) {
    applyCells(env, entity, model, cells, dataColumns, out);
    // keep the stored status in the written value, the status moves separately
    if (entity === 'CAMPAIGNS') {
      const res = await updateCampaign(user, found.id, (model as CampaignModel).wire);
      if (!res.ok) return { ...out, ...resultFail(res) };
    } else if (entity === 'INSERTION_ORDERS') {
      const res = await updateInsertionOrder(user, found.id, (model as IoModel).wire);
      if (!res.ok) return { ...out, ...resultFail(res) };
    } else {
      const res = await updateLineItem(user, found.id, (model as LiModel).value);
      if (!res.ok) return { ...out, ...resultFail(res) };
    }
  }
  if (statusChanged) {
    const target = (cells.Status ?? '').toUpperCase();
    const r = await moveStatus(env, entity, found.id, target);
    if (r) return { ...out, ...r };
  }
  return { ...out, ok: true, id: found.publicId };
}

async function moveStatus(env: Env, entity: SdfEntity, id: string, target: string) {
  const { user } = env;
  if (target === 'ARCHIVED') {
    const jobId = ambientChange()?.bulkJobId;
    const o = jobId ? { jobId } : {};
    if (entity === 'CAMPAIGNS') { const r = await archiveCampaigns(user, [id], o); return r.ok ? null : resultFail(r); }
    if (entity === 'INSERTION_ORDERS') { const r = await archiveInsertionOrders(user, [id], o); return r.ok ? null : resultFail(r); }
    const r = await setLineItemStatus(user, { id, status: 'ARCHIVED' });
    return r.ok ? null : resultFail(r);
  }
  if (target !== 'ACTIVE' && target !== 'PAUSED') return fail('Only Active, Paused and Archived can be set on an existing row.', 'BLK-031');
  if (entity === 'CAMPAIGNS') { const r = await setCampaignStatus(user, id, target); return r.ok ? null : resultFail(r); }
  if (entity === 'INSERTION_ORDERS') { const r = await setIoStatus(user, id, target); return r.ok ? null : resultFail(r); }
  const r = await setLineItemStatus(user, { id, status: target });
  return r.ok ? null : resultFail(r);
}

/** Ad groups and ads: existing rows only, Name / Status / Bid Value (ad groups) and Name / Status (ads). */
async function processYoutubeRow(env: Env, entity: SdfEntity, cells: Record<string, string>, out: RowOutcome, isNew: boolean, rawId: string): Promise<RowOutcome> {
  if (isNew) return { ...out, ruleId: 'BLK-005', message: 'The simulator creates ad groups and ads in the line item page. Upload changes to existing rows only.' };
  const found = await findByPublicId(env, entity, rawId);
  if (!found) return { ...out, ruleId: 'BLK-025', message: blk025(entity === 'AD_GROUPS' ? 'ad group' : 'ad') };
  const row = await withSandbox(env.ctx.sandboxId, async (tx) =>
    entity === 'AD_GROUPS' ? tx.adGroup.findUnique({ where: { id: found.id } }) : tx.ad.findUnique({ where: { id: found.id } }),
  );
  if (!row) return { ...out, ruleId: 'BLK-025', message: blk025('row') };
  if ((cells.Timestamp ?? '') !== String(row.updatedAt.getTime())) return { ...out, ruleId: 'BLK-024', message: BLK['BLK-024'] };
  const status = (cells.Status ?? '').toUpperCase();
  const nameChanged = (cells.Name ?? '') !== row.name;
  const bidCell = cells['Bid Value'];
  const bidChanged = entity === 'AD_GROUPS' && bidCell !== undefined && 'bidValue' in row && decNum(bidCell) !== (row.bidValue ? Number(row.bidValue.toString()) : null);
  if (nameChanged || bidChanged) {
    if (entity === 'AD_GROUPS') {
      const g = row as { name: string; status: string; bidValue: { toString(): string } | null };
      const user = env.user;
      const d = await getAdGroupDetail(user, found.id);
      if (!d) return { ...out, ruleId: 'BLK-025', message: blk025('ad group') };
      const value = { ...d.value, name: cells.Name ?? g.name, ...(bidChanged ? { bid: String(decNum(bidCell!) ?? '') } : {}) };
      const res = await updateAdGroup(user, found.id, value);
      if (!res.ok) return { ...out, ...resultFail(res) };
    } else {
      out.warnings.push({ ruleId: 'BLK-028', message: 'Ad names are changed on the ad page. The value was ignored.' });
    }
  }
  if (status && status !== row.status && (status === 'ACTIVE' || status === 'PAUSED')) {
    const res = entity === 'AD_GROUPS' ? await setAdGroupStatus(env.user, found.id, status) : await setAdStatus(env.user, found.id, status);
    if (!res.ok) return { ...out, ...resultFail(res) };
  }
  return { ...out, ok: true, id: found.publicId };
}

// ---------------------------------------------------------------------------------------------
// Whole upload
// ---------------------------------------------------------------------------------------------

export async function requestSdfUpload(user: SessionUser, req: SdfUploadRequest): Promise<Result<SdfUploadResult>> {
  return asResult<SdfUploadResult>(async () => {
    const ctx = await serviceCtx(user);
    assertWrite(ctx); // BLK-035
    const ref = parseIdRef(req.advertiserId);
    if (!ref) throw new ServiceFailure('NOT_FOUND');
    const adv = await withSandbox(ctx.sandboxId, (tx) => tx.advertiser.findFirst({ where: whereId(ref) }));
    if (!adv) throw new ServiceFailure('NOT_FOUND');
    const version = fromDbVersion(adv.sdfVersion);
    const today = todayIn(ctx.simNow, adv.timeZone);
    const fileErrors: SdfUploadResult['fileErrors'] = [];
    const job = await withSandbox(ctx.sandboxId, (tx) =>
      createJob(tx, ctx, {
        advertiserId: adv.id,
        source: 'SDF_UPLOAD',
        action: 'UPLOAD_SDF',
        description: `SDF upload: ${req.files.map((f) => f.name).join(', ')}`,
        payload: jobPayload(ctx, { files: req.files.map((f) => f.name), version }),
        selectionCount: req.files.length,
        status: 'RUNNING',
      }),
    );
    const finishFailed = async (message: string, ruleId: string) => {
      await withSandbox(ctx.sandboxId, async (tx) => {
        await tx.bulkJobItem.create({ data: { sandboxId: ctx.sandboxId, jobId: job.id, entityType: 'CAMPAIGN', status: 'FAILED', message, ruleId } });
        await finishJob(tx, job.id, { status: 'FAILED', errorSummary: message });
      });
      return { data: { jobId: job.id, status: 'FAILED' as const, perFile: [] as FileSummary[], fileErrors: [{ file: '', ruleId, message }], euDefaulted: 0 } };
    };

    // BLK-022: version 9 is closed after the end date on the sim clock
    if (version === '9' && today > SDF9_END) return finishFailed(BLK['BLK-022'], 'BLK-022');

    // pre-flight
    const parsed = new Map<SdfEntity, { name: string; headers: string[]; rows: string[][] }>();
    for (const f of req.files) {
      if (!/\.csv$/i.test(f.name)) {
        fileErrors.push({ file: f.name, ruleId: 'BLK-002', message: BLK['BLK-002'] });
        continue;
      }
      if (new TextEncoder().encode(f.text).length > LIMITS.SDF_MAX_FILE_MB * 1024 * 1024) {
        fileErrors.push({ file: f.name, ruleId: 'BLK-023', message: BLK['BLK-023'] });
        continue;
      }
      const csv = parseCsv(f.text);
      if (!csv) {
        fileErrors.push({ file: f.name, ruleId: 'BLK-020', message: BLK['BLK-020'] });
        continue;
      }
      const entity = detectEntity(csv.headers);
      if (!entity) {
        fileErrors.push({ file: f.name, ruleId: 'BLK-021', message: blk021(version) });
        continue;
      }
      const problems = headerProblems(entity, version, csv.headers);
      if (problems.unknown.length || problems.missingRequired.length) {
        fileErrors.push({ file: f.name, ruleId: 'BLK-021', message: blk021(version) });
        continue;
      }
      if (parsed.has(entity)) {
        fileErrors.push({ file: f.name, ruleId: 'BLK-002', message: BLK['BLK-002'] });
        continue;
      }
      if (csv.rows.length > LIMITS.SDF_MAX_ROWS_PER_FILE) {
        fileErrors.push({ file: f.name, ruleId: 'BLK-023', message: BLK['BLK-023'] });
        continue;
      }
      parsed.set(entity, { name: f.name, ...csv });
    }
    const totalRows = [...parsed.values()].reduce((n, p) => n + p.rows.length, 0);
    if (totalRows > LIMITS.BULK_MAX_ITEMS) return finishFailed(BLK['BLK-034'], 'BLK-034');
    const bad = fileErrors.find((e) => e.ruleId === 'BLK-002');
    if (bad && parsed.size === 0) return finishFailed(bad.message, bad.ruleId);
    if (parsed.size === 0) {
      const first = fileErrors[0] ?? { ruleId: 'BLK-020', message: BLK['BLK-020'] };
      await putFileErrors(ctx, job.id, fileErrors);
      return finishFailed(first.message, first.ruleId);
    }

    const env: Env = {
      user,
      ctx,
      advertiserId: adv.id,
      advertiserPublicId: adv.publicId.toString(),
      version,
      today,
      created: new Map(),
      failedExt: new Set(),
      euDefaulted: 0,
    };
    const perFile: FileSummary[] = [];
    const files: Record<string, Uint8Array> = {};
    const items: { entity: SdfEntity; o: RowOutcome }[] = [];
    await runWithAmbient({ source: 'SDF_UPLOAD', bulkJobId: job.id }, async () => {
      for (const entity of UPLOAD_ORDER) {
        const p = parsed.get(entity);
        if (!p) continue;
        const seen = new Set<string>();
        const outcomes: RowOutcome[] = [];
        for (let i = 0; i < p.rows.length; i++) {
          const o = await processRow(env, entity, p.headers, p.rows[i]!, i + 2, seen);
          outcomes.push(o);
          items.push({ entity, o });
          if (!o.ok) {
            const idx = p.headers.indexOf(ID_COLUMN[entity]);
            const id = (p.rows[i]![idx] ?? '').trim();
            if (/^ext/i.test(id)) env.failedExt.add(extKey(entity, id));
          }
        }
        const label = ENTITY_FILE[entity].replace(/^SDF-|\.csv$/g, '');
        const idIdx = p.headers.indexOf(ID_COLUMN[entity]);
        files[`SDF-${label}-Successful.csv`] = strToU8(
          writeCsv(
            [...p.headers, 'Id'],
            outcomes.filter((o) => o.ok).map((o) => [...padTo(o.cells, p.headers.length), o.id ?? o.cells[idIdx] ?? '']),
          ),
        );
        files[`SDF-${label}-Failed.csv`] = strToU8(
          writeCsv(
            [...p.headers, 'Row Number', 'Error Rule Id', 'Error Message'],
            outcomes.filter((o) => !o.ok).map((o) => [...padTo(o.cells, p.headers.length), String(o.rowNumber), o.ruleId ?? '', o.message ?? '']),
          ),
        );
        perFile.push({
          entity: ENTITY_LABEL[entity],
          rows: outcomes.length,
          succeeded: outcomes.filter((o) => o.ok).length,
          failed: outcomes.filter((o) => !o.ok).length,
          warnings: outcomes.reduce((n, o) => n + o.warnings.length, 0),
        });
      }
    });
    files['Summary.txt'] = strToU8(
      [`SDF version ${version}`, ...perFile.map((f) => `${f.entity}: ${f.rows} rows, ${f.succeeded} succeeded, ${f.failed} failed, ${f.warnings} warnings`), ...fileErrors.map((e) => `${e.file}: ${e.ruleId} ${e.message}`)].join('\r\n') + '\r\n',
    );
    const key = await putResult(ctx.sandboxId, job.id, 'SDF-ResultFiles.zip', zipSync(files));
    const failedRows = perFile.reduce((n, f) => n + f.failed, 0);
    await withSandbox(ctx.sandboxId, async (tx) => {
      const data = items.map(({ entity, o }) => ({
        sandboxId: ctx.sandboxId,
        jobId: job.id,
        entityType: ({ CAMPAIGNS: 'CAMPAIGN', INSERTION_ORDERS: 'INSERTION_ORDER', LINE_ITEMS: 'LINE_ITEM', AD_GROUPS: 'AD_GROUP', ADS: 'AD', MEDIA_PRODUCTS: 'DEAL' } as const)[entity],
        entityId: o.id ?? null,
        status: (o.ok ? 'OK' : 'FAILED') as 'OK' | 'FAILED',
        message: o.message ?? o.warnings[0]?.message ?? null,
        ruleId: o.ruleId ?? o.warnings[0]?.ruleId ?? null,
        rowNumber: o.rowNumber,
      }));
      if (data.length) await tx.bulkJobItem.createMany({ data });
      await finishJob(tx, job.id, {
        status: 'COMPLETED',
        errorSummary: failedRows ? `${failedRows} of ${items.length} items failed` : null,
        resultKind: 'FILE',
        resultStorageKey: key,
      });
    });
    return { data: { jobId: job.id, status: 'COMPLETED' as const, perFile, fileErrors, euDefaulted: env.euDefaulted } };
  });
}

const padTo = (cells: string[], n: number) => Array.from({ length: n }, (_, i) => cells[i] ?? '');

async function putFileErrors(ctx: ServiceCtx, jobId: string, errors: SdfUploadResult['fileErrors']) {
  await withSandbox(ctx.sandboxId, (tx) =>
    tx.bulkJobItem.createMany({
      data: errors.map((e) => ({ sandboxId: ctx.sandboxId, jobId, entityType: 'CAMPAIGN' as const, status: 'FAILED' as const, message: `${e.file}: ${e.message}`, ruleId: e.ruleId })),
    }),
  );
}
