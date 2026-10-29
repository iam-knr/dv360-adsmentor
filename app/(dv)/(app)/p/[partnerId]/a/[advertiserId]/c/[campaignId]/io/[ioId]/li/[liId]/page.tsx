import { notFound, redirect } from 'next/navigation';
import { lineItemLanding, liPath } from '@/lib/routes/paths';
import { resolveLi } from '@/lib/scope/resolve';

// [LI] → adgroups for YouTube and Demand Gen, else details (routes.md 6.3)
export default async function Page({
  params,
}: {
  params: Promise<{
    partnerId: string;
    advertiserId: string;
    campaignId: string;
    ioId: string;
    liId: string;
  }>;
}) {
  const { partnerId, advertiserId, campaignId, ioId, liId } = await params;
  const chain = await resolveLi(partnerId, advertiserId, campaignId, ioId, liId);
  if (!chain) notFound();
  redirect(liPath(partnerId, advertiserId, campaignId, ioId, liId, lineItemLanding(chain.li.type)));
}
