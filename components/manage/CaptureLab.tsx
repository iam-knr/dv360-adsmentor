'use client';

// Super admin "capture lab" (docs/gaps/screenshot-guard.md). Shows which events THIS browser delivers to a page for a
// screenshot shortcut and what the guard's rules (lib/security/screenshot-detect.ts) would decide. Local only: the log
// lives in this component's state, nothing is sent or stored, and it is gone when the page is left or cleared.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import {
  CaptureChordTracker,
  detectPrintEvent,
  detectScreenshotKey,
  screenshotMethodLabel,
  SnipChordTracker,
  type ScreenshotMethod,
} from '@/lib/security/screenshot-detect';

export interface LabEntry {
  id: number;
  /** Milliseconds since the first event of this session. */
  at: number;
  type: string;
  detail: string;
  verdict: ScreenshotMethod | null;
}

const MAX_ENTRIES = 300;

export function describeKey(e: Pick<KeyboardEvent, 'key' | 'code' | 'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey'>): string {
  const mods = [e.ctrlKey && 'Ctrl', e.altKey && 'Alt', e.shiftKey && 'Shift', e.metaKey && 'Meta']
    .filter(Boolean)
    .join('+');
  return `key=${JSON.stringify(e.key)} code=${e.code || '-'} modifiers=${mods || 'none'}`;
}

export function reportText(entries: LabEntry[], platform: string): string {
  const lines = entries.map(
    (e) => `${String(e.at).padStart(6)} ms  ${e.type.padEnd(16)} ${e.detail}${e.verdict ? `  => GUARD WOULD TRIP: ${e.verdict}` : ''}`,
  );
  return [`Capture lab report`, `Browser: ${platform}`, ...lines].join('\n');
}

export function CaptureLab() {
  const [entries, setEntries] = useState<LabEntry[]>([]);
  const [platform, setPlatform] = useState('');
  const [copied, setCopied] = useState(false);
  const start = useRef<number | null>(null);
  const seq = useRef(0);
  const chord = useRef(new SnipChordTracker());
  const capture = useRef(new CaptureChordTracker());
  const lastFocus = useRef<boolean | null>(null);
  const lastMouse = useRef(0);

  const push = useCallback((type: string, detail: string, verdict: ScreenshotMethod | null) => {
    const now = Date.now();
    if (start.current === null) start.current = now;
    const entry: LabEntry = { id: ++seq.current, at: now - start.current, type, detail, verdict };
    setEntries((cur) => [...cur.slice(-(MAX_ENTRIES - 1)), entry]);
  }, []);

  useEffect(() => {
    const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
    setPlatform(`${nav.userAgentData?.platform ?? navigator.platform} | ${navigator.userAgent}`);
    const onKey = (e: KeyboardEvent) => {
      const direct = detectScreenshotKey(e);
      if (!direct) chord.current.key(e, Date.now());
      const verdict = direct ?? capture.current.event(e, Date.now());
      push(e.type, `${describeKey(e)} hasFocus=${document.hasFocus()}`, verdict);
    };
    // A mouse event with Ctrl and Shift reported as released while the page never saw the release.
    const onMouse = (e: MouseEvent) => {
      const verdict = capture.current.event(e, Date.now());
      const now = Date.now();
      if (verdict || now - lastMouse.current > 1000) {
        lastMouse.current = now;
        push(e.type, `ctrl=${e.ctrlKey} shift=${e.shiftKey} hasFocus=${document.hasFocus()}`, verdict);
      }
    };
    const onBlur = () => {
      capture.current.reset();
      push('blur', `window lost focus hasFocus=${document.hasFocus()}`, chord.current.blur(Date.now()));
    };
    // Focus can leave the page without a blur event (the Edge capture bubble): poll document.hasFocus().
    const timer = window.setInterval(() => {
      const has = document.hasFocus();
      const verdict = capture.current.poll(has, Date.now());
      if (lastFocus.current !== null && lastFocus.current !== has) push('hasFocus', `document.hasFocus() is now ${has}`, verdict);
      else if (verdict) push('hasFocus', `document.hasFocus() is ${has}`, verdict);
      lastFocus.current = has;
    }, 150);
    const simple = (type: string) => () => {
      if (type === 'visibilitychange' || type === 'pagehide') capture.current.reset();
      const verdict = detectPrintEvent(type);
      push(type, type === 'visibilitychange' ? `visibilityState=${document.visibilityState}` : type === 'resize' ? `${window.innerWidth}x${window.innerHeight}` : `hasFocus=${document.hasFocus()}`, verdict);
    };
    const handlers: Array<[string, EventListener]> = [
      ['keydown', onKey as EventListener],
      ['keyup', onKey as EventListener],
      ['blur', onBlur],
      ['mousemove', onMouse as EventListener],
      ['pointerdown', onMouse as EventListener],
      ['resize', simple('resize')],
      ['focus', simple('focus')],
      ['visibilitychange', simple('visibilitychange')],
      ['pagehide', simple('pagehide')],
      ['beforeprint', simple('beforeprint')],
      ['afterprint', simple('afterprint')],
    ];
    for (const [type, fn] of handlers) {
      if (type === 'visibilitychange') document.addEventListener(type, fn);
      else window.addEventListener(type, fn, type === 'keydown' || type === 'keyup');
    }
    return () => {
      window.clearInterval(timer);
      for (const [type, fn] of handlers) {
        if (type === 'visibilitychange') document.removeEventListener(type, fn);
        else window.removeEventListener(type, fn, type === 'keydown' || type === 'keyup');
      }
    };
  }, [push]);

  const tripped = useMemo(() => entries.filter((e) => e.verdict), [entries]);
  const clear = () => {
    setEntries([]);
    start.current = null;
    chord.current.reset();
    setCopied(false);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(reportText(entries, platform));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="body2" data-testid="lab-platform" color="text.secondary">
        {platform || 'Detecting browser...'}
      </Typography>
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <Button variant="outlined" size="small" onClick={clear}>
          Clear log
        </Button>
        <Button variant="outlined" size="small" onClick={() => void copy()} disabled={entries.length === 0}>
          Copy report
        </Button>
        {copied ? <Typography variant="caption">Copied. Paste it into the chat.</Typography> : null}
        <Chip
          size="small"
          data-testid="lab-summary"
          color={tripped.length > 0 ? 'error' : 'default'}
          label={
            tripped.length > 0
              ? `Guard would trip: ${[...new Set(tripped.map((t) => screenshotMethodLabel(t.verdict)))].join(', ')}`
              : 'Guard has not tripped yet'
          }
        />
      </Box>
      <Table size="small" aria-label="Events delivered to this page">
        <TableHead>
          <TableRow>
            <TableCell>ms</TableCell>
            <TableCell>Event</TableCell>
            <TableCell>Details</TableCell>
            <TableCell>Guard</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {entries.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4}>Nothing yet. Click this page, then press a screenshot shortcut.</TableCell>
            </TableRow>
          ) : (
            entries.map((e) => (
              <TableRow key={e.id} data-testid="lab-row" data-verdict={e.verdict ?? ''}>
                <TableCell>{e.at}</TableCell>
                <TableCell>{e.type}</TableCell>
                <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{e.detail}</TableCell>
                <TableCell>{e.verdict ? <strong>{screenshotMethodLabel(e.verdict)}</strong> : ''}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </Box>
  );
}
