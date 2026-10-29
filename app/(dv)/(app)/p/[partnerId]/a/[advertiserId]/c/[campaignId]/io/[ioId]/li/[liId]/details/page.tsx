import { notFound } from 'next/navigation';
import Box from '@mui/material/Box';
import { LiForm } from '@/components/line-items/LiForm';
import { getLineItemDetail } from '@/lib/line-items/service';
import { requireView } from '@/lib/scope/guard';
import { resolveLi } from '@/lib/scope/resolve';

export const metadata = { title: 'Line item details' };

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
  const detail = await getLineItemDetail(user, chain.li.id);
  if (!detail) notFound();
  return (
    <Box sx={{ p: 4, maxWidth: 960 }}>
      <LiForm
        mode="edit"
        partnerId={chain.partner.publicId}
        advertiserId={chain.advertiser.publicId}
        campaignId={chain.campaign.publicId}
        ioPublicId={chain.io.publicId}
        ioId={chain.io.id}
        advertiserRowId={chain.advertiser.id}
        liId={chain.li.id}
        version={detail.version}
        currency={detail.currency}
        initial={detail.value}
        io={detail.io}
        locked={detail.locked}
        creatives={detail.creatives}
        conversions={detail.conversions}
        higherCapText={detail.higherCapText}
        readOnly={detail.readOnly}
      />
    </Box>
  );
}
