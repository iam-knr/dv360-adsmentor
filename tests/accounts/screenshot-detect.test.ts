import { describe, expect, it } from 'vitest';
import {
  detectPrintEvent,
  detectScreenshotKey,
  isScreenshotMethod,
  normaliseEventPath,
  SCREENSHOT_METHODS,
  SnipChordTracker,
  screenshotMethodLabel,
  type KeyEventLike,
} from '@/lib/security/screenshot-detect';
import { isScreenshotGuarded } from '@/lib/security/guard-policy';
import { isSameOrigin } from '@/lib/security/same-origin';

const ev = (over: Partial<KeyEventLike>): KeyEventLike => ({
  type: 'keydown',
  key: '',
  code: '',
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  metaKey: false,
  ...over,
});

describe('detectScreenshotKey: recognised combinations', () => {
  it.each([
    ['keydown'],
    ['keyup'], // Windows often delivers only the key up
  ])('PrintScreen on %s', (type) => {
    expect(detectScreenshotKey(ev({ type, key: 'PrintScreen', code: 'PrintScreen' }))).toBe(
      'PRINT_SCREEN',
    );
  });

  it('PrintScreen with Alt or Ctrl or Shift', () => {
    for (const mod of ['altKey', 'ctrlKey', 'shiftKey', 'metaKey'] as const) {
      expect(
        detectScreenshotKey(ev({ key: 'PrintScreen', code: 'PrintScreen', [mod]: true })),
      ).toBe('PRINT_SCREEN');
    }
  });

  it('key only or code only is enough for PrintScreen', () => {
    expect(detectScreenshotKey(ev({ type: 'keyup', key: 'PrintScreen' }))).toBe('PRINT_SCREEN');
    expect(detectScreenshotKey(ev({ type: 'keyup', code: 'PrintScreen' }))).toBe('PRINT_SCREEN');
  });

  it('Win+Shift+S (Meta+Shift+KeyS)', () => {
    expect(detectScreenshotKey(ev({ key: 'S', code: 'KeyS', metaKey: true, shiftKey: true }))).toBe(
      'WIN_SHIFT_S',
    );
  });

  it.each(['Digit3', 'Digit4', 'Digit5', 'Digit6'])('macOS Cmd+Shift+%s', (code) => {
    expect(detectScreenshotKey(ev({ key: '#', code, metaKey: true, shiftKey: true }))).toBe(
      'MAC_SHORTCUT',
    );
  });

  it('macOS Ctrl+Cmd+Shift+4 (copy to clipboard)', () => {
    expect(
      detectScreenshotKey(
        ev({ key: '$', code: 'Digit4', metaKey: true, shiftKey: true, ctrlKey: true }),
      ),
    ).toBe('MAC_SHORTCUT');
  });

  it('Ctrl+P and Cmd+P', () => {
    expect(detectScreenshotKey(ev({ key: 'p', code: 'KeyP', ctrlKey: true }))).toBe(
      'PRINT_SHORTCUT',
    );
    expect(detectScreenshotKey(ev({ key: 'p', code: 'KeyP', metaKey: true }))).toBe(
      'PRINT_SHORTCUT',
    );
    // a layout where the letter sits on another code
    expect(detectScreenshotKey(ev({ key: 'P', code: 'KeyR', ctrlKey: true }))).toBe(
      'PRINT_SHORTCUT',
    );
  });

  it('the print event', () => {
    expect(detectPrintEvent('beforeprint')).toBe('PRINT_EVENT');
    expect(detectPrintEvent('afterprint')).toBeNull();
    expect(detectPrintEvent('keydown')).toBeNull();
  });

  it('every method the detector returns is in the enum', () => {
    for (const m of [
      'PRINT_SCREEN',
      'WIN_SHIFT_S',
      'MAC_SHORTCUT',
      'PRINT_SHORTCUT',
      'PRINT_EVENT',
    ])
      expect(isScreenshotMethod(m)).toBe(true);
    expect(SCREENSHOT_METHODS).toHaveLength(7);
    expect(isScreenshotMethod('KEYLOG')).toBe(false);
    expect(isScreenshotMethod(undefined)).toBe(false);
  });

  it('has a plain label for every method', () => {
    for (const m of SCREENSHOT_METHODS) expect(screenshotMethodLabel(m)).not.toBe('Unknown');
    expect(screenshotMethodLabel('nope')).toBe('Unknown');
    expect(screenshotMethodLabel(null)).toBe('Unknown');
  });
});

