import { notFound } from 'next/navigation';
import { CreateAdvertiserForm } from '@/components/settings/CreateAdvertiserForm';
import { FormFrame } from '@/components/shell/Frames';
import { requireView } from '@/lib/scope/guard';
import { getCreateAdvertiserContext } from '@/lib/settings/create-advertiser-context';

export const metadata = { title: 'New advertiser' };

export default async function Page({ params }: { params: Promise<{ partnerId: string }> }) {
  const user = await requireView('STD');
  const { partnerId } = await params;
  const res = await getCreateAdvertiserContext(user, partnerId);
  if (!res.ok) notFound();
  return (
    <FormFrame title="New advertiser">
      <CreateAdvertiserForm partnerId={partnerId} context={res.data} />
    </FormFrame>
  );
}
