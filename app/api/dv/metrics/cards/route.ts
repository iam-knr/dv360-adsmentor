// GET /api/dv/metrics/cards?level=io&ids=a,b&d=LAST_7_DAYS[&cards=totalCost,avgPerformance][&currency=INR]: the
// built-in chart cards of the IO and LI lists (P3-09).
import { getChartCardDataTx } from '@/lib/metrics/grid-metrics';
import { handleMetrics } from '@/lib/metrics/handler';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return handleMetrics(request, async (tx, q) => ({
    range: q.range,
    today: q.today,
    cards: await getChartCardDataTx(tx, {
      level: q.level,
      ids: q.ids,
      range: q.range,
      sandboxId: q.sandboxId,
      today: q.today,
      cards: q.cards,
      currency: q.currency ?? undefined,
    }),
  }));
}