describe('detectScreenshotKey: typing is never a match', () => {
  it('plain letters, including s and p', () => {
    for (const ch of 'abcdefghijklmnopqrstuvwxyz') {
      const code = `Key${ch.toUpperCase()}`;
      expect(detectScreenshotKey(ev({ key: ch, code }))).toBeNull();
      expect(detectScreenshotKey(ev({ type: 'keyup', key: ch, code }))).toBeNull();
    }
  });

  it('Shift+letter (capitals) and Shift+S without Meta', () => {
    expect(detectScreenshotKey(ev({ key: 'S', code: 'KeyS', shiftKey: true }))).toBeNull();
    expect(detectScreenshotKey(ev({ key: 'P', code: 'KeyP', shiftKey: true }))).toBeNull();
  });

  it('digits, Shift+digits (#, $, %, ^) and the numpad', () => {
    for (const d of '0123456789') {
      expect(detectScreenshotKey(ev({ key: d, code: `Digit${d}` }))).toBeNull();
      expect(detectScreenshotKey(ev({ key: d, code: `Numpad${d}` }))).toBeNull();
    }
    for (const [key, code] of [
      ['#', 'Digit3'],
      ['$', 'Digit4'],
      ['%', 'Digit5'],
      ['^', 'Digit6'],
    ] as const) {
      expect(detectScreenshotKey(ev({ key, code, shiftKey: true }))).toBeNull();
    }
  });

  it('Meta+Shift with other keys, Meta+digits without Shift, Cmd+S, Ctrl+S', () => {
    expect(
      detectScreenshotKey(ev({ key: 'A', code: 'KeyA', metaKey: true, shiftKey: true })),
    ).toBeNull();
    expect(detectScreenshotKey(ev({ key: '3', code: 'Digit3', metaKey: true }))).toBeNull();
    expect(
      detectScreenshotKey(ev({ key: '7', code: 'Digit7', metaKey: true, shiftKey: true })),
    ).toBeNull();
    expect(detectScreenshotKey(ev({ key: 's', code: 'KeyS', metaKey: true }))).toBeNull();
    expect(detectScreenshotKey(ev({ key: 's', code: 'KeyS', ctrlKey: true }))).toBeNull();
  });

  it('Ctrl+Shift+P, Ctrl+Alt+P and Alt+P are not the print shortcut', () => {
    expect(
      detectScreenshotKey(ev({ key: 'P', code: 'KeyP', ctrlKey: true, shiftKey: true })),
    ).toBeNull();
    expect(
      detectScreenshotKey(ev({ key: 'p', code: 'KeyP', ctrlKey: true, altKey: true })),
    ).toBeNull();
    expect(detectScreenshotKey(ev({ key: 'p', code: 'KeyP', altKey: true }))).toBeNull();
  });

  it('the chords are key down only (a key up of Ctrl+P or Cmd+Shift+3 does nothing)', () => {
    expect(
      detectScreenshotKey(ev({ type: 'keyup', key: 'p', code: 'KeyP', ctrlKey: true })),
    ).toBeNull();
    expect(
      detectScreenshotKey(
        ev({ type: 'keyup', key: '#', code: 'Digit3', metaKey: true, shiftKey: true }),
      ),
    ).toBeNull();
  });

  it('IME composition, other event types, modifiers alone and function keys', () => {
    expect(
      detectScreenshotKey(ev({ key: 'PrintScreen', code: 'PrintScreen', isComposing: true })),
    ).toBeNull();
    expect(detectScreenshotKey(ev({ type: 'keypress', key: 'PrintScreen' }))).toBeNull();
    expect(detectScreenshotKey(ev({ key: 'Meta', code: 'MetaLeft', metaKey: true }))).toBeNull();
    expect(
      detectScreenshotKey(ev({ key: 'Shift', code: 'ShiftLeft', shiftKey: true, metaKey: true })),
    ).toBeNull();
    expect(detectScreenshotKey(ev({ key: 'F12', code: 'F12' }))).toBeNull();
    expect(detectScreenshotKey(ev({ key: 'Enter', code: 'Enter' }))).toBeNull();
  });
});

describe('normaliseEventPath', () => {
  it('keeps a path, drops query and fragment', () => {
    expect(normaliseEventPath('/p/1/a/2/c?tab=x#y')).toBe('/p/1/a/2/c');
  });
  it('rejects things that are not a path', () => {
    for (const v of [undefined, null, 5, '', 'https://evil.test/x', '//evil.test', 'javascript:1'])
      expect(normaliseEventPath(v)).toBe('/');
  });
  it('removes control characters and caps the length', () => {
    expect(normaliseEventPath('/a\u0000b\nc')).toBe('/abc');
    expect(normaliseEventPath(`/${'x'.repeat(500)}`)).toHaveLength(200);
  });
});

describe('isScreenshotGuarded', () => {
  const student = { appRole: 'user' as const, screenshotsAllowed: false };
  it('guards a student by default and when disallowed', () => {
    expect(isScreenshotGuarded(student)).toBe(true);
    expect(isScreenshotGuarded({ appRole: 'user' })).toBe(true);
  });
  it('does not guard a student whose screenshots are allowed', () => {
    expect(isScreenshotGuarded({ ...student, screenshotsAllowed: true })).toBe(false);
  });
  it('never guards a Super admin or nobody', () => {
    expect(isScreenshotGuarded({ appRole: 'super_admin', screenshotsAllowed: false })).toBe(false);
    expect(isScreenshotGuarded(null)).toBe(false);
    expect(isScreenshotGuarded(undefined)).toBe(false);
  });
  it('never guards a Super admin who views a student (view-as)', () => {
    expect(
      isScreenshotGuarded({
        ...student,
        viewAs: { userId: 'u1', actAs: false },
        actor: { id: 'sa', email: 'sa@example.test', name: 'SA', appRole: 'super_admin' },
      }),
    ).toBe(false);
  });
});

