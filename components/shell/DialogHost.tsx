'use client';

// One DialogHost for the DV360 trees (routes.md 5.1, 5.4 "Modals and dialogs"): the shortcuts dialog, the search
// overlay switch and the Unsaved Changes dialog (DLG-01) that AppLink asks through `confirmLeave`.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { DvShortcutsModal, DvUnsavedChangesModal } from '@/components/dv';
import { isMacPlatform } from '@/lib/hooks/useHotkeys';
import { setLeaveConfirmer } from '@/lib/hooks/useUnsavedGuard';

export interface ShellDialogs {
  openShortcuts: () => void;
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
}

const Ctx = createContext<ShellDialogs>({
  openShortcuts: () => undefined,
  searchOpen: false,
  setSearchOpen: () => undefined,
});

export function useShellDialogs(): ShellDialogs {
  return useContext(Ctx);
}

export function DialogHost({ children }: { children: ReactNode }) {
  const [shortcuts, setShortcuts] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const proceed = useRef<(() => void) | null>(null);
  const [mac, setMac] = useState(false);

  useEffect(() => setMac(isMacPlatform(navigator)), []);
  useEffect(
    () =>
      setLeaveConfirmer((go) => {
        proceed.current = go;
        setLeaving(true);
      }),
    [],
  );

  const openShortcuts = useCallback(() => setShortcuts(true), []);
  const value = useMemo(
    () => ({ openShortcuts, searchOpen, setSearchOpen }),
    [openShortcuts, searchOpen],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <DvShortcutsModal open={shortcuts} onClose={() => setShortcuts(false)} mac={mac} />
      <DvUnsavedChangesModal
        open={leaving}
        onContinue={() => {
          proceed.current = null;
          setLeaving(false);
        }}
        onDiscard={() => {
          const go = proceed.current;
          proceed.current = null;
          setLeaving(false);
          go?.();
        }}
      />
    </Ctx.Provider>
  );
}
