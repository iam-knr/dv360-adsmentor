import { notFound } from 'next/navigation';
import { CombinedGrid, type CombinedRow } from '@/components/campaigns/CombinedGrid';
import { listInsertionOrders } from '@/lib/insertion-orders/service';
import { IO_TYPE_LABEL } from '@/lib/insertion-orders/wire';
import { listLineItems } from '@/lib/line-items/service';
import { requireView } from '@/lib/scope/guard';
import { resolveCampaign } from '@/lib/scope/resolve';
import { LI_TYPE_LABEL } from '@/lib/validation/constants/li-compat';

export const metadata = { title: 'Combined' };

export default async function Page({
  params,
}: {
  params: Promise<{ partnerId: string; advertiserId: string; campaignId: string }>;
}) {
  const user = await requireView('RO');
  const { partnerId, advertiserId, campaignId } = await params;
  const chain = await resolveCampaign(partnerId, advertiserId, campaignId);
  if (!chain) notFound();
  const [ios, lis] = await Promise.all([
    listInsertionOrders(
      user,
      { campaignId: chain.campaign.publicId },
      { status: ['*'], pageSize: 1000 },
    ),
    listLineItems(
      user,
      { kind: 'campaign', id: chain.campaign.id },
      { status: ['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED'], pageSize: 1000 },
    ),
  ]);
  if (!lis) notFound();
  const rows: CombinedRow[] = ios.rows.map((io) => {
    const children = lis.rows
      .filter((li) => li.ioPublicId === io.publicId)
      .map((li): CombinedRow => ({
        kind: 'LI',
        key: `li-${li.publicId}`,
        publicId: li.publicId,
        ioPublicId: li.ioPublicId,
        name: li.name,
        status: li.status,
        type: LI_TYPE_LABEL[li.type],
        impressions: li.impressions,
        clicks: li.clicks,
        conversions: li.conversions,
        revenue: li.revenue,
      }));
    return {
      kind: 'IO',
      key: `io-${io.publicId}`,
      publicId: io.publicId,
      ioPublicId: io.publicId,
      name: io.name,
      status: io.status,
      type: IO_TYPE_LABEL[io.type],
      impressions: io.impressions,
      clicks: io.interactions,
      conversions: io.conversions,
      revenue: io.revenue,
      children,
    };
  });
  return (
    <CombinedGrid
      partnerId={chain.partner.publicId}
      advertiserId={chain.advertiser.publicId}
      campaignId={chain.campaign.publicId}
      currency={chain.advertiser.currencyCode}
      rows={rows}
    />
  );
}
