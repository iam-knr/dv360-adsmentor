import { redirect } from 'next/navigation';
import { advertiserPath } from '@/lib/routes/paths';

// [A] → [A]/cs (routes.md 6.3)
export default async function Page({
  params,
}: {
  params: Promise<{ partnerId: string; advertiserId: string }>;
}) {
  const { partnerId, advertiserId } = await params;
  redirect(advertiserPath(partnerId, advertiserId, 'cs'));
}
