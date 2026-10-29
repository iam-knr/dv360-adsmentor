'use client';

// Audience analysis (module 14 S16 to S18): the hub, Geographic distribution and Audience insights. Output is
// deterministic per seed list or line item. The map is a stretch goal (design-system Q19): bars only.
import { useState, useTransition } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { DvBanner, DvPageHeader, DvSectionCard, DvSelect } from '@/components/dv';
import { useViewer } from '@/components/shell/ViewerProvider';
import { AppLink } from '@/lib/routes/AppLink';
import { advertiserPath } from '@/lib/routes/paths';
import { analyzeGeoAction, getInsightsAction } from '@/lib/audiences/actions';
import type { AudienceBucket, AudienceInsights, AudienceLookups, GeoDistribution, WireIssue } from '@/lib/audiences/wire';

export function AnalysisHub({ partnerId, advertiserId }: { partnerId: string; advertiserId: string }) {
  const { viewer } = useViewer();
  const base = (s: string) => advertiserPath(partnerId, advertiserId, s);
  return (
    <>
      <DvPageHeader title="Analysis" limitedAccess={viewer.limitedAccess} />
      <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        <Box sx={{ width: 360 }}>
          <DvSectionCard title="Geographic distribution" layout="stacked">
            <Typography variant="body2" sx={{ mb: 2 }}>
              Analyze the ideal geo targeting for an audience. Display only.
            </Typography>
            <AppLink href={base('audience-geo-distribution')}>Open Geographic distribution</AppLink>
          </DvSectionCard>
        </Box>
        <Box sx={{ width: 360 }}>
          <DvSectionCard title="Audience insights" layout="stacked">
            <Typography variant="body2" sx={{ mb: 2 }}>
              Get insights about the audience reached with optimized targeting.
            </Typography>
            <AppLink href={base('audience-composition-insights')}>Open Audience insights</AppLink>
          </DvSectionCard>
        </Box>
      </Box>
    </>
  );
}

