import { useState } from 'react';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  DvDateRange,
  PRESET_ROW_LABELS,
  PRESET_SETS,
  formatRange,
  parseIsoDate,
  resolvePreset,
  triggerLabel,
  type DateRangeValue,
} from '@/components/dv';
import { TODAY, renderDv } from './test-utils';

const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);

describe('date presets', () => {
  it('grid and history sets list the presets in the explore order', () => {
    expect(PRESET_SETS.grid.map((id) => PRESET_ROW_LABELS[id])).toEqual([
      'Custom',
      'Today',
      'Yesterday',
      'Last 7 days',
      'Last 14 days',
      'Last 30 days',
      'Month to date',
      'Quarter to date',
      'Year to date',
      'Lifetime',
      '[n] days up to today',
      '[n] days up to yesterday',
    ]);
    expect(PRESET_SETS.history.map((id) => PRESET_ROW_LABELS[id])).toEqual([
      'Custom',
      'Today',
      'Yesterday',
      'This week (Sun - Today)',
      'Last 7 days',
      'Last week (Sun - Sat)',
      'Last 14 days',
      'This month',
      'Last 30 days',
      'Last month',
      'Last 2 years',
      '[n] days up to today',
      '[n] days up to yesterday',
    ]);
  });

  it('resolves relative presets against the simulator clock (Wed 28 Oct 2026)', () => {
    expect(resolvePreset('today', TODAY)).toEqual({ start: d(2026, 10, 28), end: d(2026, 10, 28) });
    expect(resolvePreset('yesterday', TODAY)).toEqual({
      start: d(2026, 10, 27),
      end: d(2026, 10, 27),
    });
    expect(resolvePreset('last7', TODAY)).toEqual({ start: d(2026, 10, 21), end: d(2026, 10, 27) });
    expect(resolvePreset('last14', TODAY)).toEqual({
      start: d(2026, 10, 14),
      end: d(2026, 10, 27),
    });
    expect(resolvePreset('last30', TODAY)).toEqual({ start: d(2026, 9, 28), end: d(2026, 10, 27) });
    expect(resolvePreset('thisWeek', TODAY)).toEqual({
      start: d(2026, 10, 25),
      end: d(2026, 10, 28),
    });
    expect(resolvePreset('lastWeek', TODAY)).toEqual({
      start: d(2026, 10, 18),
      end: d(2026, 10, 24),
    });
    expect(resolvePreset('thisMonth', TODAY)).toEqual({
      start: d(2026, 10, 1),
      end: d(2026, 10, 28),
    });
    expect(resolvePreset('lastMonth', TODAY)).toEqual({
      start: d(2026, 9, 1),
      end: d(2026, 9, 30),
    });
    expect(resolvePreset('monthToDate', TODAY)).toEqual({
      start: d(2026, 10, 1),
      end: d(2026, 10, 28),
    });
    expect(resolvePreset('quarterToDate', TODAY)).toEqual({
      start: d(2026, 10, 1),
      end: d(2026, 10, 28),
    });
    expect(resolvePreset('yearToDate', TODAY)).toEqual({
      start: d(2026, 1, 1),
      end: d(2026, 10, 28),
    });
    expect(resolvePreset('last2Years', TODAY).start).toEqual(d(2024, 10, 29));
    expect(resolvePreset('daysToToday', TODAY, 90)).toEqual({
      start: d(2026, 7, 31),
      end: d(2026, 10, 28),
    });
    expect(resolvePreset('daysToYesterday', TODAY, 7)).toEqual({
      start: d(2026, 10, 21),
      end: d(2026, 10, 27),
    });
  });

  it('ignores the wall clock: a different "today" gives a different range', () => {
    expect(resolvePreset('yesterday', d(2027, 1, 1))).toEqual({
      start: d(2026, 12, 31),
      end: d(2026, 12, 31),
    });
  });

  it('formats trigger labels', () => {
    expect(
      triggerLabel({ start: d(2026, 10, 27), end: d(2026, 10, 27), preset: 'yesterday' }),
    ).toBe('Yesterday');
    expect(triggerLabel({ start: d(2026, 10, 21), end: d(2026, 10, 27), preset: 'custom' })).toBe(
      'Oct 21 - 27, 2026',
    );
    expect(
      triggerLabel({
        start: d(2026, 7, 31),
        end: d(2026, 10, 28),
        preset: 'daysToToday',
        days: 90,
      }),
    ).toBe('90 days to today');
    expect(
      triggerLabel({
        start: d(2026, 10, 21),
        end: d(2026, 10, 27),
        preset: 'daysToYesterday',
        days: 7,
      }),
    ).toBe('7 days to yesterday');
    expect(triggerLabel({ start: d(2026, 10, 27), end: d(2026, 10, 27) })).toBe('Oct 27, 2026');
  });

  it('formats ranges across months and years', () => {
    expect(formatRange(d(2026, 10, 21), d(2026, 11, 3))).toBe('Oct 21 - Nov 3, 2026');
    expect(formatRange(d(2025, 12, 28), d(2026, 1, 3))).toBe('Dec 28, 2025 - Jan 3, 2026');
  });

  it('parses yyyy-mm-dd and rejects anything else', () => {
    expect(parseIsoDate('2026-10-21')).toEqual(d(2026, 10, 21));
    expect(parseIsoDate('2026-02-30')).toBeNull();
    expect(parseIsoDate('10/21/2026')).toBeNull();
  });
});

