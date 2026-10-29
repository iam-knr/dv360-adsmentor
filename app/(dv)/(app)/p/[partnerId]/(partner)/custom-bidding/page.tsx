import { notFound } from 'next/navigation';
import { CustomBiddingListPage } from '@/components/resources/CustomBidding';
import { listCustomBidding } from '@/lib/resources/custom-bidding';
import { requireView } from '@/lib/scope/guard';
import { resolvePartner } from '@/lib/scope/resolve';

export const metadata = { title: 'Custom bidding' };

export default async function Page({ params }: { params: Promise<{ partnerId: string }> }) {
  const user = await requireView('RO');
  const { partnerId } = await params;
  const partner = await resolvePartner(partnerId);
  if (!partner) notFound();
  const rows = await listCustomBidding(user, { level: 'partner', id: partner.publicId });
  return <CustomBiddingListPage partnerId={partner.publicId} rows={rows} />;
}
