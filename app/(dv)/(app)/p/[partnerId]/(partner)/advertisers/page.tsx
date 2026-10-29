import { notFound } from 'next/navigation';
import { AdvertisersList } from '@/components/shell/PartnerPages';
import { listAdvertisers } from '@/lib/scope/advertisers';
import { requireView } from '@/lib/scope/guard';
import { resolvePartner } from '@/lib/scope/resolve';

export const metadata = { title: 'Advertisers' };

// Minimal Advertisers list (P3-03 item 8). The full list with metrics, filters and SDF is module 02.
export default async function Page({ params }: { params: Promise<{ partnerId: string }> }) {
  const user = await requireView('RO');
  const partner = await resolvePartner((await params).partnerId);
  if (!partner) notFound();
  return (
    <AdvertisersList partnerId={partner.publicId} rows={await listAdvertisers(user, partner.id)} />
  );
}
