import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { DvPageHeader } from '@/components/dv/DvPageHeader';
import { DvSectionCard } from '@/components/dv/DvSectionCard';
import { pageActor } from '@/lib/accounts/session-actor';
import { formatDateTime } from '@/lib/auth/messages';
import { readClockSummary, readEngineParams, readEngineStatus } from '@/lib/manage/engine';

export const metadata: Metadata = { title: 'Engine | DV360 Simulator by Adsmetor' };
export const dynamic = 'force-dynamic';

const STATES = ['Queued', 'Building', 'Ready', 'Failed'] as const;

// Read only in this release: the parameter file ships with the code, so a change is a code change (docs/gaps/p5-01.md).
export default async function AdminEnginePage() {
  const actor = await pageActor();
  if (actor.role !== 'SUPER_ADMIN') notFound();
  const p = readEngineParams();
  const s = await readEngineStatus();
  const k = await readClockSummary();
  const facts: [string, string][] = [
    ['Engine version', p.hash],
    ['Simulated clock', s.simNow ? formatDateTime(s.simNow) : 'Not started'],
    [
      'Tick cadence',
      p.tickMinutes
        ? `${p.tickMinutes} simulated minutes per tick, run on a timer and on page loads`
        : '-',
    ],
    [
      'Sandbox clocks',
      `${k.running} running, ${k.paused} paused${k.adminPaused ? ` (${k.adminPaused} paused by a Super admin)` : ''}`,
    ],
    [
      'Sandbox speed',
      `1 simulated day per ${k.minutesPerSimDay} real minutes (${k.speedX}x), ${
        k.source === 'default' ? 'default' : k.source === 'env' ? 'set by SANDBOX_SIM_MINUTES_PER_DAY' : 'set in settings'
      }`,
    ],
    ['Timer scope', `Sandboxes whose student was seen in the last ${k.activeDays} days; others catch up when the student returns`],
    ['Last run', s.lastRunAt ? formatDateTime(s.lastRunAt) : 'Never'],
  ];
  return (
    <Box>
      <DvPageHeader title="Engine" />
      <Typography sx={{ mb: 4 }} data-testid="engine-version">
        Version {p.hash} · {p.bytes.toLocaleString('en-US')} bytes · read only
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: 900 }}>
        <DvSectionCard title="Summary">
          <Box
            component="dl"
            sx={{
              m: 0,
              display: 'grid',
              gridTemplateColumns: 'max-content 1fr',
              columnGap: 4,
              rowGap: 1,
            }}
          >
            {facts.map(([k, v]) => (
              <Box key={k} sx={{ display: 'contents' }}>
                <Typography component="dt" variant="subtitle1">
                  {k}
                </Typography>
                <Typography component="dd" sx={{ m: 0 }}>
                  {v}
                </Typography>
              </Box>
            ))}
          </Box>
        </DvSectionCard>
        <DvSectionCard title="Sandboxes">
          <Box
            component="dl"
            data-testid="engine-counts"
            sx={{ m: 0, display: 'flex', gap: 6, flexWrap: 'wrap' }}
          >
            {STATES.map((k) => (
              <Box key={k}>
                <Typography component="dt" variant="caption" color="text.secondary">
                  {k}
                </Typography>
                <Typography component="dd" variant="h6" sx={{ m: 0 }}>
                  {s.counts[k]}
                </Typography>
              </Box>
            ))}
          </Box>
        </DvSectionCard>
        <DvSectionCard title="Parameters">
          <Box
            component="table"
            aria-label="Engine parameters"
            sx={{
              borderCollapse: 'collapse',
              width: '100%',
              '& td, & th': {
                textAlign: 'left',
                verticalAlign: 'top',
                p: 1.5,
                borderBottom: 1,
                borderColor: 'divider',
                overflowWrap: 'anywhere',
              },
              '& td:nth-of-type(3)': { fontFamily: 'monospace', fontSize: 12 },
            }}
          >
            <thead>
              <tr>
                <th>Section</th>
                <th>Parameter</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {p.rows.map((r) => (
                <tr key={`${r.section}.${r.name}`}>
                  <td>{r.section}</td>
                  <td>{r.name}</td>
                  <td>{r.value}</td>
                </tr>
              ))}
            </tbody>
          </Box>
        </DvSectionCard>
        <details data-testid="engine-raw">
          <summary style={{ cursor: 'pointer' }}>Show raw configuration</summary>
          <Box
            component="pre"
            sx={{ fontSize: 12, whiteSpace: 'pre-wrap', maxHeight: 480, overflow: 'auto' }}
          >
            {p.raw}
          </Box>
        </details>
      </Box>
    </Box>
  );
}
