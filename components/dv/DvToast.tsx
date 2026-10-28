'use client';

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
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';

export type DvToastKind = 'neutral' | 'warning' | 'error';

export interface DvToastOptions {
  kind?: DvToastKind;
  message: ReactNode;
  action?: { label: string; onClick: () => void };
  durationMs?: number;
}

interface ToastItem extends DvToastOptions {
  id: number;
  kind: DvToastKind;
}

export interface DvToastApi {
  show: (options: DvToastOptions) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<DvToastApi | null>(null);

/** `toast.show({ kind, message, action })` (design-system 2.13). Needs a `DvToastProvider` above. */
export function useToast(): DvToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside DvToastProvider');
  return ctx;
}

const DEFAULT_DURATION = 6000;
const MAX_STACK = 3;

function NeutralToast({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const [paused, setPaused] = useState(false);
  const duration = toast.durationMs ?? DEFAULT_DURATION;
  useEffect(() => {
    if (paused || duration <= 0) return;
    const t = setTimeout(onDismiss, duration);
    return () => clearTimeout(t);
  }, [paused, duration, onDismiss]);
  return (
    <Box
      role={toast.kind === 'error' ? 'alert' : 'status'}
      data-kind={toast.kind}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      sx={{
        minWidth: 344,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 4,
        px: 4,
        py: 3,
        bgcolor: 'toast.bg',
        color: 'common.white',
        borderRadius: '4px',
        boxShadow: 4,
        typography: 'body1',
      }}
    >
      <Box component="span">{toast.message}</Box>
      {toast.action ? (
        <Button
          size="small"
          onClick={() => {
            toast.action?.onClick();
            onDismiss();
          }}
          sx={{ color: 'toast.action' }}
        >
          {toast.action.label}
        </Button>
      ) : null}
    </Box>
  );
}

function WarningToast({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  return (
    <Box
      role="status"
      data-kind="warning"
      sx={{
        width: 640,
        maxWidth: '100%',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 4,
        px: 4,
        py: 3,
        bgcolor: 'banner.warning.bg',
        color: 'banner.warning.fg',
        borderRadius: '8px',
        boxShadow: 4,
        typography: 'body1',
      }}
    >
      <Box component="div">{toast.message}</Box>
      <Button size="small" onClick={onDismiss} sx={{ color: 'inherit' }}>
        Dismiss
      </Button>
    </Box>
  );
}

export function DvToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback(
    (id: number) => setItems((cur) => cur.filter((t) => t.id !== id)),
    [],
  );
  const show = useCallback((options: DvToastOptions) => {
    const id = nextId.current++;
    setItems((cur) => [...cur, { ...options, kind: options.kind ?? 'neutral', id }]);
    return id;
  }, []);
  const api = useMemo(() => ({ show, dismiss }), [show, dismiss]);

  const bottom = items.filter((t) => t.kind !== 'warning').slice(-MAX_STACK);
  const top = items.filter((t) => t.kind === 'warning');

  return (
    <ToastContext.Provider value={api}>
      {children}
      <Box
        data-toast-host="bottom"
        sx={{
          position: 'fixed',
          left: 16,
          bottom: 16,
          zIndex: (t) => t.zIndex.toast,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        {bottom.map((t) => (
          <NeutralToast key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </Box>
      <Box
        data-toast-host="top"
        sx={{
          position: 'fixed',
          top: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: (t) => t.zIndex.toast,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          maxWidth: '100vw',
        }}
      >
        {top.map((t) => (
          <WarningToast key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </Box>
    </ToastContext.Provider>
  );
}

/** Name used by the build plan. The provider renders both hosts, so this is an alias. */
export const SnackbarHost = DvToastProvider;
