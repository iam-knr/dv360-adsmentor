import 'server-only';
// App picker options for the Mobile app and Connected TV conversion forms (Δ15-2: AppCatalog).
import { withSandbox } from '@/lib/db';
import type { SessionUser } from '@/lib/auth/types';
import { assertResourceRead, serviceCtx } from './kit';

const LABEL = { ANDROID: 'Android', IOS: 'iOS', CTV: 'CTV' } as const;

export async function listAppOptions(
  user: SessionUser,
): Promise<{ value: string; label: string; platform: string }[]> {
  const ctx = await serviceCtx(user);
  assertResourceRead(ctx);
  return withSandbox(ctx.sandboxId, async (tx) => {
    const apps = await tx.appCatalog.findMany({
      orderBy: [{ name: 'asc' }, { appId: 'asc' }],
      take: 400,
    });
    return apps.map((a) => ({
      value: a.appId,
      label: `${a.name} - ${LABEL[a.platform]} (${a.appId})`,
      platform: a.platform,
    }));
  });
}
