'use client';

import type { ReactNode } from 'react';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter';

// Default MUI theme. P3-04 replaces it with the design-system theme.
const theme = createTheme({
  typography: { fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif' },
});

export function ThemeRegistry({ children }: { children: ReactNode }) {
  return (
    <AppRouterCacheProvider>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}
