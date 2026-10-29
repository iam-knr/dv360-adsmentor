// YouTube structural sync of the tick (module 09 T09-08): ad review decisions (Δ-09-8) and the alerts
// `YT_AD_REJECTED` and `AD_GROUP_NOT_RUNNING` (ENG 3.7). Runs after the creative review sync in the same transaction.
import type { Tx } from '@/lib/db';
import { settleDueAdReviews, syncYoutubeAlerts, type SyncCtx } from '@/lib/youtube/review-sync';

export async function syncYoutube(
  tx: Tx,
  ctx: SyncCtx,
  simNowMs: number,
): Promise<{ decided: number; raised: string[] }> {
  const decided = await settleDueAdReviews(tx, ctx, simNowMs);
  const raised = await syncYoutubeAlerts(tx, ctx, simNowMs);
  return { decided, raised };
}
