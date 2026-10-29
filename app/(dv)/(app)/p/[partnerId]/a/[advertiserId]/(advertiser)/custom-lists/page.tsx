import { notFound } from 'next/navigation';
import { AudiencesPage } from '@/components/audiences/AudiencesPage';
import { listAudiences } from '@/lib/audiences/service';
import { requireView } from '@/lib/scope/guard';
import { resolveAdvertiser } from '@/lib/scope/resolve';

export const metadata = { title: 'All audiences' };

export default async function Page({
  params,
}: {
  params: Promise<{ partnerId: string; advertiserId: string }>;
}) {
  const user = await requireView('RO');
  const { partnerId, advertiserId } = await params;
  const chain = await resolveAdvertiser(partnerId, advertiserId);
  if (!chain) notFound();
  const list = await listAudiences(user, chain.advertiser.publicId, {
    tab: 'CUSTOM',
    status: ['PROCESSING', 'ACTIVE', 'INACTIVE'],
  });
  return (
    <AudiencesPage
      partnerId={chain.partner.publicId}
      advertiserId={chain.advertiser.publicId}
      tab="CUSTOM"
      rows={list.rows}
      total={list.total}
    />
  );
}
