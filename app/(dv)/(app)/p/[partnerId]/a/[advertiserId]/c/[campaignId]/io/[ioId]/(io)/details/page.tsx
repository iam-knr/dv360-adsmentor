import { notFound } from 'next/navigation';
import Box from '@mui/material/Box';
import { IoForm } from '@/components/insertion-orders/IoForm';
import { ioObjectiveMatrix } from '@/lib/insertion-orders/matrix';
import { getInsertionOrder } from '@/lib/insertion-orders/service';
import { requireView, toViewerInfo } from '@/lib/scope/guard';
import { resolveIo } from '@/lib/scope/resolve';

export const metadata = { title: 'Insertion order details' };

export default async function Page({
  params,
}: {
  params: Promise<{ partnerId: string; advertiserId: string; campaignId: string; ioId: string }>;
}) {
  const user = await requireView('RO');
  const { partnerId, advertiserId, campaignId, ioId } = await params;
  const chain = await resolveIo(partnerId, advertiserId, campaignId, ioId);
  if (!chain) notFound();
  const detail = await getInsertionOrder(user, chain.io.publicId);
  const entry = ioObjectiveMatrix(detail.value.type!).objectives.find(
    (o) => o.key === detail.value.objective,
  );
  if (!entry) notFound();
  const noneEntry = ioObjectiveMatrix(detail.value.type!).objectives.find((o) => o.key === 'NONE');
  return (
    <Box sx={{ p: 4, maxWidth: 960 }}>
      <IoForm
        mode="edit"
        partnerId={chain.partner.publicId}
        advertiserId={chain.advertiser.publicId}
        campaignId={chain.campaign.publicId}
        ioId={chain.io.publicId}
        version={detail.version}
        currency={detail.currency}
        initial={detail.value}
        matrix={entry}
        {...(noneEntry ? { noneMatrix: noneEntry } : {})}
        campaignFrequencyCap={detail.campaignFrequencyCap}
        readOnly={toViewerInfo(user).readOnly}
      />
    </Box>
  );
}
