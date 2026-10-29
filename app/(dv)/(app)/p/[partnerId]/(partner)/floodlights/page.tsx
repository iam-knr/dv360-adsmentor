import { notFound } from 'next/navigation';
import { PartnerFloodlightGroups } from '@/components/resources/PartnerFloodlightGroups';
import { listPartnerFloodlightGroups } from '@/lib/resources/floodlight';
import { requireView } from '@/lib/scope/guard';
import { resolvePartner } from '@/lib/scope/resolve';

export const metadata = { title: 'Floodlight groups' };

export default async function Page({ params }: { params: Promise<{ partnerId: string }> }) {
  const user = await requireView('RO');
  const { partnerId } = await params;
  const partner = await resolvePartner(partnerId);
  if (!partner) notFound();
  return (
    <PartnerFloodlightGroups rows={await listPartnerFloodlightGroups(user, partner.publicId)} />
  );
}
