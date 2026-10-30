// POST /api/dv/sdf/upload (module 11 K12): multipart form with `advertiserId` and one or more CSV `files`.
import { getSessionUser } from '@/lib/auth/session';
import { badRequest, respond, unauthenticated } from '@/lib/bulk/api';
import { requestSdfUpload } from '@/lib/sdf/upload';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthenticated();
  const form = await req.formData().catch(() => null);
  const advertiserId = form?.get('advertiserId');
  if (!form || typeof advertiserId !== 'string' || !advertiserId) return badRequest('advertiserId is required.');
  const files: { name: string; text: string }[] = [];
  for (const f of form.getAll('files')) if (f instanceof File) files.push({ name: f.name, text: await f.text() });
  return respond(await requestSdfUpload(user, { advertiserId, files }));
}