function Bars({ rows, unit = '%' }: { rows: { label: string; value: number; note: string; hot?: boolean }[]; unit?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {rows.map((r) => (
        <Box component="li" key={r.label} sx={{ display: 'grid', gridTemplateColumns: '160px 1fr 120px', gap: 2, alignItems: 'center' }}>
          <Typography variant="body2">{r.label}</Typography>
          <Box sx={{ height: 10, bgcolor: 'action.hover', borderRadius: 1 }}>
            <Box
              sx={{ height: '100%', width: `${(r.value / max) * 100}%`, bgcolor: r.hot ? 'primary.main' : 'text.disabled', borderRadius: 1 }}
            />
          </Box>
          <Typography variant="caption">
            {r.value}
            {unit} · {r.note}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

export function GeoDistributionPage({
  advertiserId,
  lookups,
}: {
  partnerId?: string;
  advertiserId: string;
  lookups: AudienceLookups;
}) {
  const [seed, setSeed] = useState('');
  const [result, setResult] = useState<GeoDistribution | null>(null);
  const [issues, setIssues] = useState<WireIssue[]>([]);
  const [pending, start] = useTransition();
  const { viewer } = useViewer();
  const youtubeOnly = lookups.firstParty.find((f) => f.id === seed)?.type === 'YOUTUBE_USERS';
  const run = () =>
    start(async () => {
      const res = await analyzeGeoAction(advertiserId, seed);
      if (!res.ok) {
        setResult(null);
        return setIssues(res.issues);
      }
      setIssues([]);
      setResult(res.data);
    });
  return (
    <>
      <DvPageHeader title="Geographic distribution" limitedAccess={viewer.limitedAccess} />
      <DvSectionCard title="Seed audience" layout="settings">
        <DvSelect
          id="geo-seed"
          label="Seed audience"
          value={seed}
          onChange={setSeed}
          placeholder="Select a first-party list"
          error={issues.find((i) => i.severity === 'error')?.message}
          options={lookups.firstParty.map((f) => ({
            value: f.id,
            label: f.name,
            secondLine: `${f.users.toLocaleString('en-US')} users`,
          }))}
        />
        {youtubeOnly ? <DvBanner kind="info">Only Display inventory is analysed.</DvBanner> : null}
        <Button variant="contained" sx={{ alignSelf: 'flex-start' }} disabled={!seed || pending} onClick={run}>
          Analyze
        </Button>
      </DvSectionCard>
      {result ? (
        <Box sx={{ mt: 4 }} data-testid="geo-result">
          <DvSectionCard title={`Regions for ${result.seed.name}`} layout="stacked">
            <Box component="table" aria-label="Regions" sx={{ borderCollapse: 'collapse', width: '100%', mb: 3 }}>
              <thead>
                <tr>
                  <th align="left">Region</th>
                  <th align="right">Index vs population</th>
                  <th align="right">Share of seed audience</th>
                  <th align="center">Suggested for targeting</th>
                </tr>
              </thead>
              <tbody>
                {result.regions.map((r) => (
                  <tr key={r.code}>
                    <td>{r.name}</td>
                    <td align="right">{r.index}</td>
                    <td align="right">{r.sharePct.toFixed(1)}%</td>
                    <td align="center">{r.suggested ? '✓' : ''}</td>
                  </tr>
                ))}
              </tbody>
            </Box>
            <Bars
              rows={result.regions.map((r) => ({
                label: r.name,
                value: r.sharePct,
                note: `index ${r.index}`,
                hot: r.suggested,
              }))}
            />
          </DvSectionCard>
        </Box>
      ) : (
        <Box sx={{ mt: 4 }}>
          <DvBanner kind="info">
            No seed audience selected. Choose a first-party list with at least 1,000 users to see where its members
            are. New lists can take up to 4 hours to become available.
          </DvBanner>
        </Box>
      )}
    </>
  );
}

const CARD_TITLES: { key: keyof Pick<AudienceInsights, 'age' | 'gender' | 'device' | 'regions' | 'interests'>; title: string }[] = [
  { key: 'age', title: 'Age' },
  { key: 'gender', title: 'Gender' },
  { key: 'device', title: 'Device' },
  { key: 'regions', title: 'Top regions' },
  { key: 'interests', title: 'Top interests' },
];

export function InsightsPage({
  advertiserId,
  lineItems,
}: {
  advertiserId: string;
  lineItems: { id: string; name: string }[];
}) {
  const { viewer } = useViewer();
  const [li, setLi] = useState('');
  const [data, setData] = useState<AudienceInsights | null>(null);
  const [issues, setIssues] = useState<WireIssue[]>([]);
  const [, start] = useTransition();
  const pick = (id: string) => {
    setLi(id);
    start(async () => {
      const res = await getInsightsAction(advertiserId, id);
      if (!res.ok) {
        setData(null);
        return setIssues(res.issues);
      }
      setIssues([]);
      setData(res.data);
    });
  };
  const rows = (b: AudienceBucket[]) => b.map((x) => ({ label: x.label, value: x.sharePct, note: `index ${x.index}`, hot: x.index >= 120 }));
  return (
    <>
      <DvPageHeader title="Audience insights" limitedAccess={viewer.limitedAccess} />
      <DvSectionCard title="Line item" layout="settings">
        <DvSelect
          id="insights-li"
          label="Select a line item"
          value={li}
          onChange={pick}
          placeholder="Select a line item"
          error={issues.find((i) => i.severity === 'error')?.message}
          hint={lineItems.length === 0 ? 'No line items have Optimized Targeting turned on.' : undefined}
          options={lineItems.map((l) => ({ value: l.id, label: l.name, secondLine: `ID ${l.id}` }))}
        />
      </DvSectionCard>
      {data ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: 4, mt: 4 }} data-testid="insights-result">
          {CARD_TITLES.map((c) => (
            <DvSectionCard key={c.key} title={c.title} layout="stacked">
              <Bars rows={rows(data[c.key])} />
            </DvSectionCard>
          ))}
        </Box>
      ) : (
        <Box sx={{ mt: 4 }}>
          <DvBanner kind="info">
            Select a line item. Select only line items that have Optimized Targeting enabled.
          </DvBanner>
        </Box>
      )}
    </>
  );
}
