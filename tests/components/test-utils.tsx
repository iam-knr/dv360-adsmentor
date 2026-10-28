import type { ReactElement } from 'react';
import { afterEach } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { DvToastProvider } from '@/components/dv';
import { theme } from '@/lib/theme/theme';

// Vitest globals are off, so Testing Library does not clean up on its own.
afterEach(cleanup);

/** Fixed simulator clock used by date tests: Wednesday 28 October 2026. */
export const TODAY = new Date(2026, 9, 28);

/** Render inside the design-system theme and the toast host, like the app does. */
export function renderDv(ui: ReactElement) {
  return render(
    <ThemeProvider theme={theme}>
      <DvToastProvider>{ui}</DvToastProvider>
    </ThemeProvider>,
  );
}
