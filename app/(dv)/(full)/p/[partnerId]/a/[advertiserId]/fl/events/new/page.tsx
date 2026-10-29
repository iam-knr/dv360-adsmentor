import { notFound } from 'next/navigation';
import { ConversionForm, newConversionValue } from '@/components/resources/FloodlightConversions';
import { FormFrame } from '@/components/shell/Frames';
import { listAppOptions } from '@/lib/resources/apps';
import { requireView } from '@/lib/scope/guard';
import { resolveAdvertiser } from '@/lib/scope/resolve';

export const metadata = { title: 'New Floodlight conversion' };

const TYPES = { web: 'WEB', app: 'MOBILE_APP', ctv: 'CONNECTED_TV' } as const;

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ partnerId: string; advertiserId: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const user = await requireView('STD');
  const { partnerId, advertiserId } = await params;
  const chain = await resolveAdvertiser(partnerId, advertiserId);
  if (!chain) notFound();
  const { type } = await searchParams;
  const platform = type && type in TYPES ? TYPES[type as keyof typeof TYPES] : null;
  return (
    <FormFrame title="New Floodlight conversion">
      <ConversionForm
        partnerId={chain.partner.publicId}
        advertiserId={chain.advertiser.publicId}
        initial={platform ? newConversionValue(platform) : null}
        existing={null}
        apps={await listAppOptions(user)}
      />
    </FormFrame>
  );
}
