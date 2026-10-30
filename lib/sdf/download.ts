import 'server-only';
// SDF download, Download QA and Download metadata (module 11 K9..K11, 4.4..4.6). The file is built inside the
// request (the data is small) and stored; the job is COMPLETED when it returns, and the Bulk status row offers it.
import { zipSync, strToU8 } from 'fflate';
import type { SessionUser } from '@/lib/auth/types';
import { withSandbox } from '@/lib/db';
import { assertRead, asResult, serviceCtx, ServiceFailure, type Result } from '@/lib/campaigns/service-kit';
import { validateCampaign } from '@/lib/campaigns/service';
import { validateInsertionOrder } from '@/lib/insertion-orders/service';
import { validateLineItem } from '@/lib/line-items/service';
import { createJob, finishJob, jobPayload, putResult } from '@/lib/bulk/jobs';
import type { BulkEntityKey } from '@/lib/bulk/entities';
import { parseIdRef, whereId } from '@/lib/routes/params';
import { writeCsv } from './codec';
import { exportTable, loadCampaignModels, loadIoModels, loadLiModels, type LoadOpts } from './load';
import { ENTITY_FILE, ENTITY_LABEL, SDF_ENTITIES, fromDbVersion, type SdfEntity, type SdfVersion } from './versions';
import { SDF_VERSIONS } from './versions';

export interface SdfDownloadRequest {
  /** Advertiser public id or row id. */
  advertiserId: string;
  include: Partial<Record<SdfEntity, boolean>>;
  kind: 'DATA' | 'QA' | 'METADATA';
  version?: SdfVersion;
  includeArchived?: boolean;
  /** A bulk selection: the files hold the selected rows and their descendants (2.1). */
  selection?: { entity: BulkEntityKey; ids: string[] };
}

const stamp = (d = new Date()) =>
  `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}${String(d.getUTCHours()).padStart(2, '0')}${String(d.getUTCMinutes()).padStart(2, '0')}`;

const invalid = (message: string) =>
  new ServiceFailure('INVALID', [{ path: 'include', severity: 'error', code: 'BLK-001', message }]);

async function scopeOpts(
  tx: Parameters<Parameters<typeof withSandbox>[1]>[0],
  advertiserId: string,
  sel: SdfDownloadRequest['selection'],
  includeArchived: boolean,
): Promise<LoadOpts> {
  const o: LoadOpts = { includeArchived };
  if (!sel) return o;
  const refs = sel.ids.map(parseIdRef).filter((r): r is NonNullable<typeof r> => !!r);
  const where = refs.map(whereId);
  if (sel.entity === 'campaign')
    o.campaignIds = (await tx.campaign.findMany({ where: { advertiserId, OR: where }, select: { id: true } })).map((r) => r.id);
  else if (sel.entity === 'insertionOrder')
    o.ioIds = (await tx.insertionOrder.findMany({ where: { advertiserId, OR: where }, select: { id: true } })).map((r) => r.id);
  else o.liIds = (await tx.lineItem.findMany({ where: { advertiserId, OR: where }, select: { id: true } })).map((r) => r.id);
  return o;
}

/** Selected campaigns hold IOs and line items below; selected IOs hold line items; the parents above are not listed. */
function forEntity(o: LoadOpts, entity: SdfEntity, sel: SdfDownloadRequest['selection']): LoadOpts {
  if (!sel) return o;
  const { campaignIds, ioIds, liIds, includeArchived } = o;
  const base: LoadOpts = { includeArchived };
  if (entity === 'CAMPAIGNS') return { ...base, ...(campaignIds ? { campaignIds } : {}) };
  if (entity === 'INSERTION_ORDERS') return { ...base, ...(ioIds ? { ioIds } : {}), ...(campaignIds ? { campaignIds } : {}) };
  return { ...base, ...(liIds ? { liIds } : {}), ...(ioIds ? { ioIds } : {}), ...(campaignIds ? { campaignIds } : {}) };
}

