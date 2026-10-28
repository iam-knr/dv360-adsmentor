import { notFound, redirect } from 'next/navigation';
import { advertiserPath } from '@/lib/routes/paths';
import { resolveAdvertiser, resolveAudienceKind } from '@/lib/scope/resolve';

// [A]/audience/{id}/details → [A]/audience/{kind}/{id}/details (routes.md 6.3). The `[kind]` folder holds the id.
export default async function Page({
  params,
}: {
  params: Promise<{ partnerId: string; advertiserId: string; kind: string }>;
}) {
  const { partnerId, advertiserId, kind: audienceId } = await params;
  const chain = await resolveAdvertiser(partnerId, advertiserId);
  const kind = chain ? await resolveAudienceKind(chain.advertiser.id, audienceId) : null;
  if (!kind) notFound();
  redirect(advertiserPath(partnerId, advertiserId, 'audience', kind, audienceId, 'details'));
}
