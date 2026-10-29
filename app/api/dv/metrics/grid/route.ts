// GET /api/dv/metrics/grid?level=io&ids=a,b&d=LAST_7_DAYS[&currency=INR]: Performance columns and the totals row of a
// list page (P3-09). Used by client refresh and by tests.
import { getGridMetricsTx, getTotalsTx, totalsOf } from '@/lib/metrics/grid-metrics';
import { handleMetrics } from '@/lib/metrics/handler';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return handleMetrics(request, async (tx, q) => {
    const args = { level: q.level, ids: q.ids, range: q.range, sandboxId: q.sandboxId };
    const rows = await getGridMetricsTx(tx, { ...args, currency: q.currency ?? undefined });
    const list = Object.values(rows);
    const mixed = new Set(list.map((r) => r.currency)).size > 1;
    // Rows in several currencies (advertisers of one partner): the footer converts to the partner currency
    const totals = mixed
      ? await getTotalsTx(tx, { ...args, currency: q.partnerCurrency ?? 'USD' })
      : totalsOf(q.level, list, list[0]?.currency ?? q.currency ?? q.partnerCurrency ?? 'INR');
    return { range: q.range, today: q.today, rows, totals };
  });
}
