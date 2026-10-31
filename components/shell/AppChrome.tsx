'use client';

// (app) chrome (routes.md 5.1, design-system 4.1): top bar over a row of [left nav][banner slot + main][panel][rail].
// The left nav is rendered by the group layouts through ShellMain, so moving between levels swaps the tree while
// the top bar and the rail keep their state.
import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import type { NavLevel } from '@/lib/nav/trees';
import { ScopeRegistryProvider } from '@/lib/scope/context';
import { BannerStack } from './BannerStack';
import { ChromeStateProvider } from './ChromeState';
import { RailHost } from './RailHost';
import { ShellHotkeys } from './ShellHotkeys';
import { SideNav } from './SideNav';
import { TopBar } from './TopBar';

export function AppChrome({ children }: { children: ReactNode }) {
  return (
    <ScopeRegistryProvider>
      <ChromeStateProvider>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            height: '100vh',
            // clip, not hidden: a hidden box can still be scrolled by focus, which left the bar cut off (Q13)
            overflow: 'clip',
          }}
        >
          <TopBar />
          <Box sx={{ display: 'flex', flex: 1, minHeight: 0 }}>
            <Box sx={{ display: 'flex', flex: 1, minWidth: 0 }}>{children}</Box>
            <RailHost />
          </Box>
        </Box>
        <ShellHotkeys />
      </ChromeStateProvider>
    </ScopeRegistryProvider>
  );
}

/** Content column of an (app) frame: optional left nav, then the banner slot and the scrolling main area. */
export function ShellMain({ nav, children }: { nav?: NavLevel; children: ReactNode }) {
  return (
    <>
      {nav ? <SideNav level={nav} /> : null}
      <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
        <BannerStack />
        <Box component="main" id="main" tabIndex={-1} sx={{ flex: 1, overflow: 'auto', p: 6 }}>
          {children}
        </Box>
      </Box>
    </>
  );
}

/** (full) chrome: no top bar, no nav, no rail (routes.md 5.2). Frames add their own header. */
export function FullChrome({ children }: { children: ReactNode }) {
  return (
    <ScopeRegistryProvider>
      <Box component="main" id="main" sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
        {children}
      </Box>
    </ScopeRegistryProvider>
  );
}