function Harness({
  set = 'grid',
  singleDay = false,
  initial,
}: {
  set?: 'grid' | 'history';
  singleDay?: boolean;
  initial?: DateRangeValue;
}) {
  const [value, setValue] = useState<DateRangeValue>(
    initial ?? { start: d(2026, 10, 27), end: d(2026, 10, 27), preset: 'yesterday' },
  );
  return (
    <DvDateRange
      value={value}
      onChange={setValue}
      presets={set}
      today={TODAY}
      singleDay={singleDay}
    />
  );
}

describe('DvDateRange', () => {
  it('shows the trigger label and opens the preset list for the grid set', async () => {
    const user = userEvent.setup();
    renderDv(<Harness />);
    const trigger = screen.getByRole('button', { name: /Yesterday/ });
    await user.click(trigger);
    const list = screen.getByRole('menu', { name: 'Date presets' });
    const items = within(list).getAllByRole('menuitem');
    expect(items).toHaveLength(12);
    expect(items[0]).toHaveTextContent('Custom');
    expect(within(list).getByRole('menuitem', { name: 'Yesterday' })).toHaveClass('Mui-selected');
    expect(within(list).queryByText('This week (Sun - Today)')).not.toBeInTheDocument();
  });

  it('shows the longer list for the history set', async () => {
    const user = userEvent.setup();
    renderDv(<Harness set="history" />);
    await user.click(screen.getByRole('button', { name: /Yesterday/ }));
    const items = within(screen.getByRole('menu', { name: 'Date presets' })).getAllByRole(
      'menuitem',
    );
    expect(items).toHaveLength(13);
    expect(screen.getByRole('menuitem', { name: 'Last week (Sun - Sat)' })).toBeInTheDocument();
  });

  it('applies a preset and updates the trigger label', async () => {
    const user = userEvent.setup();
    renderDv(<Harness />);
    await user.click(screen.getByRole('button', { name: /Yesterday/ }));
    await user.click(screen.getByRole('menuitem', { name: 'Last 7 days' }));
    expect(screen.getByLabelText('Start date')).toHaveValue('2026-10-21');
    expect(screen.getByLabelText('End date')).toHaveValue('2026-10-27');
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(screen.getByRole('button', { name: /Last 7 days/ })).toBeInTheDocument();
  });

  it('Cancel leaves the value alone', async () => {
    const user = userEvent.setup();
    renderDv(<Harness />);
    await user.click(screen.getByRole('button', { name: /Yesterday/ }));
    await user.click(screen.getByRole('menuitem', { name: 'Last 7 days' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: /Yesterday/ })).toBeInTheDocument();
  });

  it('picks a custom range from the calendar and labels it "Oct 21 - 27, 2026"', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderDv(
      <DvDateRange
        value={{ start: d(2026, 10, 27), end: d(2026, 10, 27), preset: 'yesterday' }}
        onChange={onChange}
        presets="grid"
        today={TODAY}
      />,
    );
    await user.click(screen.getByRole('button', { name: /Yesterday/ }));
    const oct = screen.getByRole('grid', { name: 'October 2026' });
    await user.click(within(oct).getByRole('button', { name: 'Oct 21, 2026' }));
    await user.click(within(oct).getByRole('button', { name: 'Oct 27, 2026' }));
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(onChange).toHaveBeenCalledWith({
      start: d(2026, 10, 21),
      end: d(2026, 10, 27),
      preset: 'custom',
    });
  });

  it('shows two stacked calendars, a selected-day circle and greyed future days', async () => {
    const user = userEvent.setup();
    renderDv(<Harness />);
    await user.click(screen.getByRole('button', { name: /Yesterday/ }));
    expect(screen.getByRole('grid', { name: 'October 2026' })).toBeInTheDocument();
    expect(screen.getByRole('grid', { name: 'November 2026' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Oct 27, 2026' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Oct 29, 2026' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Oct 28, 2026' })).toBeEnabled();
  });

  it('accepts typed start and end dates and rejects future dates', async () => {
    const user = userEvent.setup();
    renderDv(<Harness />);
    await user.click(screen.getByRole('button', { name: /Yesterday/ }));
    const start = screen.getByLabelText('Start date');
    await user.clear(start);
    await user.type(start, '2026-10-01{Enter}');
    expect(start).toHaveValue('2026-10-01');
    const end = screen.getByLabelText('End date');
    await user.clear(end);
    await user.type(end, '2026-12-25{Enter}');
    expect(end).toHaveValue('2026-10-27');
  });

  it('single-day mode sets start and end to the clicked day', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderDv(
      <DvDateRange
        value={{ start: d(2026, 10, 27), end: d(2026, 10, 27), preset: 'yesterday' }}
        onChange={onChange}
        presets="grid"
        today={TODAY}
        singleDay
      />,
    );
    await user.click(screen.getByRole('button', { name: /Yesterday/ }));
    await user.click(screen.getByRole('button', { name: 'Oct 20, 2026' }));
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(onChange).toHaveBeenCalledWith({
      start: d(2026, 10, 20),
      end: d(2026, 10, 20),
      preset: 'custom',
    });
  });

  it('edits the number of days inside the "[n] days up to today" row', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderDv(
      <DvDateRange
        value={{ start: d(2026, 10, 27), end: d(2026, 10, 27), preset: 'yesterday' }}
        onChange={onChange}
        presets="grid"
        today={TODAY}
      />,
    );
    await user.click(screen.getByRole('button', { name: /Yesterday/ }));
    const days = screen.getAllByLabelText('Number of days')[0]!;
    await user.clear(days);
    await user.type(days, '90');
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(onChange).toHaveBeenCalledWith({
      start: d(2026, 7, 31),
      end: d(2026, 10, 28),
      preset: 'daysToToday',
      days: 90,
    });
  });

  it('moves between days with arrow keys and months with PageUp / PageDown', async () => {
    const user = userEvent.setup();
    renderDv(<Harness />);
    await user.click(screen.getByRole('button', { name: /Yesterday/ }));
    const day = screen.getByRole('button', { name: 'Oct 27, 2026' });
    day.focus();
    await user.keyboard('{ArrowLeft}');
    expect(document.activeElement).toHaveAccessibleName('Oct 26, 2026');
    await user.keyboard('{ArrowUp}');
    expect(document.activeElement).toHaveAccessibleName('Oct 19, 2026');
    await user.keyboard('{PageUp}');
    expect(document.activeElement).toHaveAccessibleName('Sep 19, 2026');
    await user.keyboard('{Enter}');
    expect(screen.getByLabelText('Start date')).toHaveValue('2026-09-19');
  });

  it('closes with Escape', async () => {
    const user = userEvent.setup();
    renderDv(<Harness />);
    await user.click(screen.getByRole('button', { name: /Yesterday/ }));
    expect(screen.getByRole('dialog', { name: 'Select date range' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Select date range' })).not.toBeInTheDocument();
  });
});
