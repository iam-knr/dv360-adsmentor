'use client';

// Screenshot guard for students (docs/gaps/screenshot-guard.md). HONEST SCOPE: a browser cannot see a screenshot.
// This watches for the common keyboard routes (Print Screen, Win+Shift+S, the macOS Cmd+Shift+3/4/5/6 shortcuts,
// print attempts), tells the server, and leaves the page. Phone cameras, screen recorders, remote desktop, tools
// started from a menu and extensions are not detected. Nothing typed is recorded: each key event is compared with
// the list and dropped, and only a recognised event (method, page path, time) is sent.
import { useEffect, useRef } from 'react';
import {
  detectPrintEvent,
  detectScreenshotKey,
  type ScreenshotMethod,
} from '@/lib/security/screenshot-detect';
import { SCREENSHOT_EVENT_URL, SUSPENDED_PATH } from '@/lib/security/guard-policy';

/** Sends the report so that it survives the page being left: sendBeacon first, fetch with keepalive as the fallback. */
export function reportScreenshot(
  method: ScreenshotMethod,
  path: string,
  deps: {
    beacon?: (url: string, data: Blob) => boolean;
    fetcher?: typeof fetch;
  } = {},
): void {
  const body = JSON.stringify({ method, path });
  const beacon =
    deps.beacon ??
    (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function'
      ? (u: string, d: Blob) => navigator.sendBeacon(u, d)
      : undefined);
  try {
    if (beacon?.(SCREENSHOT_EVENT_URL, new Blob([body], { type: 'application/json' }))) return;
  } catch {
    // fall through to fetch
  }
  const fetcher = deps.fetcher ?? (typeof fetch === 'function' ? fetch : undefined);
  void fetcher?.(SCREENSHOT_EVENT_URL, {
    method: 'POST',
    body,
    keepalive: true,
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
  }).catch(() => undefined);
}

export interface ScreenshotGuardProps {
  /** Test seams. */
  report?: (method: ScreenshotMethod, path: string) => void;
  navigate?: (to: string) => void;
}

export function ScreenshotGuard({ report, navigate }: ScreenshotGuardProps) {
  const fired = useRef(false);
  const reportRef = useRef(report);
  const navigateRef = useRef(navigate);
  reportRef.current = report;
  navigateRef.current = navigate;

  useEffect(() => {
    const trip = (method: ScreenshotMethod) => {
      if (fired.current) return; // key down and key up, or two events for one press: one report
      fired.current = true;
      const path = window.location.pathname;
      (reportRef.current ?? reportScreenshot)(method, path);
      (navigateRef.current ?? ((to: string) => window.location.replace(to)))(SUSPENDED_PATH);
    };
    const onKey = (e: KeyboardEvent) => {
      const method = detectScreenshotKey(e);
      if (method) trip(method);
    };
    const onPrint = (e: Event) => {
      const method = detectPrintEvent(e.type);
      if (method) trip(method);
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('keyup', onKey, true);
    window.addEventListener('beforeprint', onPrint);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('keyup', onKey, true);
      window.removeEventListener('beforeprint', onPrint);
    };
  }, []);

  // Printed output of a guarded student is blank.
  return <style media="print">{'html, body { display: none !important; }'}</style>;
}
