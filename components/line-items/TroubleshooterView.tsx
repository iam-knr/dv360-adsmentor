'use client';

// Troubleshooter page body (module 08 2.9): banner, filters, four KPI tiles, the five-stage Sankey and one reason table
// per stage. View only for every role; the filters change the URL and the server re-reads the diagnostics.
import { useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Typography from '@mui/material/Typography';
import { DvBanner, DvKpiTile } from '@/components/dv';
import type { ReasonRow, StageKey } from '@/lib/troubleshooter/build';
import type { TroubleshooterData } from '@/lib/troubleshooter/service';

const RANGES: { value: string; label: string }[] = [
  { value: 'LAST_7_DAYS', label: 'Last 7 days' },
  { value: 'LAST_14_DAYS', label: 'Last 14 days' },
  { value: 'LAST_30_DAYS', label: 'Last 30 days' },
  { value: 'YESTERDAY', label: 'Yesterday' },
  { value: 'LIFETIME', label: 'Lifetime' },
];

const fmt = (n: number) => n.toLocaleString('en-US');
const pct = (p: number) => `${(p * 100).toFixed(1)}%`;

export function TroubleshooterView({
  data,
  downloadHref,
  range,
}: {
  data: TroubleshooterData;
  downloadHref: string;
  range: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [hot, setHot] = useState<string | null>(null);
  const go = (inventory: string, d: string) => {
    const q = new URLSearchParams();
    if (inventory !== 'ALL') q.set('inventory', inventory);
    q.set('d', d);
    router.push(`${pathname}?${q.toString()}`);
  };
  const b = data.banner;
  return (
    <Box sx={{ p: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
      {b ? (
        <Box data-testid="ts-banner" data-code={b.code}>
          <DvBanner
            kind={b.severity === 'ERROR' ? 'error' : b.severity === 'WARNING' ? 'warning' : 'info'}
            level="page"
            {...(b.action && b.href ? { links: [{ label: b.action.label, href: b.href }] } : {})}
          >
            {b.text}
          </DvBanner>
        </Box>
      ) : null}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="body2" component="label" id="ts-inv-label">
            Inventory
          </Typography>
          <Select
            size="small"
            value={data.inventory}
            inputProps={{ 'aria-labelledby': 'ts-inv-label', 'data-testid': 'ts-inventory' }}
            onChange={(e) => go(e.target.value, range)}
          >
            {data.inventoryOptions.map((o) => (
              <MenuItem key={o.key} value={o.key}>
                {o.label}
              </MenuItem>
            ))}
          </Select>
        </Box>
        <Select
          size="small"
          value={range}
          inputProps={{ 'aria-label': 'Date range', 'data-testid': 'ts-range' }}
          onChange={(e) => go(data.inventory, e.target.value)}
        >
          {RANGES.map((r) => (
            <MenuItem key={r.value} value={r.value}>
              {r.label}
            </MenuItem>
          ))}
        </Select>
        <Typography variant="caption">
          {data.range.from} to {data.range.to}
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Link href={downloadHref} data-testid="ts-download">
          Download
        </Link>
      </Box>
      <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap' }} data-testid="ts-kpis">
        <DvKpiTile label="Total available requests" value={fmt(data.kpis.availableRequests)} />
        <DvKpiTile label="Bid responses" value={fmt(data.kpis.bidResponses)} />
        <DvKpiTile label="Impressions won" value={fmt(data.kpis.impressionsWon)} />
        <DvKpiTile label="Win rate" value={pct(data.kpis.winRate)} />
      </Box>
      {data.funnel ? (
        <>
          <Sankey data={data} hot={hot} onHot={setHot} />
          {data.stages.map((st) =>
            st.filtered ? (
              <ReasonTable
                key={st.key}
                stageKey={st.key}
                stageLabel={st.label}
                total={st.total}
                title={st.filtered.tableTitle}
                pctOf={st.filtered.pctOf}
                rows={st.filtered.rows}
                hot={hot}
                onHot={setHot}
              />
            ) : null,
          )}
        </>
      ) : null}
    </Box>
  );
}

const COLS: StageKey[] = ['AVAILABLE', 'ELIGIBLE', 'BIDS', 'RESPONSES', 'WON'];

function Sankey({
  data,
  hot,
  onHot,
}: {
  data: TroubleshooterData;
  hot: string | null;
  onHot: (k: string | null) => void;
}) {
  const W = 880;
  const H = 220;
  const NODE = 14;
  const max = Math.max(1, data.kpis.availableRequests);
  const pos = useMemo(() => {
    const p = new Map<StageKey, { x: number; h: number }>();
    COLS.forEach((k, i) => {
      const total = data.stages.find((s) => s.key === k)?.total ?? 0;
      p.set(k, { x: 8 + i * ((W - 16 - NODE) / 4), h: Math.max(2, (total / max) * (H - 20)) });
    });
    return p;
  }, [data.stages, max]);
  return (
    <Box
      component="svg"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Delivery funnel"
      data-testid="ts-sankey"
      sx={{
        width: '100%',
        maxWidth: W,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: '8px',
      }}
    >
      {data.flows.map((f, i) => {
        const from = pos.get(f.from);
        if (!from) return null;
        const to = f.to === 'FILTERED' ? null : pos.get(f.to);
        const h = Math.max(1, (f.value / max) * (H - 20));
        const x1 = from.x + NODE;
        if (!to) {
          const key = `${f.from}`;
          return (
            <Box
              component="rect"
              key={i}
              x={x1}
              y={H - 10 - h}
              width={36}
              height={h}
              sx={{ fill: 'status.error' }}
              opacity={hot === key ? 0.9 : 0.35}
              data-testid={`ts-link-${f.from}-FILTERED`}
              onMouseEnter={() => onHot(key)}
              onMouseLeave={() => onHot(null)}
            >
              <title>{`${fmt(f.value)} filtered`}</title>
            </Box>
          );
        }
        const x2 = to.x;
        const mid = (x1 + x2) / 2;
        return (
          <Box
            component="path"
            key={i}
            d={`M${x1},${10 + h / 2} C${mid},${10 + h / 2} ${mid},${10 + h / 2} ${x2},${10 + h / 2}`}
            sx={{ stroke: 'primary.main', fill: 'none' }}
            strokeWidth={h}
            opacity={0.3}
            data-testid={`ts-link-${f.from}-${f.to}`}
          >
            <title>{`${fmt(f.value)} continue`}</title>
          </Box>
        );
      })}
      {COLS.map((k) => {
        const p = pos.get(k);
        const st = data.stages.find((s) => s.key === k);
        if (!p || !st) return null;
        return (
          <g key={k} data-testid={`ts-node-${k}`}>
            <Box
              component="rect"
              x={p.x}
              y={10}
              width={NODE}
              height={p.h}
              sx={{ fill: 'primary.main' }}
            />
            <text x={p.x} y={H - 1} fontSize={10} fill="currentColor">
              {st.label}
            </text>
          </g>
        );
      })}
    </Box>
  );
}

function ReasonTable({
  stageKey,
  stageLabel,
  total,
  title,
  pctOf,
  rows,
  hot,
  onHot,
}: {
  stageKey: StageKey;
  stageLabel: string;
  total: number;
  title: string;
  pctOf: string;
  rows: ReasonRow[];
  hot: string | null;
  onHot: (k: string | null) => void;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  return (
    <Box
      component="section"
      aria-label={title}
      data-testid={`ts-table-${stageKey}`}
      sx={{
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: hot === stageKey ? 'primary.main' : 'divider',
        borderRadius: '8px',
        p: 4,
      }}
    >
      <Typography variant="h6" component="h3">
        {stageLabel}: {fmt(total)}
      </Typography>
      <Typography variant="subtitle2" component="h4" sx={{ mt: 2 }}>
        {title}
      </Typography>
      {rows.length === 0 ? (
        <Typography variant="body2" sx={{ mt: 2 }}>
          Nothing was filtered at this stage.
        </Typography>
      ) : (
        <Box component="table" sx={{ width: '100%', mt: 2, borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <Box component="th" sx={{ textAlign: 'left' }}>
                Reason
              </Box>
              <Box component="th" sx={{ textAlign: 'right' }}>
                Impressions
              </Box>
              <Box component="th" sx={{ textAlign: 'right' }}>
                % of {pctOf}
              </Box>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <RowView
                key={r.code}
                row={r}
                open={!!open[r.code]}
                onToggle={() => setOpen((o) => ({ ...o, [r.code]: !o[r.code] }))}
                onHot={() => onHot(stageKey)}
                onLeave={() => onHot(null)}
              />
            ))}
          </tbody>
        </Box>
      )}
    </Box>
  );
}

function RowView({
  row,
  open,
  onToggle,
  onHot,
  onLeave,
}: {
  row: ReasonRow;
  open: boolean;
  onToggle: () => void;
  onHot: () => void;
  onLeave: () => void;
}) {
  const kids = row.children ?? [];
  return (
    <>
      <tr data-testid={`ts-row-${row.code}`} onMouseEnter={onHot} onMouseLeave={onLeave}>
        <td>
          {kids.length > 0 ? (
            <Link
              component="button"
              type="button"
              aria-expanded={open}
              onClick={onToggle}
              sx={{ font: 'inherit' }}
            >
              {open ? '▾' : '▸'} {row.label}
            </Link>
          ) : (
            row.label
          )}
        </td>
        <Box component="td" sx={{ textAlign: 'right' }}>
          {fmt(row.count)}
        </Box>
        <Box component="td" sx={{ textAlign: 'right' }}>
          {pct(row.pct)}
        </Box>
      </tr>
      {open
        ? kids.map((c) => (
            <tr key={c.code} data-testid={`ts-row-${c.code}`}>
              <Box component="td" sx={{ pl: 6 }}>
                {c.label}
              </Box>
              <Box component="td" sx={{ textAlign: 'right' }}>
                {fmt(c.count)}
              </Box>
              <Box component="td" sx={{ textAlign: 'right' }}>
                {pct(c.pct)}
              </Box>
            </tr>
          ))
        : null}
    </>
  );
}
