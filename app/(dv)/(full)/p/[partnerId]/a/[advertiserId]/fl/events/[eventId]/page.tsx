import { notFound } from 'next/navigation';
import { ConversionForm } from '@/components/resources/FloodlightConversions';
import { FormFrame } from '@/components/shell/Frames';
import { listAppOptions } from '@/lib/resources/apps';
import { getFloodlightConversion } from '@/lib/resources/floodlight';
import { ServiceFailure } from '@/lib/resources/kit';
import { requireView } from '@/lib/scope/guard';
import { resolveAdvertiser } from '@/lib/scope/resolve';

export const metadata = { title: 'Edit conversion' };

export default async function Page({
  params,
}: {
  params: Promise<{ partnerId: string; advertiserId: string; eventId: string }>;
}) {
  const user = await requireView('RO');
  const { partnerId, advertiserId, eventId } = await params;
  const chain = await resolveAdvertiser(partnerId, advertiserId);
  if (!chain) notFound();
  const view = await getFloodlightConversion(user, eventId).catch((e: unknown) => {
    if (e instanceof ServiceFailure) return null;
    throw e;
  });
  if (!view) notFound();
  return (
    <FormFrame title="Edit conversion">
      <ConversionForm
        partnerId={chain.partner.publicId}
        advertiserId={chain.advertiser.publicId}
        initial={null}
        existing={view}
        apps={await listAppOptions(user)}
      />
    </FormFrame>
  );
}
