import { redirect } from 'next/navigation';
import { ioPath } from '@/lib/routes/paths';

// [IO] → [IO]/explorerlis (routes.md 6.3)
export default async function Page({
  params,
}: {
  params: Promise<{ partnerId: string; advertiserId: string; campaignId: string; ioId: string }>;
}) {
  const { partnerId, advertiserId, campaignId, ioId } = await params;
  redirect(ioPath(partnerId, advertiserId, campaignId, ioId, 'explorerlis'));
}
