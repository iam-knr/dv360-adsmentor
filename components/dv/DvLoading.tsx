'use client';

import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import LinearProgress from '@mui/material/LinearProgress';
import { keyframes } from '@mui/material/styles';

/** 24 px circular spinner, thickness 4, centred (design-system 2.15). */
export function DvSpinner({ size = 24, label = 'Loading' }: { size?: number; label?: string }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
      <CircularProgress size={size} thickness={4} aria-label={label} />
    </Box>
  );
}

const shimmer = keyframes`
  0% { opacity: 1; }
  50% { opacity: 0.55; }
  100% { opacity: 1; }
`;

export interface DvSkeletonProps {
  /** Width in px or any CSS width. Default fills the container. */
  width?: number | string;
  height?: number;
  /** Number of stacked bars. */
  rows?: number;
}

/** Grey bar placeholder with a 1.2 s shimmer. Static under reduced motion (theme baseline). */
export function DvSkeleton({ width = '100%', height = 12, rows = 1 }: DvSkeletonProps) {
  return (
    <Box aria-hidden="true" data-skeleton sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {Array.from({ length: rows }, (_, i) => (
        <Box
          key={i}
          sx={{
            width,
            height,
            borderRadius: '4px',
            bgcolor: 'surface.skeleton',
            animation: `${shimmer} 1.2s ease-in-out infinite`,
          }}
        />
      ))}
    </Box>
  );
}

/** 4 px indeterminate bar pinned under the app bar. Appears after 150 ms (design-system 2.15). */
export function DvRouteProgress({ active, delayMs = 150 }: { active: boolean; delayMs?: number }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!active) {
      setVisible(false);
      return;
    }
    const t = setTimeout(() => setVisible(true), delayMs);
    return () => clearTimeout(t);
  }, [active, delayMs]);
  if (!visible) return null;
  return (
    <LinearProgress
      aria-label="Loading page"
      sx={{
        position: 'fixed',
        left: 0,
        right: 0,
        top: (t) => t.custom.appBarHeight,
        zIndex: (t) => t.zIndex.appBar,
      }}
    />
  );
}
