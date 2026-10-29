import { notFound } from 'next/navigation';
import { FormatGallery } from '@/components/creatives/FormatGallery';
import { requireView } from '@/lib/scope/guard';
import { resolveAdvertiser } from '@/lib/scope/resolve';

export const metadata = { title: 'Format gallery' };

export default async function Page({
  params,
}: {
  params: Promise<{ partnerId: string; advertiserId: string }>;
}) {
  await requireView('RO');
  const { partnerId, advertiserId } = await params;
  const chain = await resolveAdvertiser(partnerId, advertiserId);
  if (!chain) notFound();
  return (
    <FormatGallery partnerId={chain.partner.publicId} advertiserId={chain.advertiser.publicId} />
  );
}
