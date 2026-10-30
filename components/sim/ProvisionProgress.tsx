'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import LinearProgress from '@mui/material/LinearProgress';
import Typography from '@mui/material/Typography';
import { DvBanner } from '@/components/dv/DvBanner';

interface View {
  state: 'NOT_CREATED' | 'QUEUED' | 'BUILDING' | 'READY' | 'FAILED';
  percent: number;
  message: string;
  simDate?: string;
  error?: string;
  overview?: string;
}

/**
 * Progress of the student's sandbox on /sim/welcome (module 18 4.4). Each POST runs one step of the build on the server,
 * so the page drives the job itself when no timer does; it stops when the sandbox is READY and offers the way in.
 */
export function ProvisionProgress({ initial }: { initial: View }) {
  const [view, setView] = useState<View>(initial);
  const busy = useRef(false);

  const call = useCallback(async (retry = false) => {
    if (busy.current) return;
    busy.current = true;
    try {
      const res = await fetch('/api/sim/provision', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ retry }),
      });
      if (res.ok) setView((await res.json()) as View);
    } catch {
      // keep the last state; the next call tries again
    } finally {
      busy.current = false;
    }
  }, []);

  useEffect(() => {
    if (view.state === 'READY' || view.state === 'FAILED') return;
    let stopped = false;
    const loop = async () => {
      while (!stopped) {
        await call();
        await new Promise((r) => setTimeout(r, 1500));
      }
    };
    void loop();
    return () => {
      stopped = true;
    };
  }, [view.state, call]);

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
          We could not prepare your practice account.{view.error ? ` ${view.error}` : ''}
        </DvBanner>
        <Button variant="contained" onClick={() => void call(true)}>
          Try again
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
