import { notFound } from 'next/navigation';
import { CampaignAlertsView } from '@/components/campaigns/CampaignAlertsView';
import { getCampaignAlerts } from '@/lib/optimisation/campaign-alerts';
import { requireView } from '@/lib/scope/guard';

export const metadata = { title: 'Alerts' };

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ campaignId: string }>;
  searchParams: Promise<{ ioId?: string; liId?: string; group?: string }>;
}) {
  const user = await requireView('RO');
  const { campaignId } = await params;
  const q = await searchParams;
  const group = q.group === 'budget' || q.group === 'creatives' ? q.group : undefined;
  const res = await getCampaignAlerts(user, campaignId, {
    ...(q.ioId ? { ioId: q.ioId } : {}),
    ...(q.liId ? { liId: q.liId } : {}),
    ...(group ? { group } : {}),
  });
  if (!res.ok) notFound();
  return (
    <CampaignAlertsView
      data={res.data}
      ioId={q.ioId ?? ''}
      liId={q.liId ?? ''}
      group={group ?? ''}
    />
  );
}
