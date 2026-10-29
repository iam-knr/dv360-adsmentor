import { notFound } from 'next/navigation';
import { CreativeForm } from '@/components/creatives/CreativeForm';
import { FormFrame } from '@/components/shell/Frames';
import { newCreativeInput } from '@/lib/creatives/form';
import { KIND_META, resolveKind } from '@/lib/creatives/kinds';
import { requireView } from '@/lib/scope/guard';
import { resolveAdvertiser } from '@/lib/scope/resolve';

export const metadata = { title: 'New creative' };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ partnerId: string; advertiserId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireView('STD');
  const { partnerId, advertiserId } = await params;
  const q = await searchParams;
  const chain = await resolveAdvertiser(partnerId, advertiserId);
  if (!chain) notFound();
  // `?kind=` is always accepted; the seen form is type=0&hostingSrc=1; none given opens third-party display
  const given = one(q.kind) ?? one(q.type);
  const resolved = given
    ? resolveKind({
        kind: one(q.kind) ?? null,
        type: one(q.type) ?? null,
        hostingSrc: one(q.hostingSrc) ?? null,
      })
    : { kind: 'THIRD_PARTY_DISPLAY' as const, formatKey: null };
  if (!resolved) notFound();
  const label = resolved.formatKey === 'OPTIMIZED' ? 'optimized' : KIND_META[resolved.kind].label;
  return (
    <FormFrame title={`New ${label} creative`}>
      <CreativeForm
        mode="create"
        partnerId={chain.partner.publicId}
        advertiserId={chain.advertiser.publicId}
        initial={newCreativeInput(resolved.kind, resolved.formatKey)}
      />
    </FormFrame>
  );
}
