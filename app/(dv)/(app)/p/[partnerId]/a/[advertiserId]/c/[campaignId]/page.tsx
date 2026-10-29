import { redirect } from 'next/navigation';
import { campaignPath, campaignTabSegment } from '@/lib/routes/paths';
import { requireViewer } from '@/lib/scope/guard';
import { pinnedCampaignTab } from '@/lib/scope/home';

// [C] → the user's pinned tab, default explorerios (routes.md 6.3, RT Q3)
export default async function Page({
  params,
}: {
  params: Promise<{ partnerId: string; advertiserId: string; campaignId: string }>;
}) {
  const { partnerId, advertiserId, campaignId } = await params;
  const tab = campaignTabSegment(await pinnedCampaignTab(await requireViewer()));
  redirect(campaignPath(partnerId, advertiserId, campaignId, tab));
}
