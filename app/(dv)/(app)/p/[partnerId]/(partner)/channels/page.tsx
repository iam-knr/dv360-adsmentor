import { notFound } from 'next/navigation';
import { ChannelsKeywordsPage } from '@/components/resources/ChannelsKeywordsPage';
import { listChannels } from '@/lib/resources/lists';
import { requireView } from '@/lib/scope/guard';
import { resolvePartner } from '@/lib/scope/resolve';

export const metadata = { title: 'Channels' };

export default async function Page({ params }: { params: Promise<{ partnerId: string }> }) {
  const user = await requireView('RO');
  const { partnerId } = await params;
  const partner = await resolvePartner(partnerId);
  if (!partner) notFound();
  const channels = await listChannels(user, { level: 'partner', id: partner.publicId });
  return (
    <ChannelsKeywordsPage
      partnerId={partner.publicId}
      tab="channels"
      channels={channels}
      keywordLists={[]}
    />
  );
}