export async function requestSdfDownload(
  user: SessionUser,
  req: SdfDownloadRequest,
): Promise<Result<{ jobId: string }>> {
  return asResult(async () => {
    const ctx = await serviceCtx(user);
    assertRead(ctx);
    const wanted = SDF_ENTITIES.filter((e) => req.include[e]);
    if (req.kind === 'DATA' && wanted.length === 0) throw invalid('Select at least one entity type.');
    const ref = parseIdRef(req.advertiserId);
    if (!ref) throw new ServiceFailure('NOT_FOUND');
    const out = await withSandbox(ctx.sandboxId, async (tx) => {
      const adv = await tx.advertiser.findFirst({ where: whereId(ref) });
      if (!adv) throw new ServiceFailure('NOT_FOUND');
      const version = req.version && SDF_VERSIONS.includes(req.version) ? req.version : fromDbVersion(adv.sdfVersion);
      const archived = !!req.includeArchived;
      const base = await scopeOpts(tx, adv.id, req.selection, archived);
      const ts = stamp();
      const advId = adv.publicId.toString();
      const desc =
        req.kind === 'QA'
          ? `SDF QA download for advertiser ${advId}`
          : req.kind === 'METADATA'
            ? `Download spreadsheet of campaign ${advId}`
            : `SDF download: ${wanted.map((e) => ENTITY_LABEL[e]).join(', ')}`;
      const job = await createJob(tx, ctx, {
        advertiserId: adv.id,
        source: req.kind === 'METADATA' ? 'CAMPAIGN_DOWNLOAD' : 'SDF_DOWNLOAD',
        action: req.kind === 'QA' ? 'DOWNLOAD_QA' : req.kind === 'METADATA' ? 'DOWNLOAD_METADATA' : 'DOWNLOAD_SDF',
        description: desc,
        payload: jobPayload(ctx, { kind: req.kind, version, include: wanted, advertiserId: adv.id }),
        selectionCount: req.selection?.ids.length ?? 0,
        status: 'RUNNING',
      });
      let name: string;
      let bytes: Uint8Array;
      if (req.kind === 'DATA') {
        const files: Record<string, Uint8Array> = {};
        for (const e of wanted) {
          const t = await exportTable(tx, adv.id, e, version, forEntity(base, e, req.selection));
          files[ENTITY_FILE[e]] = strToU8(writeCsv(t.headers, t.rows.map((r) => t.headers.map((h) => r[h] ?? ''))));
        }
        files['README.txt'] = strToU8(`SDF version ${version}\r\nCreated ${new Date().toISOString()}\r\nAdvertiser ${advId}\r\n`);
        name = `SDF-${advId}-${ts}.zip`;
        bytes = zipSync(files);
      } else if (req.kind === 'METADATA') {
        name = `Metadata-${advId}-${ts}.csv`;
        bytes = strToU8(await metadataCsv(tx, adv.id, version, base));
      } else {
        name = `SDF-QA-${advId}-${ts}.csv`;
        bytes = strToU8(await qaCsv(user, tx, adv.id, base));
      }
      return { job, name, bytes };
    });
    const key = await putResult(ctx.sandboxId, out.job.id, out.name, out.bytes);
    await withSandbox(ctx.sandboxId, (tx) =>
      finishJob(tx, out.job.id, { status: 'COMPLETED', resultKind: 'FILE', resultStorageKey: key }),
    );
    return { data: { jobId: out.job.id } };
  });
}

const iso = (d: Date) => d.toISOString();

