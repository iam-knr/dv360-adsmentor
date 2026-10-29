// POST /api/dv/creatives/uploads  raw body, headers x-file-name and content-type   (module 12 4.3 upload flow)
// The bytes go to the file store (memory until the Blob store of owner item P-08 exists) and an `Upload` row is
// recorded; the client then names the upload id in the create call. Size and type are read back from the row.
import { getSessionUser } from '@/lib/auth/session';
import { badRequest, resultToHttp, unauthenticated } from '@/lib/creatives/api';
import { createUpload } from '@/lib/creatives/service';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthenticated();
  const fileName = decodeURIComponent(req.headers.get('x-file-name') ?? '');
  if (!fileName) return badRequest('x-file-name is required.');
  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.byteLength === 0) return badRequest('The file is empty.');
  return resultToHttp(
    await createUpload(user, {
      fileName,
      bytes,
      contentType: req.headers.get('content-type') ?? 'application/octet-stream',
    }),
    201,
  );
}
