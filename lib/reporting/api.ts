import 'server-only';
// Route-handler plumbing of module 16 (routes.md 8.13): Result to HTTP, file responses.
import { ServiceFailure } from '@/lib/campaigns/service-kit';
import { json } from '@/lib/line-items/api';
import type { DownloadFile } from './service';

export { badRequest, json, unauthenticated } from '@/lib/line-items/api';
export { readResponse, resultToHttp } from '@/lib/creatives/api';

const STATUS = { FORBIDDEN: 403, NOT_FOUND: 404, CONFLICT: 409, INVALID: 422 } as const;

/** A file download; a `ServiceFailure` becomes its status. */
export async function fileResponse(fn: () => Promise<DownloadFile>): Promise<Response> {
  try {
    const f = await fn();
    return new Response(f.bytes as BodyInit, {
      headers: {
        'Content-Type': f.contentType,
        'Content-Disposition': `attachment; filename="${f.fileName}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (e) {
    if (e instanceof ServiceFailure)
      return json({ error: e.code, issues: e.issues }, STATUS[e.code]);
    throw e;
  }
}
