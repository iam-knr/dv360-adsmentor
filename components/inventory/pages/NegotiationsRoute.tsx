import { NegotiationsList } from '../NegotiationsList';
import { orNotFound } from '@/lib/creatives/page';
import { listNegotiations } from '@/lib/inventory/negotiations';
import { inventoryScope, type RouteParams } from '@/lib/inventory/page';
import { resolveAdvertiser } from '@/lib/scope/resolve';
import { requireView } from '@/lib/scope/guard';

export async function NegotiationsRoute({ params }: { params: RouteParams }) {
  const user = await requireView('RO');
  const scope = await inventoryScope(params);
  const [initial, chain] = await orNotFound(() =>
    Promise.all([
      listNegotiations(user, scope.advertiserId),
      resolveAdvertiser(params.partnerId, params.advertiserId),
    ]),
  );
  return (
    <NegotiationsList
      scope={scope}
      initial={initial}
      currencyCode={chain?.advertiser.currencyCode ?? 'INR'}
    />
  );
}
