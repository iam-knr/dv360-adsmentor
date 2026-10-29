import 'server-only';
// "Recently opened" log (module 01 4.2, DELTA-01-4). UI state: no change log (RC-031, UI_STATE_TABLES).
// One row per (user, entity), upserted; the 20 newest per (user, entity type) are kept.
import type { SessionUser } from '@/lib/auth/types';
import { withSandbox } from '@/lib/db';

export type RecentEntityType = 'ADVERTISER' | 'CAMPAIGN' | 'INSERTION_ORDER' | 'LINE_ITEM';
export const RECENT_KEEP = 20;

export async function logRecentlyOpened(
  user: Pick<SessionUser, 'id' | 'sandboxId' | 'viewAs'>,
  input: { entityType: RecentEntityType; entityId: string; partnerId: string },
  now: Date = new Date(),
): Promise<void> {
  // An instructor looking through view-as does not change the student's list.
  if (!user.sandboxId || user.viewAs) return;
  const { entityType, entityId, partnerId } = input;
  await withSandbox(user.sandboxId, async (tx) => {
    const sandboxId = user.sandboxId ?? '';
    await tx.recentlyViewed.upsert({
      where: {
        sandboxId_userId_entityType_entityId: { sandboxId, userId: user.id, entityType, entityId },
      },
      create: { sandboxId, userId: user.id, partnerId, entityType, entityId, viewedAt: now },
      update: { viewedAt: now, partnerId },
    });
    const old = await tx.recentlyViewed.findMany({
      where: { sandboxId, userId: user.id, entityType },
      orderBy: { viewedAt: 'desc' },
      skip: RECENT_KEEP,
      select: { id: true },
    });
    if (old.length)
      await tx.recentlyViewed.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
  });
}

/** Fire and forget: logging must never block or break a page (module 01 4.2). */
export function logRecentlyOpenedSafe(
  user: Parameters<typeof logRecentlyOpened>[0],
  input: Parameters<typeof logRecentlyOpened>[1],
): Promise<void> {
  return logRecentlyOpened(user, input).catch((e: unknown) => {
    console.error('logRecentlyOpened failed', e);
  });
}
