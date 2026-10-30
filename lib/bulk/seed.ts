// Seed data of module 11 (3.4): bulk job history, saved column views and saved chart views per sandbox.
// Relative imports only: prisma/seed runs under tsx. Rows have fixed ids per sandbox, so a re-run is a no-op.
import type { Prisma } from '@prisma/client';

export interface BulkSeedInput {
  sandboxId: string;
  ownerUserId?: string | null | undefined;
  ownerName?: string | undefined;
  /** Sim "now" for the Requested column. */
  now?: Date | undefined;
}

const JOBS: {
  source: 'DUPLICATION' | 'BULK_EDIT' | 'CAMPAIGN_DOWNLOAD' | 'SDF_DOWNLOAD' | 'SDF_UPLOAD';
  action: 'ACTIVATE' | 'PAUSE' | 'ARCHIVE' | 'DUPLICATE' | 'EDIT_SETTINGS' | 'DOWNLOAD_SDF' | 'DOWNLOAD_QA' | 'DOWNLOAD_METADATA' | 'UPLOAD_SDF' | 'UNARCHIVE';
  description: string;
  status: 'COMPLETED' | 'FAILED';
  n: number;
  error?: string;
}[] = [
  { source: 'BULK_EDIT', action: 'PAUSE', description: 'Status edited on 3 line items', status: 'COMPLETED', n: 3 },
  { source: 'BULK_EDIT', action: 'ACTIVATE', description: 'Status edited on 2 insertion orders', status: 'COMPLETED', n: 2 },
  { source: 'BULK_EDIT', action: 'ARCHIVE', description: 'Archiving 1 campaign', status: 'COMPLETED', n: 1 },
  { source: 'BULK_EDIT', action: 'UNARCHIVE', description: 'Unarchiving 1 campaign', status: 'COMPLETED', n: 1 },
  { source: 'BULK_EDIT', action: 'EDIT_SETTINGS', description: 'Bulk edit of 4 line items', status: 'COMPLETED', n: 4, error: '1 of 4 items failed' },
  { source: 'DUPLICATION', action: 'DUPLICATE', description: 'Duplicating 1 line item with 2 copies to insertion order 0', status: 'COMPLETED', n: 1 },
  { source: 'CAMPAIGN_DOWNLOAD', action: 'DOWNLOAD_METADATA', description: 'Download spreadsheet of campaign 0', status: 'COMPLETED', n: 0 },
  { source: 'SDF_DOWNLOAD', action: 'DOWNLOAD_SDF', description: 'SDF download: Campaigns, Insertion orders, Line items', status: 'COMPLETED', n: 0 },
  { source: 'SDF_DOWNLOAD', action: 'DOWNLOAD_QA', description: 'SDF QA download for advertiser 0', status: 'COMPLETED', n: 0 },
  { source: 'SDF_UPLOAD', action: 'UPLOAD_SDF', description: 'SDF upload: SDF-LineItems.csv', status: 'COMPLETED', n: 1, error: '2 of 12 items failed' },
  { source: 'SDF_UPLOAD', action: 'UPLOAD_SDF', description: 'SDF upload: SDF-Campaigns.csv', status: 'FAILED', n: 1, error: "The columns in this file don't match SDF version 11." },
  { source: 'BULK_EDIT', action: 'PAUSE', description: 'Status edited on 5 campaigns', status: 'COMPLETED', n: 5 },
];

export async function seedBulk(tx: Prisma.TransactionClient, input: BulkSeedInput): Promise<{ jobs: number; views: number; charts: number }> {
  const adv = await tx.advertiser.findFirst({ where: { sandboxId: input.sandboxId }, orderBy: { publicId: 'asc' }, select: { id: true, partnerId: true, publicId: true } });
  if (!adv) return { jobs: 0, views: 0, charts: 0 };
  const owner = input.ownerUserId ?? '';
  const now = (input.now ?? new Date()).getTime();
  let jobs = 0;
  if (await tx.bulkJob.count({ where: { sandboxId: input.sandboxId } }) === 0) {
    for (const [i, j] of JOBS.entries()) {
      const at = new Date(now - (i + 1) * 3_600_000 * 5);
      await tx.bulkJob.create({
        data: {
          sandboxId: input.sandboxId,
          advertiserId: adv.id,
          partnerId: adv.partnerId,
          requestedById: owner,
          source: j.source,
          action: j.action,
          description: j.description.replace(/ 0$/, ` ${adv.publicId}`).replace('campaign 0', `campaign ${adv.publicId}`).replace('advertiser 0', `advertiser ${adv.publicId}`),
          status: j.status,
          requestedAt: at,
          selectionCount: j.n,
          errorSummary: j.error ?? null,
          payload: { requestedBy: input.ownerName ?? 'Student' },
        },
      });
      jobs += 1;
    }
  }
  let views = 0;
  if ((await tx.savedView.count({ where: { sandboxId: input.sandboxId } })) === 0 && owner) {
    const defs: { grid: 'CAMPAIGN' | 'IO' | 'LI'; name: string; order: string[] }[] = [
      { grid: 'LI', name: 'Delivery check', order: ['name', 'id', 'type', 'impressions', 'clicks', 'revenue'] },
      { grid: 'LI', name: 'Budget and goal', order: ['name', 'id', 'budget', 'goal'] },
    ];
    for (const d of defs) {
      await tx.savedView.create({ data: { sandboxId: input.sandboxId, advertiserId: adv.id, ownerUserId: owner, grid: d.grid, name: d.name, columns: { order: d.order } } });
      views += 1;
    }
  }
  let charts = 0;
  const campaign = await tx.campaign.findFirst({ where: { sandboxId: input.sandboxId, advertiserId: adv.id }, orderBy: { publicId: 'asc' }, select: { id: true } });
  if (campaign && owner && (await tx.chartCard.count({ where: { sandboxId: input.sandboxId } })) === 0) {
    const cards = [
      { kind: 'BAR' as const, title: 'Daily Revenue Trend', metrics: { y: 'REVENUE' }, dimension: 'DATE' },
      { kind: 'LINE' as const, title: 'CTR Trend', metrics: { y: 'CTR' }, dimension: 'DATE' },
    ];
    for (const [i, c] of cards.entries()) {
      await tx.chartCard.create({
        data: {
          sandboxId: input.sandboxId, advertiserId: adv.id, ownerUserId: owner, scope: 'CAMPAIGN', scopeId: campaign.id,
          kind: c.kind, viewKey: 'default', definition: { id: `seed${i}`, ...c, ordinal: i }, ordinal: i,
        },
      });
      charts += 1;
    }
  }
  return { jobs, views, charts };
}
