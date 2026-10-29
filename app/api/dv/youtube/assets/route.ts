// POST /api/dv/youtube/assets   multipart: file, role (LOGO | COMPANION), adGroupId (module 09 Y18)
import { getSessionUser } from '@/lib/auth/session';
import { badRequest, respond, unauthenticated } from '@/lib/youtube/api';
import { uploadAdAsset } from '@/lib/youtube/service';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthenticated();
  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  const role = form?.get('role');
  const adGroupId = form?.get('adGroupId');
  if (
    !(file instanceof File) ||
    (role !== 'LOGO' && role !== 'COMPANION') ||
    typeof adGroupId !== 'string'
  )
    return badRequest('file, role (LOGO or COMPANION) and adGroupId are required.');
  return respond(
    await uploadAdAsset(user, {
      adGroupId,
      role,
      fileName: file.name,
      mimeType: file.type,
      bytes: new Uint8Array(await file.arrayBuffer()),
    }),
    201,
  );
}
