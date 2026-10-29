import { notFound } from 'next/navigation';
import { CreativeHeader } from '@/components/creatives/CreativeHeader';
import { CreativeStatus } from '@/components/creatives/CreativeStatus';
import { FormFrame } from '@/components/shell/Frames';
import { orNotFound } from '@/lib/creatives/page';
import { getCreativeStatus } from '@/lib/creatives/review-service';
import { getCreativeDetail } from '@/lib/creatives/service';
import { requireView } from '@/lib/scope/guard';
import { resolveAdvertiser } from '@/lib/scope/resolve';

export const metadata = { title: 'Creative status' };

export default async function Page({
  params,
}: {
  params: Promise<{ partnerId: string; advertiserId: string; creativeId: string }>;
}) {
  const user = await requireView('RO');
  const { partnerId, advertiserId, creativeId } = await params;
  const chain = await resolveAdvertiser(partnerId, advertiserId);
  if (!chain) notFound();
  const pid = chain.partner.publicId;
  const aid = chain.advertiser.publicId;
  const detail = await orNotFound(() => getCreativeDetail(user, aid, creativeId));
  const view = await orNotFound(() => getCreativeStatus(user, aid, creativeId));
  return (
    <FormFrame title={detail.row.name}>
      <CreativeHeader partnerId={pid} advertiserId={aid} row={detail.row} active="status" />
      <CreativeStatus view={view} partnerId={pid} advertiserId={aid} creativeId={detail.id} />
    </FormFrame>
  );
}
