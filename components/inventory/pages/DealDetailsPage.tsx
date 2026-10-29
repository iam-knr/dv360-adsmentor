import { DealPage } from '../DealPage';
import { getDeal, getDealHistory, getDealLineItems } from '@/lib/inventory/deals';
import { canWriteInventory } from '@/lib/inventory/guard';
import { inventoryScope, type RouteParams } from '@/lib/inventory/page';
import type { DealTab } from '@/lib/inventory/paths';
import { orNotFound } from '@/lib/creatives/page';
import { requireView } from '@/lib/scope/guard';

const TABS: DealTab[] = ['overviewTab', 'accessTab', 'settingsTab', 'historyTab'];

export async function DealDetailsPage({
  params,
  tid,
  search,
}: {
  params: RouteParams;
  tid: string;
  search: { activeTab?: string; page?: string; user?: string; field?: string };
}) {
  const user = await requireView('RO');
  const scope = await inventoryScope(params);
  const tab = TABS.find((t) => t === search.activeTab) ?? 'overviewTab';
  const page = Math.max(1, Number(search.page) || 1);
  const [deal, lineItems, history] = await orNotFound(() =>
    Promise.all([
      getDeal(user, scope.advertiserId, tid, scope.campaignId),
      getDealLineItems(user, scope.advertiserId, tid, scope.partnerId),
      tab === 'historyTab'
        ? getDealHistory(user, scope.advertiserId, tid, {
            page,
            pageSize: 25,
            ...(search.user ? { user: search.user } : {}),
            ...(search.field ? { field: search.field } : {}),
          })
        : Promise.resolve({ rows: [], total: 0, page: 1, pageSize: 25 }),
    ]),
  );
  return (
    <DealPage
      scope={scope}
      deal={deal}
      lineItems={lineItems}
      tab={tab}
      canWrite={canWriteInventory(user)}
      history={{
        ...history,
        initialFilters: [
          ...(search.user ? [{ fieldId: 'user', values: [search.user] }] : []),
          ...(search.field ? [{ fieldId: 'field', values: [search.field] }] : []),
        ],
      }}
    />
  );
}
