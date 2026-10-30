// Recommendation writer (module 11 4.9, T11-15): turns the engine's OPEN / CLOSE decisions into `Recommendation` rows.
// A condition that stops holding removes the row (also when dismissed); one that still holds keeps the row, so a
// dismissed suggestion is not created a second time.
import type { Tx } from '@/lib/db';
import { newId } from '@/lib/db';
import type { RecommendationDecision } from '@/lib/engine/diagnostics';
import { SUGGESTIONS, type SuggestionType } from './catalog';

const SCOPE = { LINE_ITEM: 'LINE_ITEM', INSERTION_ORDER: 'IO' } as const;

export async function persistRecommendations(
  tx: Tx,
  ctx: { sandboxId: string; advertiserId: string },
  decisions: readonly RecommendationDecision[],
  at: Date,
): Promise<number> {
  let rows = 0;
  for (const d of decisions) {
    const scopeType = SCOPE[d.scopeKind];
    const where = {
      sandboxId: ctx.sandboxId,
      advertiserId: ctx.advertiserId,
      scopeType,
      scopeId: d.scopeId,
      type: d.type,
    } as const;
    if (d.action === 'OPEN') {
      const exists = await tx.recommendation.findFirst({
        where: { ...where, status: { in: ['OPEN', 'DISMISSED'] } },
        select: { id: true },
      });
      if (exists) continue;
      await tx.recommendation.create({
        data: {
          id: newId(),
          ...where,
          title: SUGGESTIONS[d.type as SuggestionType].title,
          status: 'OPEN',
          createdAt: at,
          updatedAt: at,
        },
      });
      rows++;
    } else {
      const res = await tx.recommendation.deleteMany({
        where: { ...where, status: { in: ['OPEN', 'DISMISSED'] } },
      });
      rows += res.count;
    }
  }
  return rows;
}
