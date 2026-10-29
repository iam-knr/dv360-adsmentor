import { notFound, redirect } from 'next/navigation';
import { AdGroupsTab } from '@/components/youtube/AdGroupsTab';
import { AD_GROUP_LI_TYPES, liPath } from '@/lib/routes/paths';
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
  // only YouTube and Demand Gen line items have ad groups (routes.md 6.3)
  if (!AD_GROUP_LI_TYPES.includes(chain.li.type))
    redirect(liPath(p.partnerId, p.advertiserId, p.campaignId, p.ioId, p.liId, 'details'));
  const list = await listAdGroups(user, chain.li.id);
  if (!list) notFound();
  return (
    <div style={{ padding: 16 }}>
      <AdGroupsTab list={list} />
    </div>
  );
}
