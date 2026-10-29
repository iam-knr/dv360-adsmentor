// SimState rows: the core's memory between ticks, one JSON document per advertiser (engine.md 1.7).
import type { Prisma } from '@prisma/client';
import type { Tx } from '@/lib/db';
import { newId } from '@/lib/db';
import { newSimState, type SimStateData } from '../state';

export const STATE_SCOPE = 'ADVERTISER';

/** The saved state of each advertiser, or a fresh one that starts at `startTick` (the clock's tick index). */
export async function loadStates(
  tx: Tx,
  sandboxId: string,
  advertiserIds: readonly string[],
  startTick: number,
): Promise<Map<string, SimStateData>> {
  const rows = await tx.simState.findMany({ where: { sandboxId, scope: STATE_SCOPE } });
  const byId = new Map(rows.map((r) => [r.entityId, r]));
  const out = new Map<string, SimStateData>();
  for (const id of advertiserIds) {
    const row = byId.get(id);
    if (row) {
      out.set(id, JSON.parse(row.data as string) as SimStateData);
    } else {
      const s = newSimState();
      s.nextTick = startTick;
      out.set(id, s);
    }
  }
  return out;
}

export async function saveStates(
  tx: Tx,
  sandboxId: string,
  states: ReadonlyMap<string, SimStateData>,
): Promise<void> {
  for (const [entityId, s] of states) {
    // A JSON string, not a JSON object: reading a jsonb object back through Prisma keeps only 15 significant digits,
    // which would make a state that was saved and reloaded differ from one that stayed in memory (engine.md 11.1).
    const data = JSON.stringify(s) as Prisma.InputJsonValue;
    await tx.simState.upsert({
      where: { sandboxId_scope_entityId: { sandboxId, scope: STATE_SCOPE, entityId } },
      create: {
        id: newId(),
        sandboxId,
        scope: STATE_SCOPE,
        entityId,
        nextTick: BigInt(s.nextTick),
        data,
      },
      update: { nextTick: BigInt(s.nextTick), data, updatedAt: new Date() },
    });
  }
}
