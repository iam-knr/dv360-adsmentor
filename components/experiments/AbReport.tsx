'use client';

// A/B test report (module 17 S4): control arm, metric, confidence level and date range, KPI tiles with the difference
// to the control and "Best: {arm}", a clustered column chart or daily series, the arm by metric table, End.
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { DvBanner, DvEmptyState, DvSelect, DvSkeleton, DvTabs, DvTooltip, useToast } from '@/components/dv';
import { DvIcon } from '@/components/icons';
import { abCsvAction, abReportAction, endAbTestAction } from '@/lib/experiments/actions';
import { metricsForScope, type AbMetric } from '@/lib/experiments/constants';
import { abSettingsPath, experimentsPath } from '@/lib/experiments/paths';
import type { AbReport as Report, AbTestView, Tile } from '@/lib/experiments/types';
import { AppLink } from '@/lib/routes/AppLink';
import { colors } from '@/lib/theme/tokens';
import { DateInput } from './DateInput';
import { EndDialog } from './EndDialog';
import { dateRangeText, money, STATUS_AB } from './format';

const fmtVal = (t: Tile, v: number | null): string => {
  if (v === null) return '-';
  switch (t.kind) {
    case 'percent':
      return `${v.toFixed(2)}%`;
    case 'money':
      return money(v, t.currency ?? '');
    case 'decimal':
      return v.toLocaleString('en-US', { maximumFractionDigits: 2 });
    default:
      return Math.round(v).toLocaleString('en-US');
  }
};

