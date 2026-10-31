import { notFound } from 'next/navigation';
import { YoutubeAssets } from '@/components/resources/YoutubeAssets';
import { listYoutubeAssets } from '@/lib/resources/youtube-assets';
import { advertiserPath } from '@/lib/routes/paths';
import { requireView } from '@/lib/scope/guard';
import { resolveAdvertiser } from '@/lib/scope/resolve';

export const metadata = { title: 'Location & sitelink assets' };

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ partnerId: string; advertiserId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await requireView('RO');
  const { partnerId, advertiserId } = await params;
  const chain = await resolveAdvertiser(partnerId, advertiserId);
  if (!chain) notFound();
  const { tab } = await searchParams;
  const current = tab === 'affiliate' || tab === 'sitelink' ? tab : 'location';
  const rows = await listYoutubeAssets(user, chain.advertiser.publicId, current);
  return (
    <YoutubeAssets
      basePath={advertiserPath(
        chain.partner.publicId,
        chain.advertiser.publicId,
        'location-extension',
      )}
      tab={current}
      rows={rows}
      advertiserName={chain.advertiser.name}
      currency={chain.advertiser.currencyCode}
    />
  );
}
