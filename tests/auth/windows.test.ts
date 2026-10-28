import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  isWindowActive,
  minutesLeft,
  openUntil,
  statusAt,
  warningBanner,
  type WindowLike,
} from '@/lib/access/window-rules';

const w = (
  opensAt: string,
  closesAt: string,
  status: WindowLike['status'] = 'SCHEDULED',
): WindowLike => ({
  status,
  opensAt: new Date(opensAt),
  closesAt: new Date(closesAt),
});

describe('window status transitions', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const win = w('2026-11-02T04:30:00Z', '2026-11-02T06:30:00Z');

  it('moves SCHEDULED to OPEN to CLOSED as time passes', () => {
    const seen: string[] = [];
    for (const at of ['04:29:59', '04:30:00', '05:00:00', '06:29:59', '06:30:00', '09:00:00']) {
      vi.setSystemTime(new Date(`2026-11-02T${at}Z`));
      seen.push(statusAt(win, new Date()));
    }
    expect(seen).toEqual(['SCHEDULED', 'OPEN', 'OPEN', 'OPEN', 'CLOSED', 'CLOSED']);
  });

  it('is active from opensAt up to but not including closesAt (hard stop)', () => {
    expect(isWindowActive(win, new Date('2026-11-02T04:29:59Z'))).toBe(false);
    expect(isWindowActive(win, new Date('2026-11-02T04:30:00Z'))).toBe(true);
    expect(isWindowActive(win, new Date('2026-11-02T06:29:59.999Z'))).toBe(true);
    expect(isWindowActive(win, new Date('2026-11-02T06:30:00Z'))).toBe(false);
  });

  it('decides by time even when the tick has not updated the status yet', () => {
    const stale = { ...win, status: 'OPEN' as const };
    expect(isWindowActive(stale, new Date('2026-11-02T07:00:00Z'))).toBe(false);
    expect(isWindowActive(win, new Date('2026-11-02T05:00:00Z'))).toBe(true); // still SCHEDULED
  });

  it('a CLOSED or CANCELLED window never reopens', () => {
    const now = new Date('2026-11-02T05:00:00Z');
    expect(isWindowActive({ ...win, status: 'CLOSED' }, now)).toBe(false);
    expect(isWindowActive({ ...win, status: 'CANCELLED' }, now)).toBe(false);
    expect(statusAt({ ...win, status: 'CLOSED' }, now)).toBe('CLOSED');
    expect(statusAt({ ...win, status: 'CANCELLED' }, now)).toBe('CANCELLED');
  });

  it('the instant of a window is the same in every time zone; only the display changes', () => {
    // 10:00 to 12:00 in Asia/Kolkata is 04:30 to 06:30 UTC; the same moment in New York is 23:30 to 01:30.
    const instant = new Date('2026-11-02T05:00:00Z');
    expect(isWindowActive(win, instant)).toBe(true);
    const banner = warningBanner(
      new Date('2026-11-02T06:30:00Z'),
      new Date('2026-11-02T06:27:00Z'),
      'Asia/Kolkata',
    );
    expect(banner).toBe('Class ends at 12:00 PM. Save your work.');
    const ny = warningBanner(
      new Date('2026-11-02T06:30:00Z'),
      new Date('2026-11-02T06:27:00Z'),
      'America/New_York',
    );
    expect(ny).toBe('Class ends at 1:30 AM. Save your work.');
  });
});

describe('five minute warning', () => {
  const closes = new Date('2026-11-02T06:30:00Z');
  const at = (m: number) => new Date(closes.getTime() - m * 60_000);

  it('appears in the last five minutes only', () => {
    expect(warningBanner(closes, at(6))).toBeNull();
    expect(warningBanner(closes, at(5.01))).toBeNull();
    expect(warningBanner(closes, at(5))).toMatch(/^Class ends at .* Save your work\.$/);
    expect(warningBanner(closes, at(1))).not.toBeNull();
  });
  it('is gone at and after the close, and when the class is closed', () => {
    expect(warningBanner(closes, at(0))).toBeNull();
    expect(warningBanner(closes, at(-1))).toBeNull();
    expect(warningBanner(null, at(3))).toBeNull();
  });
  it('counts minutes left', () => {
    expect(minutesLeft(closes, at(4))).toBe(4);
  });
});

describe('openUntil (overlapping and back to back windows)', () => {
  const now = new Date('2026-11-02T05:00:00Z');
  it('is null when nothing covers now', () => {
    expect(openUntil([w('2026-11-02T07:00:00Z', '2026-11-02T08:00:00Z')], now)).toBeNull();
    expect(openUntil([], now)).toBeNull();
  });
  it('is the end of the covering window', () => {
    expect(openUntil([w('2026-11-02T04:00:00Z', '2026-11-02T06:00:00Z')], now)?.toISOString()).toBe(
      '2026-11-02T06:00:00.000Z',
    );
  });
  it('follows overlapping windows to the last end', () => {
    const list = [
      w('2026-11-02T04:00:00Z', '2026-11-02T06:00:00Z'),
      w('2026-11-02T05:30:00Z', '2026-11-02T07:00:00Z'),
    ];
    expect(openUntil(list, now)?.toISOString()).toBe('2026-11-02T07:00:00.000Z');
  });
  it('follows back to back windows, so the warning fires at the real end', () => {
    const list = [
      w('2026-11-02T04:00:00Z', '2026-11-02T06:00:00Z'),
      w('2026-11-02T06:00:00Z', '2026-11-02T07:00:00Z'),
      w('2026-11-02T08:00:00Z', '2026-11-02T09:00:00Z'),
    ];
    expect(openUntil(list, now)?.toISOString()).toBe('2026-11-02T07:00:00.000Z');
  });
  it('ignores closed and cancelled windows', () => {
    expect(
      openUntil([{ ...w('2026-11-02T04:00:00Z', '2026-11-02T06:00:00Z'), status: 'CLOSED' }], now),
    ).toBeNull();
  });
});
