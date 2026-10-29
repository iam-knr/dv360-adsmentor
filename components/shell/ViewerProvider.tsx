'use client';

// ViewerContext (routes.md 5.2): role, access level and the read-only chrome data of the (dv) guard layout.
import { createContext, useContext, type ReactNode } from 'react';
import type { ChromeData } from '@/lib/scope/chrome-data';
import type { ViewerInfo } from '@/lib/scope/types';

export interface ViewerValue {
  viewer: ViewerInfo;
  chrome: ChromeData;
}

const FALLBACK: ViewerValue = {
  viewer: {
    name: '',
    initials: '?',
    appRole: 'user',
    dvRole: 'READ_ONLY',
    limitedAccess: false,
    readOnly: true,
    viewAs: null,
  },
  chrome: { clock: null, windowBanner: null, closesAt: null },
};

const Ctx = createContext<ViewerValue>(FALLBACK);

export function ViewerProvider({ value, children }: { value: ViewerValue; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useViewer(): ViewerValue {
  return useContext(Ctx);
}
