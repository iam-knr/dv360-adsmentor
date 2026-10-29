import { notFound } from 'next/navigation';
import { AudienceLineItems } from '@/components/audiences/AudienceLineItems';
import { getAudience, listAudienceLineItems } from '@/lib/audiences/service';
import { ServiceFailure } from '@/lib/resources/kit';
import { requireView } from '@/lib/scope/guard';
import { resolveAdvertiser } from '@/lib/scope/resolve';

export const metadata = { title: 'Line items' };

// The `[kind]` folder holds the audience id (routes.md 3.8).
export default async function Page({
  params,
}: {
  params: Promise<{ partnerId: string; advertiserId: string; kind: string }>;
}) {
  const user = await requireView('RO');
  const { partnerId, advertiserId, kind: audienceId } = await params;
  const chain = await resolveAdvertiser(partnerId, advertiserId);
  if (!chain) notFound();
  const load = async () => {
    try {
      return {
        audience: await getAudience(user, audienceId),
        items: await listAudienceLineItems(user, audienceId),
      };
    } catch (e) {
      if (e instanceof ServiceFailure) return null;
      throw e;
    }
  };
  const data = await load();
  if (!data) notFound();
  const { audience, items } = data;
  return (
    <AudienceLineItems
      partnerId={chain.partner.publicId}
      advertiserId={chain.advertiser.publicId}
      audience={{ id: audience.id, name: audience.name, status: audience.status, type: audience.type }}
      items={items}
      externalSource={audience.externalSource}
    />
  );
}
