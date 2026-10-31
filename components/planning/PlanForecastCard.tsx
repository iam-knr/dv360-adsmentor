'use client';

// Forecast summary card, KPI strip and the five-tab detail card of the plan page (module 04 2.2, 2.3).
// Tile switching and the metric dropdowns are local: no server call (AC-04-14).
import { useState, type ReactElement, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { DvEmptyState, DvSelect, DvSpinner, DvTabs, useToast } from '@/components/dv';
import { DvIcon } from '@/components/icons';
import { demographicsLabel, type PlanDemographics } from '@/lib/planning/countries';
import { fmtCompact, fmtDate, fmtMoney, fmtPct } from '@/lib/planning/table';
import type { ForecastTabKey, PlanForecast } from '@/lib/planning/types';
import { colors } from '@/lib/theme/tokens';

interface TileOption {
  id: string;
  label: string;
  value: (f: PlanForecast, cur: string) => string;
}
interface TileDef {
  id: string;
  options: TileOption[];
}

const T = (id: string, label: string, value: TileOption['value']): TileOption => ({
  id,
  label,
  value,
});
const freq = (n: number) => (f: PlanForecast) => fmtPct(f.reachByFrequency[n] ?? f.reachPct);

export const KPI_TILES: TileDef[] = [
  {
    id: 'reach',
    options: [
      T('r1', '1+ on-target reach', (f) => fmtPct(f.reachPct)),
      T('r2', '2+ on-target reach', freq(1)),
      T('r3', '3+ on-target reach', freq(2)),
    ],
  },
  { id: 'freq', options: [T('freq', 'Avg. frequency', (f) => f.avgFrequency.toFixed(2))] },
  {
    id: 'cpm',
    options: [
      T('cpm', 'Total CPM', (f, c) => fmtMoney(f.totalCpm, c)),
      T('otcpm', 'On-target CPM', (f, c) => fmtMoney(f.onTargetCpm, c)),
    ],
  },
  { id: 'trps', options: [T('trps', 'Census TRPs', (f) => String(Math.round(f.trps)))] },
  { id: 'cpp', options: [T('cpp', 'Census CPP', (f, c) => fmtMoney(f.cpp, c))] },
  {
    id: 'pop',
    options: [
      T('census', 'Census population', (f) => fmtCompact(f.population.census)),
      T('digital', 'Digital population', (f) => fmtCompact(f.population.digital)),
      T('tv', 'TV population', (f) => fmtCompact(f.population.tv)),
      T('yt', 'YouTube population', (f) => fmtCompact(f.population.youtube)),
    ],
  },
  {
    id: 'cpa',
    options: [
      T('cpa', 'CPA', (f, c) => (f.cpa === null ? '-' : fmtMoney(f.cpa, c))),
      T('acpa', 'Action CPA', (f, c) => (f.actionCpa === null ? '-' : fmtMoney(f.actionCpa, c))),
    ],
  },
  {
    id: 'ytpop',
    options: [T('ytpop', 'YouTube population', (f) => fmtCompact(f.population.youtube))],
  },
  { id: 'vcpm', options: [T('vcpm', 'Viewable CPM', (f, c) => fmtMoney(f.viewableCpm, c))] },
  { id: 'vrate', options: [T('vrate', 'Viewability rate', (f) => fmtPct(f.viewabilityRate))] },
];

function Tile({
  def,
  forecast,
  currency,
}: {
  def: TileDef;
  forecast: PlanForecast;
  currency: string;
}) {
  const [idx, setIdx] = useState(0);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const opt = def.options[idx] as TileOption;
  const multi = def.options.length > 1;
  const body = (
    <Box sx={{ textAlign: 'left', px: 3, py: 2, minWidth: 150 }}>
      <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        {opt.label}
        {multi ? <DvIcon name="arrow_drop_down" size={18} /> : null}
      </Typography>
      <Typography variant="h5" component="p" data-testid={`kpi-${def.id}`}>
        {opt.value(forecast, currency)}
      </Typography>
    </Box>
  );
  return (
    <Box
      data-testid="kpi-tile"
      sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px', flexShrink: 0 }}
    >
      {multi ? (
        <>
          <ButtonBase
            aria-haspopup="menu"
            aria-label={`${opt.label}: ${opt.value(forecast, currency)}. Change metric`}
            onClick={(e) => setAnchor(e.currentTarget)}
            sx={{ display: 'block', borderRadius: '8px' }}
          >
            {body}
          </ButtonBase>
          <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
            {def.options.map((o, i) => (
              <MenuItem
                key={o.id}
                selected={i === idx}
                onClick={() => {
                  setIdx(i);
                  setAnchor(null);
                }}
              >
                {o.label}
              </MenuItem>
            ))}
          </Menu>
        </>
      ) : (
        body
      )}
    </Box>
  );
}

/** True when a Max CPM limits delivery, so the forecast spend is below the budget of the line items. */
export const underSpends = (f: PlanForecast): boolean =>
  f.plannedBudget !== undefined && f.budget < f.plannedBudget - 0.5;

export function PlanSummary({
  forecast,
  demographics,
  currency,
  forecasting,
  hasRows,
}: {
  forecast: PlanForecast | null;
  demographics: PlanDemographics;
  currency: string;
  forecasting: boolean;
  hasRows: boolean;
}) {
  return (
    <Box
      component="section"
      aria-label="Forecast summary"
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: '8px',
        bgcolor: 'background.paper',
        p: 4,
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        {forecasting ? <DvSpinner label="Forecasting" /> : null}
        {forecast && hasRows ? (
          <Typography variant="h5" component="h2" data-testid="forecast-headline">
            You could reach {fmtPct(forecast.reachPct)} of people {demographicsLabel(demographics)}{' '}
            with {fmtMoney(forecast.plannedBudget ?? forecast.budget, currency)}
          </Typography>
        ) : (
          <Typography variant="h5" component="h2">
            Forecast
          </Typography>
        )}
        {forecast ? (
          <Box
            component="span"
            data-testid="forecast-asof"
            sx={{
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              borderRadius: '12px',
              px: 1.5,
              py: 0.25,
              typography: 'caption',
              fontWeight: 500,
            }}
          >
            FORECAST AS OF {fmtDate(forecast.asOf.slice(0, 10)).toUpperCase()}
          </Box>
        ) : null}
      </Box>
      {forecast && hasRows && underSpends(forecast) ? (
        <Typography variant="body2" color="text.secondary" data-testid="forecast-spend-note">
          Expected spend is {fmtMoney(forecast.budget, currency)} of the{' '}
          {fmtMoney(forecast.plannedBudget ?? forecast.budget, currency)} in your line items, because
          a Max. CPM is below the expected CPM.
        </Typography>
      ) : null}
      {forecast ? (
        <Box
          data-testid="kpi-strip"
          sx={{ display: 'flex', gap: 2, overflowX: 'auto', pb: 1 }}
          role="group"
          aria-label="Forecast metrics"
        >
          {KPI_TILES.map((d) => (
            <Tile key={d.id} def={d} forecast={forecast} currency={currency} />
          ))}
        </Box>
      ) : (
        <Typography variant="body2" color="text.secondary">
          Add a plan line item and save to see a forecast.
        </Typography>
      )}
    </Box>
  );
}

// ---- Detail card ------------------------------------------------------------------------------

const TABS: { id: ForecastTabKey; label: string }[] = [
  { id: 'REACH', label: 'Reach' },
  { id: 'TRUEVIEW', label: 'TrueView views' },
  { id: 'CONVERSIONS', label: 'Conversions' },
  { id: 'DEMOGRAPHICS', label: 'Demographics' },
  { id: 'DEVICES', label: 'Devices' },
];
const METRICS: Record<ForecastTabKey, { value: string; label: string }[]> = {
  REACH: [
    { value: 'reachPct', label: 'On-target % reach' },
    { value: 'reach', label: 'On-target reach' },
    { value: 'avgFrequency', label: 'Avg. frequency' },
  ],
  TRUEVIEW: [
    { value: 'views', label: 'Views' },
    { value: 'cpv', label: 'CPV' },
  ],
  CONVERSIONS: [
    { value: 'conversions', label: 'Conversions' },
    { value: 'cpa', label: 'CPA' },
  ],
  DEMOGRAPHICS: [
    { value: 'reachPct', label: 'On-target % reach' },
    { value: 'impressions', label: 'Impressions' },
  ],
  DEVICES: [
    { value: 'reachPct', label: 'On-target % reach' },
    { value: 'impressions', label: 'Impressions' },
  ],
};
const SERIES = colors.chart;

export function PlanForecastTabs({
  forecast,
  emptyState,
  stale,
}: {
  forecast: PlanForecast | null;
  /** Replaces the chart (locked plan, no rows). */
  emptyState: ReactNode;
  stale: boolean;
}) {
  const toast = useToast();
  const [tab, setTab] = useState<ForecastTabKey>('REACH');
  const [metric, setMetric] = useState<Record<ForecastTabKey, string>>({
    REACH: 'reachPct',
    TRUEVIEW: 'views',
    CONVERSIONS: 'conversions',
    DEMOGRAPHICS: 'reachPct',
    DEVICES: 'reachPct',
  });
  const m = metric[tab];
  const data = forecast?.tabs[tab] ?? [];
  const label = METRICS[tab].find((x) => x.value === m)?.label ?? m;

  let chart: ReactNode = null;
  if (tab === 'REACH') {
    chart = (
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="label" label={{ value: 'Budget', position: 'insideBottom', offset: -2 }} />
        <YAxis yAxisId="l" tickFormatter={(v: number) => fmtCompact(v)} />
        <YAxis yAxisId="r" orientation="right" />
        <Tooltip />
        <Legend />
        <Line yAxisId="l" dataKey={m} name={label} stroke={SERIES[0]} strokeWidth={2} />
        {m !== 'avgFrequency' ? (
          <Line
            yAxisId="r"
            dataKey="avgFrequency"
            name="Avg. frequency"
            stroke={SERIES[2]}
            strokeWidth={2}
            strokeDasharray="4 3"
          />
        ) : null}
      </LineChart>
    );
  } else {
    const keys =
      tab === 'DEMOGRAPHICS'
        ? [`${m}_Male`, `${m}_Female`]
        : tab === 'DEVICES'
          ? [`${m}_all`]
          : [m];
    const names = tab === 'DEMOGRAPHICS' ? ['Male', 'Female'] : [label];
    chart = (
      <BarChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="label" />
        <YAxis tickFormatter={(v: number) => fmtCompact(v)} />
        <Tooltip />
        <Legend />
        {keys.map((k, i) => (
          <Bar key={k} dataKey={k} name={names[i] ?? label} fill={SERIES[i] ?? SERIES[0]} />
        ))}
      </BarChart>
    );
  }

  return (
    <Box
      component="section"
      aria-label="Forecast detail"
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: '8px',
        bgcolor: 'background.paper',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 3, flexWrap: 'wrap' }}>
        <Box sx={{ flex: 1, minWidth: 320 }}>
          <DvTabs
            variant="card"
            ariaLabel="Forecast tabs"
            tabs={TABS}
            value={tab}
            onChange={(id) => setTab(id as ForecastTabKey)}
          />
        </Box>
        <DvSelect
          small
          ariaLabel="Forecast metric"
          value={m}
          options={METRICS[tab]}
          onChange={(v) => setMetric((s) => ({ ...s, [tab]: v }))}
        />
        <Typography variant="caption">What do you think of this forecast?</Typography>
        <IconButton
          size="small"
          aria-label="Good forecast"
          onClick={() => toast.show({ message: 'Thanks for your feedback.' })}
        >
          <DvIcon name="thumb_up_off_alt" size={20} />
        </IconButton>
        <IconButton
          size="small"
          aria-label="Bad forecast"
          onClick={() => toast.show({ message: 'Thanks for your feedback.' })}
        >
          <DvIcon name="thumb_down_off_alt" size={20} />
        </IconButton>
      </Box>
      <Box sx={{ p: 3 }}>
        {stale ? (
          <Typography variant="caption" color="text.secondary" role="status">
            Forecast is out of date. Save to refresh.
          </Typography>
        ) : null}
        {forecast && !emptyState ? (
          <Box sx={{ height: 300 }} data-testid={`chart-${tab}`}>
            <ResponsiveContainer width="100%" height="100%">
              {chart as ReactElement}
            </ResponsiveContainer>
          </Box>
        ) : (
          (emptyState ?? (
            <DvEmptyState variant="inline" message="Add a plan line item to see a forecast" />
          ))
        )}
      </Box>
    </Box>
  );
}
