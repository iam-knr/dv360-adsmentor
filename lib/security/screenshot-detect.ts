// Screenshot detector (docs/gaps/screenshot-guard.md). Pure: no DOM, no I/O, so every combination is a unit test.
//
// HONEST SCOPE: a browser has no API that reports a screenshot. This recognises the common KEYBOARD routes only:
// PrintScreen, Win+Shift+S, the macOS Cmd+Shift+3/4/5/6 shortcuts and print attempts. Phone cameras, screen
// recorders, remote desktop, OS tools started from a menu and browser extensions cannot be detected. It is a
// tripwire and a deterrent, not prevention.
//
// PRIVACY: nothing is logged per keystroke. A key event is looked at once, compared with the combinations below,
// and dropped. Only a recognised event leaves the page (method, page path, time).

export const SCREENSHOT_METHODS = [
  'PRINT_SCREEN',
  'WIN_SHIFT_S',
  'MAC_SHORTCUT',
  'PRINT_SHORTCUT',
  'PRINT_EVENT',
  'BROWSER_CAPTURE',
  'SNIP_CHORD',
] as const;

export type ScreenshotMethod = (typeof SCREENSHOT_METHODS)[number];

/** Plain words for the Super admin screens and the audit log. */
export const SCREENSHOT_METHOD_LABELS: Record<ScreenshotMethod, string> = {
  PRINT_SCREEN: 'Print Screen key',
  WIN_SHIFT_S: 'Snipping shortcut (Win+Shift+S)',
  MAC_SHORTCUT: 'Mac screenshot shortcut (Cmd+Shift+3/4/5/6)',
  PRINT_SHORTCUT: 'Print shortcut (Ctrl/Cmd+P)',
  PRINT_EVENT: 'Print dialog opened',
  BROWSER_CAPTURE: 'Browser capture shortcut (Ctrl+Shift+S)',
  SNIP_CHORD: 'Snipping or screenshot shortcut (Win/Cmd+Shift, then the window lost focus)',
};

export function isScreenshotMethod(value: unknown): value is ScreenshotMethod {
  return typeof value === 'string' && (SCREENSHOT_METHODS as readonly string[]).includes(value);
}

export function screenshotMethodLabel(method: string | null | undefined): string {
  return method && isScreenshotMethod(method) ? SCREENSHOT_METHOD_LABELS[method] : 'Unknown';
}

/** The fields of a KeyboardEvent the detector reads (a plain object works in tests). */
export interface KeyEventLike {
  type: string;
  key: string;
  code: string;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
  isComposing?: boolean;
}

const MAC_DIGITS = new Set(['Digit3', 'Digit4', 'Digit5', 'Digit6']);

/**
 * The method a key event matches, or null. Typing is never a match: a plain letter, a digit, Shift+3 ("#") or
 * Shift+S ("S") without the Meta key does nothing.
 */
export function detectScreenshotKey(e: KeyEventLike): ScreenshotMethod | null {
  if (e.isComposing) return null;
  const isDown = e.type === 'keydown';
  const isUp = e.type === 'keyup';
  if (!isDown && !isUp) return null;

  // PrintScreen, with or without Alt/Ctrl/Shift. Windows often delivers only the key up, so both are accepted.
  if (e.code === 'PrintScreen' || e.key === 'PrintScreen') return 'PRINT_SCREEN';

  // The rest are chords: recognised on key down only, so one press is one event.
  if (!isDown) return null;
  if (e.metaKey && e.shiftKey && !e.altKey && e.code === 'KeyS') return 'WIN_SHIFT_S';
  if (e.metaKey && e.shiftKey && MAC_DIGITS.has(e.code)) return 'MAC_SHORTCUT';
  // Edge Web Capture and the Firefox screenshot tool: the browser lets the page see this one.
  if (e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey && (e.code === 'KeyS' || e.key.toLowerCase() === 's'))
    return 'BROWSER_CAPTURE';
  if (
    (e.ctrlKey || e.metaKey) &&
    !e.shiftKey &&
    !e.altKey &&
    (e.code === 'KeyP' || e.key.toLowerCase() === 'p')
  )
    return 'PRINT_SHORTCUT';
  return null;
}

/** `beforeprint` is its own event (File > Print, the browser menu, window.print()). */
export function detectPrintEvent(type: string): ScreenshotMethod | null {
  return type === 'beforeprint' ? 'PRINT_EVENT' : null;
}

export const MAX_EVENT_PATH = 200;

/**
 * The page path that is stored with an event: path only (no query string or fragment), control characters
 * removed, at most 200 characters. Anything that is not a path becomes "/".
 */
export function normaliseEventPath(raw: unknown): string {
  if (typeof raw !== 'string') return '/';
  const clean = raw.replace(/[\u0000-\u001f\u007f]/g, '');
  const noQuery = clean.split(/[?#]/)[0] ?? '';
  if (!noQuery.startsWith('/') || noQuery.startsWith('//')) return '/';
  return noQuery.slice(0, MAX_EVENT_PATH);
}

/**
 * Snipping shortcuts such as Win+Shift+S (Windows) and Cmd+Shift+3/4/5 (macOS) are handled by the operating system,
 * which keeps the last key: the page sees only the modifiers. What it does see is that the window loses focus when
 * the snipping overlay opens. This tracker is the pure rule for that: Meta and Shift held together with no other key
 * pressed, then a blur within `windowMs` is a probable snip. It is a heuristic (it can also fire for Cmd/Win+Shift+Tab)
 * and it never looks at which letters are typed: only whether the two modifiers are down.
 */
export const SNIP_CHORD_WINDOW_MS = 2000;

export class SnipChordTracker {
  private meta = false;
  private shift = false;
  private armedAt: number | null = null;
  private other = false;

  constructor(private readonly windowMs: number = SNIP_CHORD_WINDOW_MS) {}

  /** Feed every keydown/keyup. Never returns a method: only a blur does. */
  key(e: Pick<KeyEventLike, 'type' | 'key' | 'code'>, now: number): void {
    const down = e.type === 'keydown';
    if (!down && e.type !== 'keyup') return;
    const name = e.key;
    if (name === 'Meta' || name === 'OS') this.meta = down;
    else if (name === 'Shift') this.shift = down;
    else if (name === 'Control' || name === 'Alt' || name === 'AltGraph') return;
    else if (down) this.other = true; // a real key was delivered: this is not the swallowed-key case
    if (this.meta && this.shift) {
      if (this.armedAt === null) this.armedAt = now;
    } else {
      // The chord is not (or no longer) complete: forget the arming, keep which modifiers are down.
      this.armedAt = null;
      this.other = false;
    }
  }

  /** The window lost focus. Returns the method when the rule matches, and resets. */
  blur(now: number): ScreenshotMethod | null {
    const hit =
      this.meta && this.shift && !this.other && this.armedAt !== null && now - this.armedAt <= this.windowMs;
    this.reset();
    return hit ? 'SNIP_CHORD' : null;
  }

  reset(): void {
    this.meta = false;
    this.shift = false;
    this.armedAt = null;
    this.other = false;
  }
}
