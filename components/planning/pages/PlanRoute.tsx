import { PlanPage } from '../PlanPage';
import { FormFrame } from '@/components/shell/Frames';
import { orNotFound } from '@/lib/creatives/page';
import { inventoryScope } from '@/lib/inventory/page';
import { getPlan, getPlanColumns } from '@/lib/planning/service';
import { requireView } from '@/lib/scope/guard';

export async function PlanRoute({
  params,
}: {
  params: { partnerId: string; advertiserId: string; planId: string };
}) {
  const user = await requireView('RO');
  const scope = await inventoryScope(params);
  const [plan, columns] = await orNotFound(() =>
    Promise.all([
      getPlan(user, scope.advertiserId, params.planId),
      getPlanColumns(user, scope.advertiserId),
    ]),
  );
  return (
    <FormFrame title="Adjust your plan and view forecast" wide>
      <PlanPage
        key={plan.id}
        partnerId={scope.partnerId}
        advertiserId={scope.advertiserId}
        initial={plan}
        columns={columns}
      />
    </FormFrame>
  );
}
