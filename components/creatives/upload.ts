// Browser side of the upload flow (module 12 4.3): one POST per file to the creative upload route, which stores the
// bytes and returns an upload id plus what the bytes say about themselves.
import type { UploadResult } from '@/lib/creatives/service';

export type UploadedFile = UploadResult;

export async function uploadFile(
  file: File,
): Promise<{ ok: true; file: UploadedFile } | { ok: false; message: string }> {
  const res = await fetch('/api/dv/creatives/uploads', {
    method: 'POST',
    headers: {
      'x-file-name': encodeURIComponent(file.name),
      'content-type': file.type || 'application/octet-stream',
    },
    body: file,
  });
  const body = (await res.json().catch(() => null)) as {
    data?: UploadedFile;
    issues?: { message: string }[];
  } | null;
  if (!res.ok || !body?.data)
    return { ok: false, message: body?.issues?.[0]?.message ?? 'The upload failed.' };
  return { ok: true, file: body.data };
}
