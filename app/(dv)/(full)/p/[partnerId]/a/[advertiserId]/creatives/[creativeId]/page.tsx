import { notFound } from 'next/navigation';
import { CreativeForm } from '@/components/creatives/CreativeForm';
import { CreativeHeader } from '@/components/creatives/CreativeHeader';
import { FormFrame } from '@/components/shell/Frames';
import { orNotFound } from '@/lib/creatives/page';
import { getCreativeDetail } from '@/lib/creatives/service';
import { requireView } from '@/lib/scope/guard';
import { resolveAdvertiser } from '@/lib/scope/resolve';

export const metadata = { title: 'Creative details' };

export default async function Page({
  params,
}: {
  params: Promise<{ partnerId: string; advertiserId: string; creativeId: string }>;
}) {
  const user = await requireView('RO');
  const { partnerId, advertiserId, creativeId } = await params;
  const chain = await resolveAdvertiser(partnerId, advertiserId);
  if (!chain) notFound();
  const detail = await orNotFound(() =>
    getCreativeDetail(user, chain.advertiser.publicId, creativeId),
  );
  const pid = chain.partner.publicId;
  const aid = chain.advertiser.publicId;
  return (
    <FormFrame title={detail.row.name}>
      <CreativeHeader partnerId={pid} advertiserId={aid} row={detail.row} active="details" />
      <CreativeForm
        mode="edit"
        partnerId={pid}
        advertiserId={aid}
        creativeId={detail.id}
        version={detail.version}
        initial={detail.value}
        cm360={detail.cm360}
        readOnly={detail.readOnly}
      />
      {detail.performance ? (
        <section aria-label="Performance" style={{ marginTop: 32 }}>
          <h2 style={{ fontSize: 16 }}>Performance, last 7 days</h2>
          <table>
            <thead>
              <tr>
                <th align="left">Date</th>
                <th align="right">Impressions</th>
                <th align="right">Clicks</th>
                <th align="right">CTR</th>
              </tr>
            </thead>
            <tbody>
              {detail.performance.map((p) => (
                <tr key={p.date}>
                  <td>{p.date}</td>
                  <td align="right">{p.impressions.toLocaleString('en-US')}</td>
                  <td align="right">{p.clicks.toLocaleString('en-US')}</td>
                  <td align="right">{(p.ctr * 100).toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
    </FormFrame>
  );
}
