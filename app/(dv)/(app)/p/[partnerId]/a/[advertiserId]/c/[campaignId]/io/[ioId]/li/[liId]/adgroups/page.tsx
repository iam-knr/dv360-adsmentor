import { notFound } from 'next/navigation';
import { AdGroupsTab } from '@/components/youtube/AdGroupsTab';
import { AD_GROUP_LI_TYPES, liPath } from '@/lib/routes/paths';
import { AppLink } from '@/lib/routes/AppLink';
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
  // only YouTube and Demand Gen line items have ad groups (routes.md 6.3); other types see a note, not a 404
  if (!AD_GROUP_LI_TYPES.includes(chain.li.type))
    return (
      <div style={{ padding: 16 }}>
        <p>Ad groups are available for YouTube and Demand Gen line items.</p>
        <AppLink
          href={liPath(p.partnerId, p.advertiserId, p.campaignId, p.ioId, p.liId, 'details')}
        >
          Open line item details
        </AppLink>
      </div>
    );
  const list = await listAdGroups(user, chain.li.id);
  if (!list) notFound();
  return (
    <div style={{ padding: 16 }}>
      <AdGroupsTab list={list} />
    </div>
  );
}
