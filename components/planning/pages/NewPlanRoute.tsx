import { NewPlanWizard } from '../NewPlanWizard';
import { FormFrame } from '@/components/shell/Frames';
import { orNotFound } from '@/lib/creatives/page';
import { inventoryScope, type RouteParams } from '@/lib/inventory/page';
import { getNewPlanDefaults } from '@/lib/planning/service';
import { requireView } from '@/lib/scope/guard';

export async function NewPlanRoute({ params }: { params: RouteParams }) {
  const user = await requireView('STD');
  const scope = await inventoryScope(params);
  const defaults = await orNotFound(() => getNewPlanDefaults(user, scope.advertiserId));
  return (
    <FormFrame title="New plan" wide>
      <NewPlanWizard
        partnerId={scope.partnerId}
        advertiserId={scope.advertiserId}
        defaults={defaults}
      />
    </FormFrame>
  );
}
