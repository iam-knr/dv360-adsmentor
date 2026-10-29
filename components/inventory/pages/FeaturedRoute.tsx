import { FeaturedPage } from '../FeaturedPage';
import { orNotFound } from '@/lib/creatives/page';
import { canWriteInventory } from '@/lib/inventory/guard';
import { getFeatured } from '@/lib/inventory/marketplace';
import { inventoryScope, type RouteParams } from '@/lib/inventory/page';
import { requireView } from '@/lib/scope/guard';

export async function FeaturedRoute({ params }: { params: RouteParams }) {
  const user = await requireView('RO');
  const scope = await inventoryScope(params);
  const view = await orNotFound(() => getFeatured(user, scope.advertiserId));
  return <FeaturedPage scope={scope} view={view} canWrite={canWriteInventory(user)} />;
}
