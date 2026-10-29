import { notFound } from 'next/navigation';
import { BrandControls } from '@/components/resources/BrandControls';
import { getBrandControls } from '@/lib/resources/brand-service';
import { advertiserPath } from '@/lib/routes/paths';
import { requireView } from '@/lib/scope/guard';
import { resolveAdvertiser } from '@/lib/scope/resolve';

export const metadata = { title: 'Brand controls' };

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ partnerId: string; advertiserId: string }>;
  searchParams: Promise<{ tab?: string; filter?: string }>;
}) {
  const user = await requireView('RO');
  const { partnerId, advertiserId } = await params;
  const chain = await resolveAdvertiser(partnerId, advertiserId);
  if (!chain) notFound();
  const { tab, filter } = await searchParams;
  const view = await getBrandControls(
    user,
    { level: 'advertiser', id: chain.advertiser.publicId },
    tab === 'youtube' ? 'youtube' : 'display',
    filter === 'all' ? 'all' : 'active',
  );
  return (
    <BrandControls
      view={view}
      basePath={advertiserPath(
        chain.partner.publicId,
        chain.advertiser.publicId,
        'brand',
        'controls',
      )}
    />
  );
}
