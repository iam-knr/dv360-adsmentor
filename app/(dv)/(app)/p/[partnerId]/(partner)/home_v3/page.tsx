import { notFound } from 'next/navigation';
import { PartnerOverview } from '@/components/shell/PartnerPages';
import { listAdvertisers } from '@/lib/scope/advertisers';
import { requireView } from '@/lib/scope/guard';
import { resolvePartner } from '@/lib/scope/resolve';

export const metadata = { title: 'Overview' };

// Minimal Overview (P3-03 item 8). The full page is module 01 Phase 4 (01-T9, 01-T10).
export default async function Page({ params }: { params: Promise<{ partnerId: string }> }) {
  const user = await requireView('RO');
  const partner = await resolvePartner((await params).partnerId);
  if (!partner) notFound();
  const advertisers = await listAdvertisers(user, partner.id);
  return (
    <PartnerOverview
      partnerId={partner.publicId}
      partnerName={partner.name}
      advertiserCount={advertisers.length}
    />
  );
}
