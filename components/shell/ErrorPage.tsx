'use client';

// Error page (routes.md 6.5): "Something went wrong. Try again." with a Reload button.
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

export const ERROR_TEXT = 'Something went wrong. Try again.';

export function ErrorPage({ onRetry }: { onRetry?: () => void }) {
  return (
    <Box
      component="main"
      role="alert"
      sx={{
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        p: 6,
      }}
    >
      <Typography variant="h5" component="h1">
        {ERROR_TEXT}
      </Typography>
      <Button variant="contained" onClick={() => (onRetry ? onRetry() : window.location.reload())}>
        Reload
      </Button>
    </Box>
  );
}
