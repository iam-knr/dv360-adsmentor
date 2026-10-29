'use client';

// ScopeContext (routes.md 5.2): the ids and names of the current scope for the subtree, plus a registry so the chrome
// above the scope layouts (top bar crumbs, banner stack, right rail, shortcuts) knows the deepest scope on the page.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { levelOf, type ScopeIds, type ScopeLevel } from '@/lib/routes/paths';
import type { ScopeInfo } from './types';

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

const ORDER: (keyof ScopeInfo)[] = ['partner', 'advertiser', 'campaign', 'io', 'li'];

export function idsOf(scope: ScopeInfo): ScopeIds {
  return {
    ...(scope.partner ? { partnerId: scope.partner.publicId } : {}),
    ...(scope.advertiser ? { advertiserId: scope.advertiser.publicId } : {}),
    ...(scope.campaign ? { campaignId: scope.campaign.publicId } : {}),
    ...(scope.io ? { ioId: scope.io.publicId } : {}),
    ...(scope.li ? { liId: scope.li.publicId } : {}),
  };
}

interface Registry {
  scope: ScopeInfo;
  register: (part: ScopeInfo) => () => void;
  /** True on frames with a left nav (the hamburger is hidden on G, IO and LI frames). */
  hasNav: boolean;
  setHasNav: (v: boolean) => void;
}

const RegistryContext = createContext<Registry | null>(null);
const ScopeContext = createContext<ScopeInfo>({});

/** Mounted once per chrome tree ((app) and (full) layouts). */
export function ScopeRegistryProvider({ children }: { children: ReactNode }) {
  const [parts, setParts] = useState<{ key: number; part: ScopeInfo }[]>([]);
  const [hasNav, setHasNav] = useState(false);
  const counter = useRef(0);
  const register = useCallback((part: ScopeInfo) => {
    const key = (counter.current += 1);
    setParts((prev) => [...prev, { key, part }]);
    return () => setParts((prev) => prev.filter((p) => p.key !== key));
  }, []);
  const value = useMemo<Registry>(() => {
    const scope: ScopeInfo = {};
    for (const { part } of parts) Object.assign(scope, part);
    return { scope, hasNav, setHasNav, register };
  }, [parts, hasNav, register]);
  return <RegistryContext.Provider value={value}>{children}</RegistryContext.Provider>;
}

/** Rendered by each scope layout: provides the merged scope below it and registers it for the chrome. */
export function ScopeBoundary({ part, children }: { part: ScopeInfo; children: ReactNode }) {
  const parent = useContext(ScopeContext);
  const registry = useContext(RegistryContext);
  const key = JSON.stringify(part);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` stands for `part`
  const merged = useMemo(() => ({ ...parent, ...part }), [parent, key]);
  const register = registry?.register;
  useIsoLayoutEffect(() => register?.(part), [register, key]);
  return <ScopeContext.Provider value={merged}>{children}</ScopeContext.Provider>;
}

/** Scope of the subtree (inside a scope layout). */
export function useScope(): ScopeInfo {
  return useContext(ScopeContext);
}

/** Deepest scope registered on the page, for chrome that sits above the scope layouts. */
export function usePageScope(): { scope: ScopeInfo; ids: ScopeIds; level: ScopeLevel } {
  const registry = useContext(RegistryContext);
  const local = useContext(ScopeContext);
  const scope = registry ? { ...registry.scope, ...pick(local) } : local;
  const ids = idsOf(scope);
  return { scope, ids, level: levelOf(ids) };
}

function pick(s: ScopeInfo): ScopeInfo {
  const out: ScopeInfo = {};
  for (const k of ORDER) if (s[k]) Object.assign(out, { [k]: s[k] });
  return out;
}

/** Frames call this to say whether they render a left nav. */
export function useRegisterNav(hasNav: boolean): void {
  const setHasNav = useContext(RegistryContext)?.setHasNav;
  useIsoLayoutEffect(() => {
    setHasNav?.(hasNav);
    return () => setHasNav?.(false);
  }, [setHasNav, hasNav]);
}

export function useHasNav(): boolean {
  return useContext(RegistryContext)?.hasNav ?? false;
}
