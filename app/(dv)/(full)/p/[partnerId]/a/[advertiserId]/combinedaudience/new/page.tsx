import { notFound } from 'next/navigation';
import { FormFrame } from '@/components/shell/Frames';
import { CombinedForm } from '@/components/audiences/CombinedForm';
import { requireView } from '@/lib/scope/guard';
import { resolveAdvertiser } from '@/lib/scope/resolve';

export const metadata = { title: 'New combined audience' };

export default async function Page({
  params,
}: {
  params: Promise<{ partnerId: string; advertiserId: string }>;
}) {
  await requireView('STD');
  const { partnerId, advertiserId } = await params;
  const chain = await resolveAdvertiser(partnerId, advertiserId);
  if (!chain) notFound();
  return (
    <FormFrame title="New combined audience">
      <CombinedForm partnerId={chain.partner.publicId} advertiserId={chain.advertiser.publicId} />
    </FormFrame>
  );
}
