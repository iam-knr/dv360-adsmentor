'use client';

import { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import Typography from '@mui/material/Typography';
import { formatElapsed } from '@/lib/sandbox/labels';

export interface BuildProgressProps {
  percent: number;
  /** Name of the current step, e.g. "Loading your history". */
  step: string;
  simDate?: string;
}

/**
 * Progress of a sandbox build. The percentage moves in jumps and can sit still for a minute while a step runs, so the bar
 * is indeterminate (it always moves) and the elapsed time keeps counting: the page never looks stuck.
 */
export function BuildProgress({ percent, step, simDate }: BuildProgressProps) {
  const started = useRef(Date.now());
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <Box
      data-testid="build-progress"
      role="status"
      aria-live="polite"
      sx={{ display: 'flex', flexDirection: 'column', gap: 1, maxWidth: 420 }}
    >
      <LinearProgress
        variant="indeterminate"
        aria-label="Building the sandbox"
        sx={{ '@media (prefers-reduced-motion: reduce)': { animationDuration: '6s' } }}
      />
      <Typography variant="body2" color="text.secondary">
        {step || 'Working'}
        {simDate ? ` (${simDate})` : ''} · {percent}% · elapsed{' '}
        <span data-testid="build-elapsed">{formatElapsed(now - started.current)}</span>
      </Typography>
    </Box>
  );
}
