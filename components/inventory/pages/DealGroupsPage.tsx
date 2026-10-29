import { DealGroupsTab, type GroupCandidate } from '../DealGroupsTab';
import { listDealGroups, listOrdersDeals, listPackages } from '@/lib/inventory/deals';
import { canWriteInventory } from '@/lib/inventory/guard';
import { inventoryScope, type RouteParams } from '@/lib/inventory/page';
import { orNotFound } from '@/lib/creatives/page';
import { requireView } from '@/lib/scope/guard';

export async function DealGroupsPage({ params }: { params: RouteParams }) {
  const user = await requireView('RO');
  const scope = await inventoryScope(params);
  const [rows, deals, packages] = await orNotFound(() =>
    Promise.all([
      listDealGroups(user, scope.advertiserId),
      listOrdersDeals(user, scope.advertiserId, { status: ['ACTIVE', 'PAUSED', 'DRAFT'] }),
      listPackages(user, scope.advertiserId),
    ]),
  );
  const flat = [...deals.actionRequired, ...deals.rest.flatMap((r) => (r.kind === 'ORDER' ? r.children : [r]))];
  const candidates: GroupCandidate[] = [
    ...flat.map((d) => ({ kind: 'DEAL' as const, id: d.id, name: d.name })),
    ...packages.map((p) => ({ kind: 'PACKAGE' as const, id: p.id, name: p.name })),
  ];
  return <DealGroupsTab scope={scope} rows={rows} candidates={candidates} canWrite={canWriteInventory(user)} />;
}
