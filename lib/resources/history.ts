import 'server-only';
// Floodlight History tab (module 15 S3): change groups of the Floodlight group and its conversions. The shared
// History UI is module 05 (P4-12); until it lands this tab lists the groups with their entries.
import type { SessionUser } from '@/lib/auth/types';
import { withSandbox } from '@/lib/db';
import { assertResourceRead, loadAdvertiser, serviceCtx } from './kit';

export interface FloodlightHistoryRow {
  id: string;
  when: string;
  who: string;
  entity: string;
  name: string;
  summary: string;
  entries: { label: string; oldValue: string | null; newValue: string | null }[];
}

export async function listFloodlightHistory(
  user: SessionUser,
  aid: string,
): Promise<FloodlightHistoryRow[]> {
  const ctx = await serviceCtx(user);
  assertResourceRead(ctx);
  return withSandbox(ctx.sandboxId, async (tx) => {
    const adv = await loadAdvertiser(tx, aid);
    const groups = await tx.changeGroup.findMany({
      where: {
        advertiserId: adv.id,
        entityType: { in: ['FLOODLIGHT_GROUP', 'FLOODLIGHT_ACTIVITY'] },
        isHidden: false,
      },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      take: 100,
      include: { entries: { orderBy: { sortOrder: 'asc' }, take: 20 } },
    });
    return groups.map((g) => ({
      id: g.id,
      when: g.occurredAt.toISOString(),
      who: g.actorLabel ?? 'System',
      entity: g.entityType === 'FLOODLIGHT_GROUP' ? 'Floodlight group' : 'Floodlight conversion',
      name: g.entityName ?? '',
      summary: g.summary,
      entries: g.entries.map((e) => ({
        label: e.label,
        oldValue: e.oldValue,
        newValue: e.newValue,
      })),
    }));
  });
}
