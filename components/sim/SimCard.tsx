import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

/** Centred card used by the login, closed, expired and forbidden pages. */
export function SimCard({
  title,
  children,
  width = 440,
}: {
  title: string;
  children: ReactNode;
  width?: number;
}) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', px: 4, py: 12 }}>
      <Box
        sx={{
          width: '100%',
          maxWidth: width,
          bgcolor: 'background.paper',
          border: 1,
          borderColor: 'divider',
          borderRadius: 2,
          p: 8,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        <Typography variant="pageTitle" component="h1">
          {title}
        </Typography>
        {children}
      </Box>
    </Box>
  );
}
