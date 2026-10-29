import { PlansList } from '../PlansList';
import { orNotFound } from '@/lib/creatives/page';
import { canWriteInventory } from '@/lib/inventory/guard';
import { inventoryScope, type RouteParams } from '@/lib/inventory/page';
import { listPlans } from '@/lib/inventory/plans';
import { requireView } from '@/lib/scope/guard';

export async function PlansRoute({ params }: { params: RouteParams }) {
  const user = await requireView('RO');
  const scope = await inventoryScope(params);
  // the grid filters client side, so every plan is loaded once
  const rows = await orNotFound(() =>
    listPlans(user, scope.advertiserId, { status: ['PLANNED', 'TRAFFICKED'] }),
  );
  return <PlansList scope={scope} rows={rows} canWrite={canWriteInventory(user)} />;
}
