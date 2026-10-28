'use client';

import Box from '@mui/material/Box';
import type { ReactNode } from 'react';

/** Keycap pill: 1 px border, radius 4, mono face (design-system 2.11, 2.20). */
export function DvKbd({ children }: { children: ReactNode }) {
  return (
    <Box
      component="kbd"
      sx={{
        typography: 'mono',
        display: 'inline-block',
        px: 1.5,
        py: 0.5,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: '4px',
        bgcolor: 'background.paper',
        color: 'text.primary',
      }}
    >
      {children}
    </Box>
  );
}
