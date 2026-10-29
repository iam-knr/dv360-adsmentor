import { describe, expect, it } from 'vitest';
import { transition, type Status, type StatusEvent } from '@/lib/accounts/status';

describe('account status machine (module 19 4.3)', () => {
  const allowed: [Status, StatusEvent, Status][] = [
    ['ACTIVE', 'disable', 'DISABLED'],
    ['LOCKED', 'disable', 'DISABLED'],
    ['DISABLED', 'enable', 'ACTIVE'],
    ['ACTIVE', 'lock', 'LOCKED'],
    ['LOCKED', 'unlock', 'ACTIVE'],
    ['ACTIVE', 'archive', 'ARCHIVED'],
    ['DISABLED', 'archive', 'ARCHIVED'],
    ['LOCKED', 'archive', 'ARCHIVED'],
    ['ARCHIVED', 'restore', 'DISABLED'],
  ];
  it.each(allowed)('%s + %s = %s', (from, event, to) => {
    expect(transition(from, event)).toBe(to);
  });

  it('never goes ARCHIVED to ACTIVE directly', () => {
    expect(transition('ARCHIVED', 'enable')).toBeNull();
    expect(transition('ARCHIVED', 'unlock')).toBeNull();
    expect(transition('ARCHIVED', 'disable')).toBeNull();
  });

  it('refuses everything else', () => {
    const events: StatusEvent[] = ['disable', 'enable', 'lock', 'unlock', 'archive', 'restore'];
    const statuses: Status[] = ['ACTIVE', 'DISABLED', 'LOCKED', 'ARCHIVED'];
    for (const s of statuses)
      for (const e of events) {
        const ok = allowed.some(([f, ev]) => f === s && ev === e);
        expect(transition(s, e) !== null).toBe(ok);
      }
  });
});
