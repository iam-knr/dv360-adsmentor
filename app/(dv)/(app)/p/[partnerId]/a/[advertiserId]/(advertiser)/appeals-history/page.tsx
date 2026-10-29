import { notFound } from 'next/navigation';
import { AppealsTable } from '@/components/creatives/AppealsTable';
import { orNotFound } from '@/lib/creatives/page';
import { listAppeals } from '@/lib/creatives/review-service';
import { requireView } from '@/lib/scope/guard';
import { resolveAdvertiser } from '@/lib/scope/resolve';

export const metadata = { title: 'Appeal history' };

export default async function Page({
  params,
}: {
  params: Promise<{ partnerId: string; advertiserId: string }>;
}) {
  const user = await requireView('RO');
  const { partnerId, advertiserId } = await params;
  const chain = await resolveAdvertiser(partnerId, advertiserId);
  if (!chain) notFound();
  const result = await orNotFound(() => listAppeals(user, chain.advertiser.publicId));
  return (
    <AppealsTable
      rows={result.rows}
      total={result.total}
      partnerId={chain.partner.publicId}
      advertiserId={chain.advertiser.publicId}
    />
  );
}
