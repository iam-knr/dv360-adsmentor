import 'server-only';
// Bulk add creatives (module 12 S8, 4.3, CRE-050): template download, CSV (and optional ZIP of assets) upload,
// one BulkJob, one creative per valid row, a result CSV with the rule ID of every failed row.
import { unzipSync } from 'fflate';
import type { SessionUser } from '@/lib/auth/types';
import { asResult, invalid, notFound, type Result } from '@/lib/campaigns/service-kit';
import { validate } from '@/lib/validation/engine';
import type { CreativeAssetInput } from '@/lib/validation/types';
import {
  BULK_KIND_LABEL,
  parseBulkCsv,
  resultCsv,
  type BulkCreativeKind,
  type BulkResultRow,
} from './bulk-csv';
import { loadAdvertiser, readCtx, validationContext, writeCtx } from './guard';
import { extOf } from './limits';
import { html5Info, imageDimensions, mp4Duration, sniffType } from './media';
import { insertCreative } from './service';
import { fileStore } from './storage';
import type { BulkResponse } from './types';

const TYPE_BY_EXT: Record<string, string> = {
  png: 'image/png',
  gif: 'image/gif',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  zip: 'application/zip',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  mp3: 'audio/mpeg',
  ogg: 'audio/ogg',
};

export const BULK_RESULT_FILE = 'Creative-bulk-result.csv';

/** Result file of a bulk add job, or null when the job is not this sandbox's. */
export async function readBulkResult(user: SessionUser, jobId: string): Promise<Uint8Array | null> {
  return readCtx(user, async (tx) => {
    const job = await tx.bulkJob.findUnique({
      where: { id: jobId },
      select: { resultStorageKey: true },
    });
    if (!job?.resultStorageKey) return null;
    return (await fileStore().get(job.resultStorageKey))?.bytes ?? null;
  });
}

export async function bulkAddCreatives(
  user: SessionUser,
  aid: string,
  req: { kind: BulkCreativeKind; csvUploadId: string; assetsZipUploadId?: string },
): Promise<Result<BulkResponse & { resultFile: string | null }>> {
  return asResult(() =>
    writeCtx(user, async (tx, ctx) => {
      const adv = await loadAdvertiser(tx, aid);
      const actor = ctx.user.actor ?? ctx.user;
      const uploadBytes = async (id: string): Promise<Uint8Array> => {
        const up = await tx.upload.findFirst({
          where: { id, createdById: actor.id, status: 'READY' },
        });
        const file = up ? await fileStore().get(up.storageKey) : null;
        if (!file) throw notFound();
        return file.bytes;
      };
      const csv = new TextDecoder().decode(await uploadBytes(req.csvUploadId));
      // assets of the optional ZIP, stored once, shared by every row that names them
      const files = new Map<string, CreativeAssetInput>();
      const keys = new Map<string, string>();
      if (req.assetsZipUploadId) {
        let entries: Record<string, Uint8Array>;
        try {
          entries = unzipSync(await uploadBytes(req.assetsZipUploadId));
        } catch {
          throw invalid([
            {
              ruleId: 'CRE-050',
              severity: 'error',
              path: 'assets',
              message: 'The ZIP file could not be read.',
              blocking: true,
            },
          ]);
        }
        for (const [path, bytes] of Object.entries(entries)) {
          const fileName = path.split('/').pop() ?? path;
          if (!fileName || path.endsWith('/') || fileName.startsWith('.')) continue;
          const mimeType =
            sniffType(bytes) ?? TYPE_BY_EXT[extOf(fileName)] ?? 'application/octet-stream';
          const image = mimeType.startsWith('image/') ? imageDimensions(bytes) : null;
          const html5 = mimeType === 'application/zip' ? html5Info(bytes) : null;
          const key = `creatives/${ctx.sandboxId}/bulk/${fileName}`;
          await fileStore().put(key, bytes, mimeType);
          keys.set(fileName.toLowerCase(), key);
          files.set(fileName.toLowerCase(), {
            fileName,
            mimeType,
            sizeBytes: bytes.byteLength,
            width: image?.width ?? html5?.size?.width ?? null,
            height: image?.height ?? html5?.size?.height ?? null,
            durationSeconds: /^(video|audio)\//.test(mimeType) ? mp4Duration(bytes) : null,
            ...(html5 ? { entryHtml: html5.entryHtml } : {}),
          });
        }
      }
      const parsed = parseBulkCsv(req.kind, csv, files);
      if (!parsed.ok)
        throw invalid([
          {
            ruleId: 'CRE-050',
            severity: 'error',
            path: 'file',
            message: parsed.message,
            blocking: true,
          },
        ]);
      const n = parsed.rows.length;
      const job = await tx.bulkJob.create({
        data: {
          sandboxId: ctx.sandboxId,
          advertiserId: adv.id,
          partnerId: adv.partnerId,
          requestedById: actor.id,
          source: 'CREATIVE_BULK_ADD',
          action: 'UPLOAD_CREATIVES',
          description: `Adding ${n} ${BULK_KIND_LABEL[req.kind].toLowerCase()} ${n === 1 ? 'creative' : 'creatives'}`,
          status: 'RUNNING',
          selectionCount: n,
        },
        select: { id: true },
      });
      const results: BulkResultRow[] = [];
      const errors: BulkResponse['errors'] = [];
      for (const row of parsed.rows) {
        const issues = validate('creative', row.input, validationContext(ctx, adv, 'create'));
        const first = issues.find((i) => i.blocking);
        if (first) {
          results.push({
            rowNumber: row.rowNumber,
            name: row.input.name,
            status: 'FAILED',
            ruleId: first.ruleId,
            message: first.message,
          });
          errors.push({ id: String(row.rowNumber), message: `${first.ruleId}: ${first.message}` });
          await tx.bulkJobItem.create({
            data: {
              sandboxId: ctx.sandboxId,
              jobId: job.id,
              entityType: 'CREATIVE',
              status: 'FAILED',
              message: first.message,
              rowNumber: row.rowNumber,
              ruleId: first.ruleId,
              field: first.path,
            },
          });
          continue;
        }
        const key = (a: CreativeAssetInput | null | undefined) =>
          a ? (keys.get(a.fileName.toLowerCase()) ?? null) : null;
        const created = await insertCreative(
          tx,
          ctx,
          adv,
          row.input,
          { main: key(row.input.mainAsset), logo: key(row.input.logoAsset) },
          { source: 'BULK_EDIT', bulkJobId: job.id },
        );
        results.push({ rowNumber: row.rowNumber, name: row.input.name, status: 'OK' });
        await tx.bulkJobItem.create({
          data: {
            sandboxId: ctx.sandboxId,
            jobId: job.id,
            entityType: 'CREATIVE',
            entityId: created.id,
            status: 'OK',
            rowNumber: row.rowNumber,
          },
        });
      }
      const resultKey = `creatives/${ctx.sandboxId}/bulk-results/${job.id}/${BULK_RESULT_FILE}`;
      await fileStore().put(resultKey, new TextEncoder().encode(resultCsv(results)), 'text/csv');
      await tx.bulkJob.update({
        where: { id: job.id },
        data: {
          status: 'COMPLETED',
          resultKind: 'FILE',
          resultStorageKey: resultKey,
          ...(errors.length ? { errorSummary: `${errors.length} of ${n} rows failed` } : {}),
        },
      });
      return {
        data: {
          jobId: job.id,
          done: n - errors.length,
          failed: errors.length,
          errors,
          resultFile: errors.length ? job.id : null,
        },
      };
    }),
  );
}
