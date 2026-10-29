import { PackagesTab } from '../PackagesTab';
import { listPackages } from '@/lib/inventory/deals';
import { canWriteInventory } from '@/lib/inventory/guard';
import { inventoryScope, type RouteParams } from '@/lib/inventory/page';
import { orNotFound } from '@/lib/creatives/page';
import { requireView } from '@/lib/scope/guard';

export async function PackagesPage({ params }: { params: RouteParams }) {
  const user = await requireView('RO');
  const scope = await inventoryScope(params);
  const rows = await orNotFound(() => listPackages(user, scope.advertiserId, scope.campaignId));
  return <PackagesTab scope={scope} rows={rows} canWrite={canWriteInventory(user)} />;
}
