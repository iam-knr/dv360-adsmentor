import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(cleanup);
import { DayCard, headerText } from '@/components/history/DayCard';
import type { HistoryDay } from '@/lib/history/types';

const day: HistoryDay = {
  date: '2026-03-26',
  weekday: 'Thursday',
  entityLabel: 'insertion order',
  count: 2,
  notesCount: 2,
  changes: [
    { groupId: 'g1', time: '10:55:08', tzLabel: 'IST', user: 'a@example.test', system: false, summary: '1 change to insertion order', lines: ['Budget segment 1: Budget changed from "5,000.00" to "7,000.00"'] },
    { groupId: 'g2', time: '09:00:00', tzLabel: 'IST', user: 'CREATIVE_APPROVAL_SYNC', system: true, summary: '1 change to insertion order', lines: ['Status changed from "Active" to "Paused"'] },
  ],
};

describe('DayCard', () => {
  it('words the header by entity type, singular and plural', () => {
    expect(headerText(day)).toBe('2 changes to insertion order');
    expect(headerText({ ...day, count: 1 })).toBe('1 change to insertion order');
    expect(headerText({ ...day, entityLabel: '' })).toBe('2 changes');
  });
  it('shows time with zone, summary and user; expands a row on its caret', () => {
    const onToggle = vi.fn();
    render(<DayCard day={day} expanded={new Set(['g1'])} onToggle={onToggle} onAddNote={() => undefined} />);
    expect(screen.getByText('Mar 26')).toBeTruthy();
    expect(screen.getByText('10:55:08 IST')).toBeTruthy();
    expect(screen.getByText('CREATIVE_APPROVAL_SYNC')).toBeTruthy();
    expect(screen.getByText('Budget segment 1: Budget changed from "5,000.00" to "7,000.00"')).toBeTruthy();
    expect(screen.queryByText('Status changed from "Active" to "Paused"')).toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: 'Expand description' })[0]!);
    expect(onToggle).toHaveBeenCalledWith('g2');
  });
  it('shows the notes count on the Add a note link, and hides the link for read-only roles', () => {
    const { rerender } = render(<DayCard day={day} expanded={new Set()} onToggle={() => undefined} onAddNote={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Add a note (2)' })).toBeTruthy();
    rerender(<DayCard day={{ ...day, notesCount: 0 }} expanded={new Set()} onToggle={() => undefined} onAddNote={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Add a note' })).toBeTruthy();
    rerender(<DayCard day={day} expanded={new Set()} onToggle={() => undefined} onOpenNotes={() => undefined} />);
    expect(screen.queryByRole('button', { name: /Add a note/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Notes (2)' })).toBeTruthy();
  });
});
