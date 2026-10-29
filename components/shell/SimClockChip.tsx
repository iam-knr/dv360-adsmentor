'use client';

// Sim clock chip (routes.md 4.1 item 7, RT Q13): simulated date and time, speed and pause state. Read only for
// students: a click opens a popover with the same facts, no controls (clock controls are Phase 5).
import { useState } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Popover from '@mui/material/Popover';
import Typography from '@mui/material/Typography';
import { DvIcon } from '@/components/icons';
import { useViewer } from './ViewerProvider';

export function formatSimTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function SimClockChip() {
  const { clock } = useViewer().chrome;
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  if (!clock) return null;
  const paused = clock.state !== 'RUNNING';
  const when = formatSimTime(clock.simNow, clock.timeZone);
  const label = `Sim ${when}${paused ? ' · Paused' : ` · ${clock.speedX}x`}`;
  return (
    <>
      <Chip
        size="small"
        variant="outlined"
        icon={<DvIcon name={paused ? 'pause_circle' : 'schedule'} size={16} />}
        label={label}
        aria-label={`Simulated time: ${label}`}
        onClick={(e) => setAnchor(e.currentTarget)}
        data-testid="sim-clock"
      />
      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
        slotProps={{
          paper: { role: 'dialog', 'aria-label': 'Simulated clock', sx: { p: 4, width: 280 } },
        }}
      >
        <Typography variant="subtitle1" component="h2">
          Simulated clock
        </Typography>
        <Box sx={{ mt: 2, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 1, columnGap: 3 }}>
          <Typography variant="body2">Sim time</Typography>
          <Typography variant="body2">{when}</Typography>
          <Typography variant="body2">Speed</Typography>
          <Typography variant="body2">{`${clock.speedX}x`}</Typography>
          <Typography variant="body2">State</Typography>
          <Typography variant="body2">{paused ? 'Paused' : 'Running'}</Typography>
        </Box>
        <Typography variant="caption" sx={{ display: 'block', mt: 2 }}>
          Your instructor controls the clock.
        </Typography>
      </Popover>
    </>
  );
}
