import { describe, expect, it } from 'vitest';
import { pickClassroom, type ClassChoice } from '@/lib/access/class-context';

const c = (classroomId: string, joined: string, open: boolean): ClassChoice => ({
  classroomId,
  joinedAt: new Date(joined),
  open,
});

describe('sandbox resolution (RC-061)', () => {
  it('has no class when there is no membership', () => {
    expect(pickClassroom([])).toBeNull();
  });
  it('takes the only class', () => {
    expect(pickClassroom([c('a', '2026-01-01', false)])).toBe('a');
  });
  it('prefers the class with an open window over a newer closed one', () => {
    expect(
      pickClassroom([c('old-open', '2026-01-01', true), c('new-closed', '2026-03-01', false)]),
    ).toBe('old-open');
  });
  it('takes the most recently joined open class when several are open', () => {
    expect(pickClassroom([c('a', '2026-01-01', true), c('b', '2026-02-01', true)])).toBe('b');
  });
  it('falls back to the most recent membership when none is open', () => {
    expect(
      pickClassroom([
        c('a', '2026-01-01', false),
        c('b', '2026-02-01', false),
        c('z', '2025-01-01', false),
      ]),
    ).toBe('b');
  });
  it('honours ?sim_class= when it is one of the choices', () => {
    const list = [c('a', '2026-01-01', true), c('b', '2026-02-01', false)];
    expect(pickClassroom(list, 'b')).toBe('b');
    expect(pickClassroom(list, 'not-mine')).toBe('a');
  });
});
