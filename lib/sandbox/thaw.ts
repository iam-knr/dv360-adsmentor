import 'server-only';
import type { PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/db';

/**
 * There are no class windows any more (ADM-FIX), but sandboxes that a closed window froze while windows existed are
 * still FROZEN with reason WINDOW, and nothing else would thaw them. The engine timer calls this; it is idempotent and
 * leaves sandboxes frozen for another reason (a disabled account) alone.
 */
export async function thawWindowFrozenSandboxes(
  now: Date = new Date(),
  db: PrismaClient = prisma,
): Promise<number> {
  const boxes = await db.sandbox.findMany({
    where: { kind: 'STUDENT', status: 'FROZEN', frozenReason: 'WINDOW' },
    select: {
      id: true,
      clockStateBeforeFreeze: true,
      clock: { select: { runOutsideSession: true } },
    },
    take: 200,
  });
  let thawed = 0;
  for (const sb of boxes) {
    await db.$transaction(async (tx) => {
      const res = await tx.sandbox.updateMany({
        where: { id: sb.id, status: 'FROZEN', frozenReason: 'WINDOW' },
        data: { status: 'ACTIVE', frozenAt: null, frozenReason: null, clockStateBeforeFreeze: null },
      });
      if (res.count && sb.clock) {
        await tx.simClock.update({
          where: { sandboxId: sb.id },
          data: {
            ...(sb.clock.runOutsideSession ? {} : { state: sb.clockStateBeforeFreeze ?? 'PAUSED' }),
            // frozen real time is not owed to the clock (engine.md 1.2)
            lastAdvanceRealAt: now,
            remainderMs: 0,
          },
        });
      }
      thawed += res.count;
    });
  }
  return thawed;
}
