import { CrossMediaDetail } from '../CrossMediaDetail';
import { CrossMediaForm } from '../CrossMediaForm';
import { CrossMediaList } from '../CrossMediaList';
import { FormFrame } from '@/components/shell/Frames';
import { orNotFound } from '@/lib/creatives/page';
import { getCrossMediaReport, listCrossMediaReports } from '@/lib/planning/cross-media-service';
import { requireView } from '@/lib/scope/guard';
import { resolveAdvertiser, resolvePartner } from '@/lib/scope/resolve';
import { notFound } from 'next/navigation';

interface P {
  partnerId: string;
  advertiserId?: string | undefined;
  reportId?: string | undefined;
}

/** The URL segments are the public ids the links use; a foreign id is a 404. */
async function scopeOf(p: P) {
  if (p.advertiserId) {
    const chain = await resolveAdvertiser(p.partnerId, p.advertiserId);
    if (!chain) notFound();
    return { partnerId: chain.partner.publicId, advertiserId: chain.advertiser.publicId };
  }
  const partner = await resolvePartner(p.partnerId);
  if (!partner) notFound();
  return { partnerId: partner.publicId };
}

export async function CrossMediaListRoute({ params }: { params: P }) {
  const user = await requireView('REP');
  const scope = await scopeOf(params);
  const data = await orNotFound(() => listCrossMediaReports(user, scope));
  return (
    <CrossMediaList
      scope={scope}
      rows={data.rows}
      canWrite={data.canWrite}
      partner={data.partner}
    />
  );
}

export async function CrossMediaNewRoute({ params }: { params: P }) {
  await requireView('REP');
  const scope = await scopeOf(params);
  return (
    <FormFrame title="Create a report">
      <CrossMediaForm scope={scope} />
    </FormFrame>
  );
}

export async function CrossMediaDetailRoute({ params }: { params: P }) {
  const user = await requireView('REP');
  const scope = await scopeOf(params);
  const report = await orNotFound(() => getCrossMediaReport(user, scope, params.reportId ?? ''));
  return (
    <FormFrame title="Cross-media reach report" wide>
      <CrossMediaDetail scope={scope} report={report} />
    </FormFrame>
  );
}
