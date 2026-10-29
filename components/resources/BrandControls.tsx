'use client';

// Brand controls "Settings overview" (module 15 S1): five coverage rows (four at partner level), View breakdown
// slide-over, IVT card. Computed on the server at read time (lib/resources/brand-controls.ts).
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import {
  DvChartCard,
  DvCoverageBar,
  DvPageHeader,
  DvSectionCard,
  DvSelect,
  DvSlideOver,
  DvTabs,
} from '@/components/dv';
import { useViewer } from '@/components/shell/ViewerProvider';
import type { BrandControlsView, BrandRowKey } from '@/lib/resources/wire';

export function BrandControls({ view, basePath }: { view: BrandControlsView; basePath: string }) {
  const router = useRouter();
  const { viewer } = useViewer();
  const [open, setOpen] = useState<BrandRowKey | null>(null);
  const go = (tab: string, filter: string) =>
    router.push(`${basePath}?${new URLSearchParams({ tab, filter }).toString()}`);
  const row = view.rows.find((r) => r.key === open);

  return (
    <>
      <DvPageHeader title="Settings overview" limitedAccess={viewer.limitedAccess}>
        <DvTabs
          tabs={[
            { id: 'display', label: 'Display and Video' },
            { id: 'youtube', label: 'YouTube' },
          ]}
          value={view.tab}
          onChange={(t) => go(t, view.filter)}
          ariaLabel="Brand controls"
        />
      </DvPageHeader>
      <Box sx={{ mb: 3, maxWidth: 240 }}>
        <DvSelect
          ariaLabel="Line item filter"
          value={view.filter}
          options={[
            { value: 'active', label: 'Active line items' },
            { value: 'all', label: 'All line items' },
          ]}
          onChange={(f) => go(view.tab, f)}
        />
      </Box>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { md: '2fr 1fr' },
          gap: 4,
          alignItems: 'start',
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {view.rows.map((r) => (
            <DvSectionCard key={r.key} title={r.title}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <DvCoverageBar done={r.enabled} total={r.total} noun="Line items" />
                <Typography variant="body2">{r.summary}</Typography>
                <Button
                  variant="text"
                  sx={{ alignSelf: 'flex-start' }}
                  onClick={() => setOpen(r.key)}
                >
                  View breakdown
                </Button>
              </Box>
            </DvSectionCard>
          ))}
          <Box sx={{ display: 'flex', gap: 3 }}>
            <Typography variant="caption">Enabled (blue)</Typography>
            <Typography variant="caption">Disabled (grey)</Typography>
          </Box>
        </Box>
        <DvChartCard
          title="Invalid traffic filtered pre-bid"
          empty={
            view.ivt.length === 0 ? (
              <Typography variant="body2">No data available</Typography>
            ) : undefined
          }
        >
          <Box
            component="ul"
            aria-label="Invalid traffic by day"
            sx={{ listStyle: 'none', p: 0, m: 0 }}
          >
            {view.ivt.slice(-14).map((d) => (
              <li key={d.date}>
                <Typography variant="caption">
                  {d.date}: {d.blockedPct.toFixed(2)}% filtered
                </Typography>
              </li>
            ))}
          </Box>
        </DvChartCard>
      </Box>
      {open && row ? (
        <DvSlideOver open title={row.title} width="wide" onCancel={() => setOpen(null)}>
          <Box
            component="table"
            aria-label="Breakdown"
            sx={{ width: '100%', borderCollapse: 'collapse' }}
          >
            <thead>
              <tr>
                <th align="left">Line item</th>
                <th align="left">Status</th>
                <th align="left">Enabled?</th>
                <th align="left">Source</th>
              </tr>
            </thead>
            <tbody>
              {view.breakdown[open].map((b) => (
                <tr key={b.lineItemId}>
                  <td>{b.name}</td>
                  <td>{b.status.toLowerCase()}</td>
                  <td>{b.enabled ? '✓' : '✗'}</td>
                  <td>{b.source}</td>
                </tr>
              ))}
            </tbody>
          </Box>
        </DvSlideOver>
      ) : null}
    </>
  );
}
