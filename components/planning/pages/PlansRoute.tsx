import { PlansList } from '../PlansList';
import { orNotFound } from '@/lib/creatives/page';
import { inventoryScope, type RouteParams } from '@/lib/inventory/page';
import { listPlans } from '@/lib/planning/service';
import { requireView } from '@/lib/scope/guard';

export async function PlansRoute({ params }: { params: RouteParams }) {
  const user = await requireView('RO');
  const scope = await inventoryScope(params);
  const initial = await orNotFound(() => listPlans(user, scope.advertiserId));
  return (
    <PlansList partnerId={scope.partnerId} advertiserId={scope.advertiserId} initial={initial} />
  );
}
