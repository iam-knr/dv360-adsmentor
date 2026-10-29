import { notFound } from 'next/navigation';
import Box from '@mui/material/Box';
import { CampaignForm } from '@/components/campaigns/CampaignForm';
import { getCampaign } from '@/lib/campaigns/service';
import { requireView, toViewerInfo } from '@/lib/scope/guard';
import { resolveCampaign } from '@/lib/scope/resolve';

export const metadata = { title: 'Campaign settings' };

export default async function Page({
  params,
}: {
  params: Promise<{ partnerId: string; advertiserId: string; campaignId: string }>;
}) {
  const user = await requireView('RO');
  const { partnerId, advertiserId, campaignId } = await params;
  const chain = await resolveCampaign(partnerId, advertiserId, campaignId);
  if (!chain) notFound();
  const detail = await getCampaign(user, chain.campaign.publicId);
  return (
    <Box sx={{ p: 4, maxWidth: 960 }}>
      <CampaignForm
        mode="edit"
        partnerId={chain.partner.publicId}
        advertiserId={chain.advertiser.publicId}
        campaignId={chain.campaign.publicId}
        currency={detail.currency}
        initial={detail.value}
        version={detail.version}
        startLocked={detail.startLocked}
        readOnly={toViewerInfo(user).readOnly}
      />
    </Box>
  );
}