describe('isSameOrigin', () => {
  const req = (h: Record<string, string>) => ({
    headers: { get: (n: string) => h[n.toLowerCase()] ?? null },
  });
  it('accepts the same host', () => {
    expect(
      isSameOrigin(req({ origin: 'https://sim.example.test', host: 'sim.example.test' })),
    ).toBe(true);
    expect(
      isSameOrigin(
        req({
          origin: 'https://sim.example.test',
          host: 'internal:3000',
          'x-forwarded-host': 'sim.example.test',
        }),
      ),
    ).toBe(true);
  });
  it('refuses another origin, a bad origin and a missing one', () => {
    expect(isSameOrigin(req({ origin: 'https://evil.test', host: 'sim.example.test' }))).toBe(
      false,
    );
    expect(isSameOrigin(req({ origin: 'not a url', host: 'sim.example.test' }))).toBe(false);
    expect(isSameOrigin(req({ host: 'sim.example.test' }))).toBe(false);
  });
  it('falls back to Sec-Fetch-Site when there is no Origin', () => {
    expect(isSameOrigin(req({ 'sec-fetch-site': 'same-origin' }))).toBe(true);
    expect(isSameOrigin(req({ 'sec-fetch-site': 'cross-site' }))).toBe(false);
  });
});

describe('Ctrl+Shift+S (Edge Web Capture, Firefox screenshots)', () => {
  it('is recognised on key down', () => {
    expect(detectScreenshotKey(ev({ key: 'S', code: 'KeyS', ctrlKey: true, shiftKey: true }))).toBe(
      'BROWSER_CAPTURE',
    );
  });
  it.each([
    ['Ctrl+S (save)', { key: 's', code: 'KeyS', ctrlKey: true }],
    ['Shift+S (typing a capital S)', { key: 'S', code: 'KeyS', shiftKey: true }],
    ['Ctrl+Alt+Shift+S', { key: 'S', code: 'KeyS', ctrlKey: true, altKey: true, shiftKey: true }],
  ])('does not match %s', (_n, init) => {
    expect(detectScreenshotKey(ev(init))).toBeNull();
  });
});

describe('SnipChordTracker (Win/Cmd+Shift then the window loses focus)', () => {
  const k = (type: string, key: string) => ({ type, key, code: key === 'Meta' ? 'MetaLeft' : 'ShiftLeft' });

  it('flags Win+Shift held with no other key, then blur within 2 s', () => {
    const t = new SnipChordTracker();
    t.key(k('keydown', 'Meta'), 1000);
    t.key(k('keydown', 'Shift'), 1100);
    expect(t.blur(1600)).toBe('SNIP_CHORD');
  });

  it('works in either press order', () => {
    const t = new SnipChordTracker();
    t.key(k('keydown', 'Shift'), 1000);
    t.key(k('keydown', 'Meta'), 1100);
    expect(t.blur(1200)).toBe('SNIP_CHORD');
  });

  it('ignores a blur that comes too late', () => {
    const t = new SnipChordTracker();
    t.key(k('keydown', 'Meta'), 1000);
    t.key(k('keydown', 'Shift'), 1100);
    expect(t.blur(1100 + 2001)).toBeNull();
  });

  it('ignores the Windows key alone (Start menu) and Shift alone', () => {
    const a = new SnipChordTracker();
    a.key(k('keydown', 'Meta'), 1000);
    expect(a.blur(1100)).toBeNull();
    const b = new SnipChordTracker();
    b.key(k('keydown', 'Shift'), 1000);
    expect(b.blur(1100)).toBeNull();
  });

  it('ignores the chord when a real key was delivered after it (the swallowed-key case is the only match)', () => {
    const t = new SnipChordTracker();
    t.key(k('keydown', 'Meta'), 1000);
    t.key(k('keydown', 'Shift'), 1100);
    t.key({ type: 'keydown', key: 'Tab', code: 'Tab' }, 1200);
    expect(t.blur(1300)).toBeNull();
  });

  it('forgets the chord once a modifier is released', () => {
    const t = new SnipChordTracker();
    t.key(k('keydown', 'Meta'), 1000);
    t.key(k('keydown', 'Shift'), 1100);
    t.key(k('keyup', 'Shift'), 1200);
    expect(t.blur(1300)).toBeNull();
  });

  it('is single use: a second blur does not fire again', () => {
    const t = new SnipChordTracker();
    t.key(k('keydown', 'Meta'), 1000);
    t.key(k('keydown', 'Shift'), 1100);
    expect(t.blur(1200)).toBe('SNIP_CHORD');
    expect(t.blur(1300)).toBeNull();
  });

  it('never fires from typing: letters, Ctrl, Alt', () => {
    const t = new SnipChordTracker();
    for (const key of ['Control', 'Alt', 'Shift', 's', 'S', '3']) t.key({ type: 'keydown', key, code: '' }, 1000);
    expect(t.blur(1100)).toBeNull();
  });
});
