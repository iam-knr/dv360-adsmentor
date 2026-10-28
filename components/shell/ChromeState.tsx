'use client';

// ChromeContext (routes.md 5.2): nav collapsed state. Stored in localStorage `sim.nav.collapsed` (routes.md 4.1 item 1)
// and mirrored to UserPreference `navCollapsed` with savePrefs (module 01 01-T5).
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { savePrefsAction } from '@/lib/scope/actions';

export const NAV_COLLAPSED_KEY = 'sim.nav.collapsed';

export function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // private mode or quota: the state still works for this page
  }
}

/** Fire and forget; a failed preference write never shows an error. */
export function savePrefsQuietly(patch: Record<string, unknown>): void {
  void savePrefsAction(patch).catch(() => undefined);
}

interface ChromeValue {
  navCollapsed: boolean;
  toggleNav: () => void;
}

const Ctx = createContext<ChromeValue>({ navCollapsed: false, toggleNav: () => undefined });

export function ChromeStateProvider({ children }: { children: ReactNode }) {
  const [navCollapsed, setNavCollapsed] = useState(false);
  useEffect(() => setNavCollapsed(readStorage(NAV_COLLAPSED_KEY) === 'true'), []);
  const toggleNav = useCallback(() => {
    const next = !navCollapsed;
    setNavCollapsed(next);
    writeStorage(NAV_COLLAPSED_KEY, String(next));
    savePrefsQuietly({ navCollapsed: next });
  }, [navCollapsed]);
  const value = useMemo(() => ({ navCollapsed, toggleNav }), [navCollapsed, toggleNav]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useChromeState(): ChromeValue {
  return useContext(Ctx);
}
