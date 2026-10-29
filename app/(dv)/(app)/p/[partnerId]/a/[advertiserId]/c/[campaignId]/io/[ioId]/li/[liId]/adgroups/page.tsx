import { notFound } from 'next/navigation';
import { AdGroupsTab } from '@/components/youtube/AdGroupsTab';
import { requireView } from '@/lib/scope/guard';
import { resolveLi } from '@/lib/scope/resolve';
import { listAdGroups } from '@/lib/youtube/service';

export const metadata = { title: 'Ad groups' };

export default async function Page({
  params,
}: {
  params: Promise<{
    partnerId: string;
    advertiserId: string;
    campaignId: string;
    ioId: string;
    liId: string;
  }>;
}) {
  const user = await requireView('RO');
  const p = await params;
  const chain = await resolveLi(p.partnerId, p.advertiserId, p.campaignId, p.ioId, p.liId);
  if (!chain) notFound();
  const list = await listAdGroups(user, chain.li.id);
  if (!list) notFound();
  return (
    <div style={{ padding: 16 }}>
      <AdGroupsTab list={list} />
    </div>
  );
}
