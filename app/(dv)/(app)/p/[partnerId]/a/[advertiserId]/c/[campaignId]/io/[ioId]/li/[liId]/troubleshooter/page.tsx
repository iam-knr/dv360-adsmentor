import { notFound } from 'next/navigation';
import { TroubleshooterView } from '@/components/line-items/TroubleshooterView';
import { requireView } from '@/lib/scope/guard';
import { getTroubleshooter } from '@/lib/troubleshooter/service';

export const metadata = { title: 'Troubleshooter' };

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ liId: string }>;
  searchParams: Promise<{ inventory?: string; d?: string }>;
}) {
  const user = await requireView('RO');
  const { liId } = await params;
  const q = await searchParams;
  const res = await getTroubleshooter(user, liId, {
    ...(q.inventory ? { inventory: q.inventory } : {}),
    ...(q.d ? { d: q.d } : {}),
  });
  if (!res.ok) notFound();
  const range = q.d ?? 'LAST_7_DAYS';
  const dl = new URLSearchParams({ d: range });
  if (q.inventory) dl.set('inventory', q.inventory);
  return (
    <TroubleshooterView
      data={res.data}
      range={range}
      downloadHref={`/api/dv/line-items/${liId}/troubleshooter/download?${dl.toString()}`}
    />
  );
}
