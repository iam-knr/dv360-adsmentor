import { DiscoverPage } from '../DiscoverPage';
import { orNotFound } from '@/lib/creatives/page';
import { canWriteInventory } from '@/lib/inventory/guard';
import { discover } from '@/lib/inventory/marketplace';
import { inventoryScope, type RouteParams } from '@/lib/inventory/page';
import { requireView } from '@/lib/scope/guard';

export async function DiscoverRoute({ params }: { params: RouteParams }) {
  const user = await requireView('RO');
  const scope = await inventoryScope(params);
  const initial = await orNotFound(() =>
    discover(user, scope.advertiserId, { mode: 'KEYWORD', query: '', filters: {} }),
  );
  return <DiscoverPage scope={scope} initial={initial} canWrite={canWriteInventory(user)} />;
}
