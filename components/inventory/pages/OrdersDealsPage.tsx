import { OrdersDealsGrid } from '../OrdersDealsGrid';
import { DEFAULT_DEAL_STATUSES } from '@/lib/inventory/transitions';
import { listOrdersDeals } from '@/lib/inventory/deals';
import { inventoryScope, type RouteParams } from '@/lib/inventory/page';
import { orNotFound } from '@/lib/creatives/page';
import { requireView } from '@/lib/scope/guard';

export async function OrdersDealsPage({ params }: { params: RouteParams }) {
  const user = await requireView('RO');
  const scope = await inventoryScope(params);
  const initial = await orNotFound(() =>
    listOrdersDeals(user, scope.advertiserId, {
      status: DEFAULT_DEAL_STATUSES,
      ...(scope.campaignId ? { campaignId: scope.campaignId } : {}),
    }),
  );
  return <OrdersDealsGrid scope={scope} initial={initial} />;
}
