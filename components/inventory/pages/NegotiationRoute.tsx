import { NegotiationPage } from '../NegotiationPage';
import { orNotFound } from '@/lib/creatives/page';
import { getNegotiation } from '@/lib/inventory/negotiations';
import { inventoryScope, type RouteParams } from '@/lib/inventory/page';
import { requireView } from '@/lib/scope/guard';

export async function NegotiationRoute({ params, negId }: { params: RouteParams; negId: string }) {
  const user = await requireView('RO');
  const scope = await inventoryScope(params);
  const view = await orNotFound(() => getNegotiation(user, scope.advertiserId, negId));
  return <NegotiationPage scope={scope} view={view} />;
}
