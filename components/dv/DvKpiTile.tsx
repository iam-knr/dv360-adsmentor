'use client';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';

export interface DvKpiTileProps {
  label: string;
  value: string | number;
  /** Colour of the accent bar. Red, amber or blue (Overview pacing tiles). */
  accent?: 'error' | 'warning' | 'info';
  onClick?: () => void;
}

const ACCENT = { error: 'status.error', warning: 'status.warning', info: 'status.info' } as const;

/** Overview tile: label, count and a coloured accent bar (design-system 2.20). */
export function DvKpiTile({ label, value, accent = 'info', onClick }: DvKpiTileProps) {
  const body = (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 1,
        p: 4,
        width: '100%',
      }}
    >
      <Typography variant="caption">{label}</Typography>
      <Typography variant="kpiValueSmall">{value}</Typography>
    </Box>
  );
  return (
    <Box
      sx={{
        position: 'relative',
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: '8px',
        overflow: 'hidden',
        minWidth: 160,
        '&::before': {
          content: '""',
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 4,
          bgcolor: ACCENT[accent],
        },
      }}
    >
      {onClick ? (
        <ButtonBase onClick={onClick} sx={{ width: '100%', textAlign: 'left' }}>
          {body}
        </ButtonBase>
      ) : (
        body
      )}
    </Box>
  );
}
