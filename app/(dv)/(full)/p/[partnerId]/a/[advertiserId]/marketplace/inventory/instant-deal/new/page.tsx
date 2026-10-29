import { InstantDealForm } from '@/components/inventory/InstantDealForm';
import { FormFrame } from '@/components/shell/Frames';
import { orNotFound } from '@/lib/creatives/page';
import { getInstantContext } from '@/lib/inventory/instant';
import { inventoryScope } from '@/lib/inventory/page';
import { requireView } from '@/lib/scope/guard';

export const metadata = { title: 'New instant deal' };

export default async function Page({ params }: { params: Promise<{ partnerId: string; advertiserId: string }> }) {
  const user = await requireView('STD');
  const scope = await inventoryScope(await params);
  const ctx = await orNotFound(() => getInstantContext(user, scope.advertiserId));
  return (
    <FormFrame title="New instant deal">
      <InstantDealForm partnerId={scope.partnerId} advertiserId={scope.advertiserId} ctx={ctx} />
    </FormFrame>
  );
}