export function AbReport({
  partnerId,
  advertiserId,
  view,
  initial,
  canWrite,
  canDownload,
}: {
  partnerId: string;
  advertiserId: string;
  view: AbTestView;
  initial: Report;
  canWrite: boolean;
  canDownload: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [report, setReport] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [controlId, setControlId] = useState(initial.controlArmId);
  const [metric, setMetric] = useState<AbMetric>(initial.metric);
  const [confidence, setConfidence] = useState<'P90' | 'P95'>(initial.confidence);
  const [from, setFrom] = useState(initial.range.from);
  const [to, setTo] = useState(initial.range.to);
  const [chart, setChart] = useState<'bars' | 'daily'>('bars');
  const [ending, setEnding] = useState(false);
  const [endError, setEndError] = useState<string | undefined>();
  const [busy, startEnd] = useTransition();
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    let live = true;
    setLoading(true);
    void abReportAction(advertiserId, view.publicId, { controlArmId: controlId, metric, confidence, from, to }).then((r) => {
      if (!live) return;
      if (r) setReport(r);
      setLoading(false);
    });
    return () => {
      live = false;
    };
  }, [advertiserId, view.publicId, controlId, metric, confidence, from, to]);
  // a refreshed server value (after End or a settings save) replaces the local copy
  useEffect(() => setReport(initial), [initial]);

  const armName = (id: string) => report.perArm.find((a) => a.armId === id)?.name ?? id;
  const kindWord = view.target === 'LINE_ITEM' ? 'line items' : 'insertion orders';
  const metrics = metricsForScope(view.channelScope);
  const ended = view.status === 'COMPLETED';
  const palette = colors.chart;

  const download = async () => {
    const f = await abCsvAction(advertiserId, view.publicId, { controlArmId: controlId, metric, confidence, from, to });
    if (!f) return toast.show({ message: "Couldn't create the file." });
    const url = URL.createObjectURL(new Blob([f.body], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = f.fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const confirmEnd = () =>
    startEnd(async () => {
      const res = await endAbTestAction(advertiserId, view.publicId);
      if (!res.ok) return setEndError(res.issues[0]?.message);
      setEnding(false);
      toast.show({ message: 'Test ended.' });
      router.refresh();
    });

  const primary = report.tiles[0];
  const barData = useMemo(
    () => report.perArm.map((a) => ({ name: a.name, value: primary?.arms.find((x) => x.armId === a.armId)?.value ?? 0 })),
    [report, primary],
  );
  const dailyData = useMemo(
    () =>
      (report.series[0]?.points ?? []).map((p, i) => ({
        date: p.date.slice(5),
        ...Object.fromEntries(report.series.map((s) => [s.name, s.points[i]?.value ?? 0])),
      })),
    [report],
  );

  return (
    <Box data-testid="ab-report" sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box>
        <AppLink href={experimentsPath(partnerId, advertiserId)} data-testid="back-to-tests">
          A/B tests ›
        </AppLink>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1, flexWrap: 'wrap' }}>
          <Typography variant="h5" component="h2">
            {view.name}
          </Typography>
          <Chip size="small" label={STATUS_AB[view.status]} color={view.status === 'ACTIVE' ? 'success' : 'default'} data-testid="ab-status" />
          <Box sx={{ flex: 1 }} />
          {canWrite && !ended ? (
            <Button variant="outlined" onClick={() => setEnding(true)}>
              End
            </Button>
          ) : null}
          {canDownload ? (
            <DvTooltip title="Download">
              <IconButton aria-label="Download" onClick={() => void download()}>
                <DvIcon name="download" size={22} />
              </IconButton>
            </DvTooltip>
          ) : null}
          <DvTooltip title="Settings">
            <IconButton aria-label="Settings" component={AppLink} href={abSettingsPath(partnerId, advertiserId, view.publicId)} data-testid="ab-settings-open">
              <DvIcon name="settings" size={22} />
            </IconButton>
          </DvTooltip>
        </Box>
        <Typography color="text.secondary" data-testid="ab-subtitle">
          {`${view.arms.length} arm test comparing ${view.arms.length} ${kindWord}`}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {`Test dates: ${dateRangeText(view.startDate, view.endDate)}   ·   Media spend: ${money(report.media.spend, report.media.currency)} (${report.media.arms} arms)`}
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <Box sx={{ width: 220 }}>
          <DvSelect label="Control arm" value={controlId} onChange={setControlId} options={report.perArm.map((a) => ({ value: a.armId, label: a.name }))} />
        </Box>
        <Box sx={{ width: 240 }}>
          <DvSelect label="Metric" value={metric} onChange={(v) => setMetric(v as AbMetric)} options={metrics.map((m) => ({ value: m.key, label: m.label }))} />
        </Box>
        <Box sx={{ width: 180 }}>
          <DvSelect
            label="Confidence level"
            value={confidence}
            onChange={(v) => setConfidence(v as 'P90' | 'P95')}
            help="The chance that a difference is real and not noise. Higher needs a bigger difference."
            options={[
              { value: 'P90', label: '90%' },
              { value: 'P95', label: '95%' },
            ]}
          />
        </Box>
        <DateInput label="From" value={from} min={view.startDate} onChange={(v) => v && setFrom(v)} />
        <DateInput label="To" value={to} onChange={(v) => v && setTo(v)} />
      </Box>

      {report.notStartedUntil ? (
        <DvBanner kind="info" level="inline">{`This test starts on ${report.notStartedUntil}.`}</DvBanner>
      ) : null}

      {loading ? (
        <DvSkeleton rows={4} height={40} />
      ) : !report.hasData ? (
        <DvEmptyState variant="illustrated" title="No data available" message="Your report did not generate any data" />
      ) : (
        <>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 2 }}>
            {report.tiles.map((t) => (
              <Box key={t.key} data-testid={`tile-${t.key}`} sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 2 }}>
                <Typography variant="subtitle2">{t.label}</Typography>
                {t.arms.map((a) => (
                  <Box key={a.armId} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, mt: 0.5 }}>
                    <Typography variant="body2" color="text.secondary">
                      {armName(a.armId)}
                      {a.armId === report.controlArmId ? ' (control)' : ''}
                    </Typography>
                    <Typography variant="body2">
                      {fmtVal(t, a.value)}
                      {a.diffPct !== null ? (
                        <Box component="span" sx={{ ml: 1, color: a.diffPct >= 0 ? 'success.main' : 'error.main' }}>
                          {`${a.diffPct >= 0 ? '+' : ''}${a.diffPct.toFixed(1)}%`}
                          {a.significant ? <span aria-label="significant" title="Significant"> ★</span> : null}
                        </Box>
                      ) : null}
                    </Typography>
                  </Box>
                ))}
                {t.best ? (
                  <Typography variant="caption" sx={{ mt: 1, display: 'block' }} data-testid={`best-${t.key}`}>
                    {`Best: ${t.best === 'N/A' ? 'N/A' : t.best.name}`}
                  </Typography>
                ) : null}
              </Box>
            ))}
          </Box>

          <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
              <Typography variant="subtitle2" sx={{ flex: 1 }}>
                {`${report.metricLabel} by arm`}
              </Typography>
              <DvTabs
                variant="segmented"
                value={chart}
                onChange={(v) => setChart(v as 'bars' | 'daily')}
                ariaLabel="Chart type"
                tabs={[
                  { id: 'bars', label: 'By arm' },
                  { id: 'daily', label: 'Daily' },
                ]}
              />
            </Box>
            <Box sx={{ height: 260 }} data-testid="ab-chart">
              <ResponsiveContainer width="100%" height="100%">
                {chart === 'bars' ? (
                  <BarChart data={barData} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" name={primary?.label ?? report.metricLabel} fill={palette[0]} />
                  </BarChart>
                ) : (
                  <LineChart data={dailyData} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    {report.series.map((s, i) => (
                      <Line key={s.armId} dataKey={s.name} stroke={palette[i % palette.length] as string} dot={false} />
                    ))}
                  </LineChart>
                )}
              </ResponsiveContainer>
            </Box>
          </Box>

          <Box component="table" aria-label="Arms by metric" sx={{ width: '100%', borderCollapse: 'collapse', '& th, & td': { textAlign: 'left', p: 1, borderBottom: 1, borderColor: 'divider' } }}>
            <thead>
              <tr>
                <th scope="col">Arm</th>
                {report.tiles.map((t) => (
                  <th key={t.key} scope="col">
                    {t.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.perArm.map((a) => (
                <tr key={a.armId}>
                  <td>{a.isControl ? `${a.name} (control)` : a.name}</td>
                  {report.tiles.map((t) => (
                    <td key={t.key}>{fmtVal(t, t.arms.find((x) => x.armId === a.armId)?.value ?? null)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </Box>
          <Typography variant="body2" data-testid="ab-best">
            {report.best === 'N/A' ? 'Best arm: N/A (no arm is significantly different from the control)' : `Best arm: ${report.best.name}`}
          </Typography>
        </>
      )}
      <EndDialog open={ending} name={view.name} noun="test" busy={busy} error={endError} onConfirm={confirmEnd} onCancel={() => { setEnding(false); setEndError(undefined); }} />
    </Box>
  );
}
