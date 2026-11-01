'use client';

import { useEffect } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import LinearProgress from '@mui/material/LinearProgress';
import Typography from '@mui/material/Typography';
import { DvBanner } from '@/components/dv/DvBanner';
import { useProvisionDriver, type ProvisionViewJson } from './useProvisionDriver';

/**
 * Progress of the student's sandbox on /sim/welcome (module 18 4.4). Each POST runs one step of the build on the server,
 * so the page drives the job itself when no timer does (`useProvisionDriver`: one call at a time, backs off, pauses while
 * the tab is hidden); it stops when the sandbox is READY and offers the way in.
 */
export function ProvisionProgress({ initial }: { initial: ProvisionViewJson }) {
  const { view, step, busy } = useProvisionDriver('/api/sim/provision', initial);
  const call = (retry = false) => step({ retry });

  useEffect(() => {
    // the build finished while the student watched: open the sandbox home
    if (view.state === 'READY' && view.overview) window.location.assign(view.overview);
  }, [view.state, view.overview]);

  if (view.state === 'READY') {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Typography>Your practice account is ready.</Typography>
        {view.overview ? (
          <Button href={view.overview} variant="contained">
            Open Overview
          </Button>
        ) : null}
      </Box>
    );
  }
  if (view.state === 'FAILED') {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <DvBanner kind="error">
          We could not prepare your practice account.{view.error ? ` ${view.error}` : ''} Your build
          is saved: Retry starts it again.
        </DvBanner>
        <Button variant="contained" disabled={busy} onClick={() => void call(true)}>
          {busy ? 'Retrying…' : 'Retry'}
        </Button>
      </Box>
    );
  }
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }} data-testid="provision-progress">
      <Typography>Your practice account is being prepared.</Typography>
      <LinearProgress variant="determinate" value={view.percent} aria-label="Preparing" />
      <Typography variant="body2" color="text.secondary">
        {view.message}
        {view.simDate ? ` (${view.simDate})` : ''}
      </Typography>
    </Box>
  );
}