async function metadataCsv(
  tx: Parameters<Parameters<typeof withSandbox>[1]>[0],
  advertiserId: string,
  version: SdfVersion,
  o: LoadOpts,
): Promise<string> {
  const headers = ['Entity Type', 'Id', 'Name', 'Parent Type', 'Parent Id', 'Status', 'Serving State', 'Created', 'Last Updated', 'Archived', 'SDF Version'];
  const rows: string[][] = [];
  const row = (type: string, id: bigint, name: string, pType: string, pId: bigint | null, status: string, created: Date, updated: Date) =>
    rows.push([type, id.toString(), name, pType, pId?.toString() ?? '', status, status === 'ACTIVE' ? 'Serving' : 'Not serving', iso(created), iso(updated), status === 'ARCHIVED' ? 'TRUE' : 'FALSE', version]);
  const live = o.includeArchived ? {} : { status: { not: 'ARCHIVED' as const } };
  for (const c of await tx.campaign.findMany({ where: { advertiserId, ...live, ...(o.campaignIds ? { id: { in: o.campaignIds } } : {}) }, include: { advertiser: { select: { publicId: true } } }, orderBy: { publicId: 'asc' } }))
    row('Campaign', c.publicId, c.name, 'Advertiser', c.advertiser.publicId, c.status, c.createdAt, c.updatedAt);
  for (const i of await tx.insertionOrder.findMany({ where: { advertiserId, ...live, ...(o.ioIds ? { id: { in: o.ioIds } } : {}), ...(o.campaignIds ? { campaignId: { in: o.campaignIds } } : {}) }, include: { campaign: { select: { publicId: true } } }, orderBy: { publicId: 'asc' } }))
    row('Insertion order', i.publicId, i.name, 'Campaign', i.campaign.publicId, i.status, i.createdAt, i.updatedAt);
  const liWhere = { advertiserId, ...live, ...(o.liIds ? { id: { in: o.liIds } } : {}), ...(o.ioIds ? { ioId: { in: o.ioIds } } : {}), ...(o.campaignIds ? { campaignId: { in: o.campaignIds } } : {}) };
  const lis = await tx.lineItem.findMany({ where: liWhere, include: { io: { select: { publicId: true } } }, orderBy: { publicId: 'asc' } });
  for (const l of lis) row('Line item', l.publicId, l.name, 'Insertion order', l.io.publicId, l.status, l.createdAt, l.updatedAt);
  const groups = await tx.adGroup.findMany({ where: { advertiserId, ...live, lineItemId: { in: lis.map((l) => l.id) } }, include: { lineItem: { select: { publicId: true } }, ads: { where: live, orderBy: { publicId: 'asc' } } }, orderBy: { publicId: 'asc' } });
  for (const g of groups) {
    row('Ad group', g.publicId, g.name, 'Line item', g.lineItem.publicId, g.status, g.createdAt, g.updatedAt);
    for (const a of g.ads) row('Ad', a.publicId, a.name, 'Ad group', g.publicId, a.status, a.createdAt, a.updatedAt);
  }
  return writeCsv(headers, rows);
}

/** 4.5: one row per validation issue of every selected entity (errors and warnings), no state change. */
async function qaCsv(
  user: SessionUser,
  tx: Parameters<Parameters<typeof withSandbox>[1]>[0],
  advertiserId: string,
  o: LoadOpts,
): Promise<string> {
  const headers = ['Entity', 'Id', 'Name', 'Row Severity', 'Rule Id', 'Field', 'Message', 'Suggested Fix'];
  const rows: string[][] = [];
  const add = (entity: string, id: string, name: string, issues: { severity: string; code: string; path: string; message: string }[]) => {
    for (const i of issues)
      if (i.severity !== 'info')
        rows.push([entity, id, name, i.severity === 'error' ? 'Error' : 'Warning', i.code, i.path, i.message, `Review ${i.path || 'the entity'} and correct the value.`]);
  };
  const campaigns = await loadCampaignModels(tx, advertiserId, { ...o, includeArchived: false });
  const ios = await loadIoModels(tx, advertiserId, { ...o, includeArchived: false });
  const lis = await loadLiModels(tx, advertiserId, { ...o, includeArchived: false });
  // validators open their own read transactions; run them after the loads
  return await (async () => {
    for (const c of campaigns) {
      const res = await validateCampaign(user, advertiserId, { ...c.wire, status: c.wire.status === 'ARCHIVED' ? 'ACTIVE' : c.wire.status }, c.id).catch(() => []);
      add('Campaign', c.publicId, c.wire.name, res);
    }
    for (const io of ios) {
      const res = await validateInsertionOrder(user, io.campaignId, io.wire, io.id).catch(() => []);
      add('Insertion order', io.publicId, io.wire.name, res);
    }
    for (const li of lis) {
      const res = await validateLineItem(user, li.ioId, li.value, li.id).catch(() => []);
      add('Line item', li.publicId, li.value.name, res.map((i) => ({ severity: i.severity, code: i.ruleId, path: i.path, message: i.message })));
    }
    return writeCsv(headers, rows);
  })();
}
