// Report file storage (module 16 4.4): Blob when configured, memory otherwise. Keys `reports/{sandboxId}/{runId}.{ext}`.
import { fileStore } from '@/lib/creatives/storage';
import { CONTENT_TYPE } from './names';
import type { ReportFormatWire } from '../types';

export const extOf = (f: ReportFormatWire) => (f === 'XLSX' ? 'xlsx' : 'csv');

export async function putReportFile(
  keyBase: string,
  format: ReportFormatWire,
  bytes: Uint8Array,
): Promise<void> {
  await fileStore().put(`${keyBase}.${extOf(format)}`, bytes, CONTENT_TYPE[format]);
}

export async function getReportFile(
  keyBase: string,
  format: ReportFormatWire,
): Promise<Uint8Array | null> {
  return (await fileStore().get(`${keyBase}.${extOf(format)}`))?.bytes ?? null;
}
