import { permanentRedirect } from 'next/navigation';
import { advertiserPath } from '@/lib/routes/paths';

// [A]/marketplace/featured-v2 → featured-v3, 308 (routes.md 6.3)
export default async function Page({
  params,
}: {
  params: Promise<{ partnerId: string; advertiserId: string }>;
}) {
  const { partnerId, advertiserId } = await params;
  permanentRedirect(advertiserPath(partnerId, advertiserId, 'marketplace', 'featured-v3'));
}
