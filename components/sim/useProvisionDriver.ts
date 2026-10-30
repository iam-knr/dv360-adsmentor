'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface ProvisionViewJson {
  state: 'NOT_CREATED' | 'QUEUED' | 'BUILDING' | 'READY' | 'FAILED';
  percent: number;
  message: string;
  simDate?: string;
  error?: string;
  overview?: string;
}

const BASE_DELAY_MS = 2_000;
const MAX_DELAY_MS = 30_000;
const isTerminal = (s: ProvisionViewJson['state']) =>
  s === 'READY' || s === 'FAILED' || s === 'NOT_CREATED';

/**
 * Drives a sandbox build from the browser (docs/gaps/prov-drive.md): POSTs the step endpoint one call at a time (each
 * call runs a build step on the server and takes up to the 45 s budget), waits between calls, backs off after errors,
 * pauses while the tab is hidden and stops at READY, FAILED or NOT_CREATED (or when the server refuses it). `step` runs one call by hand and never
 * overlaps the loop: while a call is in flight another one is not started.
 */
export function useProvisionDriver(url: string, initial: ProvisionViewJson) {
  const [view, setView] = useState<ProvisionViewJson>(initial);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [halted, setHalted] = useState(false);
  const failures = useRef(0);

  const step = useCallback(
    async (body?: unknown): Promise<boolean> => {
      if (inFlight.current) return false;
      inFlight.current = true;
      setBusy(true);
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body ?? {}),
        });
        if (res.status === 401 || res.status === 403 || res.status === 404) {
          setHalted(true); // signed out or not allowed: polling again cannot help
          return false;
        }
        if (!res.ok) throw new Error(String(res.status));
        setView((await res.json()) as ProvisionViewJson);
        failures.current = 0;
        return true;
      } catch {
        failures.current += 1; // keep the last state; the loop tries again, further apart each time
        return false;
      } finally {
        inFlight.current = false;
        setBusy(false);
      }
    },
    [url],
  );

  const terminal = halted || isTerminal(view.state);
  useEffect(() => {
    if (terminal) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      timer = undefined;
      if (stopped) return;
      if (document.hidden) return; // resumed by visibilitychange
      await step();
      if (stopped) return;
      const delay = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** failures.current);
      timer = setTimeout(() => void tick(), delay);
    };
    const onVisible = () => {
      if (!document.hidden && !timer && !inFlight.current) void tick();
    };
    const onHidden = () => {
      if (document.hidden && timer) {
        clearTimeout(timer);
        timer = undefined;
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    document.addEventListener('visibilitychange', onHidden);
    void tick();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
      document.removeEventListener('visibilitychange', onHidden);
    };
  }, [terminal, step]);

  return { view, setView, busy, step };
}
