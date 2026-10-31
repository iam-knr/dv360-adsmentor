import { notFound } from 'next/navigation';
import { TemplateList } from '@/components/templates/TemplateList';
import { requireView } from '@/lib/scope/guard';
import { listTemplates } from '@/lib/templates/service';

export const metadata = { title: 'Targeting templates' };

export default async function Page({
  params,
}: {
  params: Promise<{ partnerId: string; advertiserId: string }>;
}) {
  const user = await requireView('RO');
  const { partnerId, advertiserId } = await params;
  const res = await listTemplates(user, advertiserId);
  if (!res.ok) notFound();
  return <TemplateList partnerId={partnerId} advertiserId={advertiserId} data={res.data} />;
}
