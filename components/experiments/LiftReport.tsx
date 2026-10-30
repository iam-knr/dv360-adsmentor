'use client';

// Lift study report (module 17 S8): tabs YouTube & Demand Gen and Cross Exchange, lift type, Slice by chips, one card per
// metric with exposed against control, the lift and its interval, slice bars and the search lift groups.
import { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { DvEmptyState, DvSelect, DvSkeleton, DvTabs } from '@/components/dv';
import { liftReportAction } from '@/lib/experiments/actions';
import { BRAND_METRIC_LABEL } from '@/lib/experiments/constants';
import { liftStudiesPath } from '@/lib/experiments/paths';
import type { LiftReport as Report } from '@/lib/experiments/types';
import { AppLink } from '@/lib/routes/AppLink';
import { colors } from '@/lib/theme/tokens';
import { pctText } from './format';

const SLICE_LABEL: Record<string, string> = {
  OVERALL: 'Overall',
  AGE: 'Age',
  GENDER: 'Gender',
  INSERTION_ORDER: 'Insertion order',
  LINE_ITEM: 'Line item',
  DEVICE: 'Device',
  YOUTUBE_AD_VIDEO: 'YouTube Ad Video',
  CREATIVE: 'Creative',
  PUBLISHER_DOMAIN: 'Publisher domain',
  PUBLISHER_VERTICAL: 'Publisher vertical',
};

export function LiftReport({
  partnerId,
  advertiserId,
  studyId,
  studyName,
  initial,
}: {
  partnerId: string;
  advertiserId: string;
  studyId: string;
  studyName: string;
  initial: Report;
}) {
  const [report, setReport] = useState(initial);
  const [tab, setTab] = useState(initial.tab);
  const [measure, setMeasure] = useState(initial.liftType);
  const [slice, setSlice] = useState(initial.slice);
  const [loading, setLoading] = useState(false);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    let live = true;
    setLoading(true);
    void liftReportAction(advertiserId, studyId, { tab, liftType: measure, slice }).then((r) => {
      if (!live) return;
      if (r) setReport(r);
      setLoading(false);
    });
    return () => {
      live = false;
    };
  }, [advertiserId, studyId, tab, measure, slice]);

  const measureLabel = measure === 'ABSOLUTE' ? 'Absolute lift' : measure === 'RELATIVE' ? 'Relative lift' : 'Headroom lift';
  const valueOf = (m: Report['metrics'][number]) =>
    measure === 'ABSOLUTE' ? m.absoluteLift : measure === 'RELATIVE' ? m.relativeLift : m.headroomLift;

  return (
    <Box data-testid="lift-report" sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box>
        <AppLink href={liftStudiesPath(partnerId, advertiserId)}>← Brand Lift Report</AppLink>
        <Typography variant="h5" component="h2" sx={{ mt: 1 }}>
          {studyName}
        </Typography>
      </Box>
      <DvTabs
        variant="page"
        value={tab}
        onChange={(t) => {
          setTab(t as 'YT_DG' | 'CROSS_EXCHANGE');
          setSlice('OVERALL');
        }}
        ariaLabel="Report scope"
        tabs={[
          { id: 'YT_DG', label: 'YouTube & Demand Gen' },
          { id: 'CROSS_EXCHANGE', label: 'Cross Exchange' },
        ]}
      />
      <Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <Box sx={{ width: 220 }}>
          <DvSelect
            label="Lift type"
            value={measure}
            onChange={(v) => setMeasure(v as typeof measure)}
            options={[
              { value: 'ABSOLUTE', label: 'Absolute lift' },
              { value: 'RELATIVE', label: 'Relative lift' },
              { value: 'HEADROOM', label: 'Headroom lift' },
            ]}
          />
        </Box>
        <Stat label="Survey responses" value={report.surveyResponses.toLocaleString('en-US')} />
        <Stat label="Insertion orders" value={String(report.insertionOrders)} />
        <Stat label="Line items" value={String(report.lineItems)} />
      </Box>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }} role="group" aria-label="Slice by">
        <Typography variant="body2">Slice by</Typography>
        {report.sliceOptions.map((s) => (
          <Chip key={s} label={SLICE_LABEL[s] ?? s} color={s === slice ? 'primary' : 'default'} variant={s === slice ? 'filled' : 'outlined'} onClick={() => setSlice(s)} aria-pressed={s === slice} />
        ))}
      </Box>
      {loading ? (
        <DvSkeleton rows={4} height={40} />
      ) : report.empty ? (
        <DvEmptyState variant="illustrated" title="No reports available" message="Results appear once the study has collected survey responses." />
      ) : (
        <>
          {report.metrics.map((m) => {
            const v = valueOf(m);
            return (
              <Box key={m.metric} data-testid={`metric-${m.metric}`} sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Typography variant="subtitle1" sx={{ flex: 1 }}>
                    {BRAND_METRIC_LABEL[m.metric]}
                  </Typography>
                  {m.significant ? <Chip size="small" color="success" label="Significant" /> : null}
                </Box>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '320px 1fr' }, gap: 3, mt: 1 }}>
                  <Box sx={{ height: 160 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={[
                          { name: 'Exposed', value: (m.exposedRate ?? 0) * 100 },
                          { name: 'Control', value: (m.baselineRate ?? 0) * 100 },
                        ]}
                      >
                        <CartesianGrid vertical={false} strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis unit="%" />
                        <Tooltip />
                        <Bar dataKey="value" fill={colors.chart[0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                  <Box>
                    <Typography variant="h5" data-testid={`lift-value-${m.metric}`}>
                      {pctText(v, 2)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">{measureLabel}</Typography>
                    {m.ci ? (
                      <Typography variant="body2">{`Interval: ${pctText(m.ci[0], 2)} to ${pctText(m.ci[1], 2)}`}</Typography>
                    ) : null}
                    <Typography variant="caption" color="text.secondary">{`${m.responses.toLocaleString('en-US')} responses`}</Typography>
                  </Box>
                </Box>
                {m.slices.length ? (
                  <Box component="table" aria-label={`${BRAND_METRIC_LABEL[m.metric]} by ${SLICE_LABEL[slice]}`} sx={{ mt: 2, width: '100%', borderCollapse: 'collapse', '& th, & td': { textAlign: 'left', p: 1, borderBottom: 1, borderColor: 'divider' } }}>
                    <thead>
                      <tr>
                        <th scope="col">{SLICE_LABEL[slice]}</th>
                        <th scope="col">{measureLabel}</th>
                        <th scope="col">Responses</th>
                      </tr>
                    </thead>
                    <tbody>
                      {m.slices.map((s) => (
                        <tr key={s.value}>
                          <td>{s.value}</td>
                          <td>{s.enough ? `${pctText(s.lift, 2)}${s.significant ? ' ★' : ''}` : 'Not enough data'}</td>
                          <td>{s.responses.toLocaleString('en-US')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Box>
                ) : null}
              </Box>
            );
          })}
          {report.search ? (
            <Box data-testid="search-lift" sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 2 }}>
              <Typography variant="subtitle1">Search lift</Typography>
              {report.search.groups.map((g, i) => (
                <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                  <Typography variant="body2">{g.terms.join(', ')}</Typography>
                  <Typography variant="body2">
                    {`${pctText(g.relUplift, 1)} relative uplift`}
                    {g.significant ? ' ★' : ''}
                  </Typography>
                </Box>
              ))}
            </Box>
          ) : null}
        </>
      )}
    </Box>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" display="block">
        {label}
      </Typography>
      <Typography variant="h6">{value}</Typography>
    </Box>
  );
}
