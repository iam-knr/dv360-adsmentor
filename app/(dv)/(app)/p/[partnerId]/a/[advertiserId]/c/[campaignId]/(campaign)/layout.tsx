import type { ReactNode } from 'react';
import { CampaignTabs } from '@/components/campaigns/CampaignTabs';
import { ShellMain } from '@/components/shell/AppChrome';
import { requireViewer } from '@/lib/scope/guard';
import { pinnedCampaignTab } from '@/lib/scope/home';

// Frame C. The tab strip and chart strip show on Combined, Insertion orders and Line items only (module 06 2.4).
export default async function Layout({
  params,
  children,
}: {
  params: Promise<{ partnerId: string; advertiserId: string; campaignId: string }>;
  children: ReactNode;
}) {
  const { partnerId, advertiserId, campaignId } = await params;
  const pinned = await pinnedCampaignTab(await requireViewer());
  return (
    <ShellMain nav="campaign">
      <CampaignTabs
        partnerId={partnerId}
        advertiserId={advertiserId}
        campaignId={campaignId}
        pinned={pinned}
      >
        {children}
      </CampaignTabs>
    </ShellMain>
  );
}
