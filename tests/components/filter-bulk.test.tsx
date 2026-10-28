import { useState } from 'react';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  DvBulkBar,
  DvFilterBar,
  FILTER_PLACEHOLDER,
  filterChipText,
  selectedText,
  type BulkMenuGroup,
  type FilterField,
  type FilterValue,
} from '@/components/dv';
import { renderDv } from './test-utils';

const FIELDS: FilterField[] = [
  {
    id: 'status',
    label: 'Status',
    type: 'multi',
    options: [
      { value: 'active', label: 'Active' },
      { value: 'paused', label: 'Paused' },
      { value: 'deleting', label: 'Scheduled for deletion' },
    ],
  },
  {
    id: 'type',
    label: 'Type',
    type: 'single',
    options: [
      { value: 'display', label: 'Display' },
      { value: 'video', label: 'Video' },
    ],
  },
];

function Harness({ initial = [] }: { initial?: FilterValue[] }) {
  const [value, setValue] = useState<FilterValue[]>(initial);
  const [text, setText] = useState('');
  return (
    <DvFilterBar
      fields={FIELDS}
      value={value}
      text={text}
      onChange={(v, t) => {
        setValue(v);
        setText(t);
      }}
    />
  );
}

describe('DvFilterBar', () => {
  it('shows the placeholder "Enter a search term or select filters"', () => {
    renderDv(<Harness />);
    expect(
      screen.getByPlaceholderText('Enter a search term or select filters'),
    ).toBeInTheDocument();
    expect(FILTER_PLACEHOLDER).toBe('Enter a search term or select filters');
  });

  it('formats chip text: single value, multi value', () => {
    expect(filterChipText(FIELDS[0], { fieldId: 'status', values: ['active'] })).toBe(
      'Status: Active',
    );
    expect(
      filterChipText(FIELDS[0], { fieldId: 'status', values: ['a', 'b', 'c', 'd', 'e'] }),
    ).toBe('Status: 5 selected');
    expect(filterChipText(FIELDS[0], { fieldId: 'status', values: ['active', 'paused'] })).toBe(
      'Status: 2 selected',
    );
    expect(filterChipText(undefined, { fieldId: '__nameId', values: ['abc'] })).toBe(
      'Name/ID: abc',
    );
  });

  it('renders chips from the value and the funnel count badge', () => {
    renderDv(
      <Harness
        initial={[
          { fieldId: 'status', values: ['active'] },
          { fieldId: 'type', values: ['video'] },
        ]}
      />,
    );
    expect(screen.getByRole('button', { name: 'Status: Active' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Type: Video' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Filters, 2 active' })).toBeInTheDocument();
  });

  it('has no badge or chips without filters', () => {
    renderDv(<Harness />);
    expect(screen.getByRole('button', { name: 'Filters' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear all' })).not.toBeInTheDocument();
  });

  it('funnel popover lists the active filters', async () => {
    const user = userEvent.setup();
    renderDv(<Harness initial={[{ fieldId: 'status', values: ['active'] }]} />);
    await user.click(screen.getByRole('button', { name: 'Filters, 1 active' }));
    expect(
      within(screen.getByRole('list', { name: 'Active filters' })).getByText('Status: Active'),
    ).toBeInTheDocument();
  });

  it('chip editor: title, "Matches:", options and Apply, then updates the chip text', async () => {
    const user = userEvent.setup();
    renderDv(<Harness initial={[{ fieldId: 'status', values: ['active'] }]} />);
    await user.click(screen.getByRole('button', { name: 'Status: Active' }));
    const editor = screen.getByRole('dialog', { name: 'Edit filter Status' });
    expect(within(editor).getByRole('heading', { name: 'Status' })).toBeInTheDocument();
    expect(within(editor).getByText('Matches:')).toBeInTheDocument();
    expect(within(editor).getByRole('checkbox', { name: 'Active' })).toBeChecked();
    await user.click(within(editor).getByRole('checkbox', { name: 'Paused' }));
    await user.click(within(editor).getByRole('button', { name: 'Apply' }));
    expect(screen.getByRole('button', { name: 'Status: 2 selected' })).toBeInTheDocument();
  });

  it('single-select editor uses radios', async () => {
    const user = userEvent.setup();
    renderDv(<Harness initial={[{ fieldId: 'type', values: ['display'] }]} />);
    await user.click(screen.getByRole('button', { name: 'Type: Display' }));
    await user.click(screen.getByRole('radio', { name: 'Video' }));
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(screen.getByRole('button', { name: 'Type: Video' })).toBeInTheDocument();
  });

  it('removes a chip with its remove control', async () => {
    const user = userEvent.setup();
    renderDv(<Harness initial={[{ fieldId: 'status', values: ['active'] }]} />);
    await user.click(screen.getByRole('img', { name: 'Remove filter Status: Active' }));
    expect(screen.queryByRole('button', { name: 'Status: Active' })).not.toBeInTheDocument();
  });

  it('Apply with nothing checked removes the filter', async () => {
    const user = userEvent.setup();
    renderDv(<Harness initial={[{ fieldId: 'status', values: ['active'] }]} />);
    await user.click(screen.getByRole('button', { name: 'Status: Active' }));
    await user.click(screen.getByRole('checkbox', { name: 'Active' }));
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(screen.queryByRole('button', { name: /Status:/ })).not.toBeInTheDocument();
  });

  it('typing opens the popover "Search for Name/ID containing:" and "Filter on:"; Enter makes a text chip', async () => {
    const user = userEvent.setup();
    renderDv(<Harness />);
    await user.type(screen.getByRole('textbox', { name: 'Search or filter' }), 'autumn');
    expect(screen.getByText('Search for Name/ID containing: autumn')).toBeInTheDocument();
    expect(screen.getByText('Filter on:')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Status' })).toBeInTheDocument();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('button', { name: 'Name/ID: autumn' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Search or filter' })).toHaveValue('');
  });

  it('picking a field in the typing popover opens its editor', async () => {
    const user = userEvent.setup();
    renderDv(<Harness />);
    await user.type(screen.getByRole('textbox', { name: 'Search or filter' }), 'x');
    await user.click(screen.getByRole('button', { name: 'Status' }));
    expect(screen.getByRole('dialog', { name: 'Edit filter Status' })).toBeInTheDocument();
  });

  it('Clear all removes chips and text', async () => {
    const user = userEvent.setup();
    renderDv(
      <Harness
        initial={[
          { fieldId: 'status', values: ['active'] },
          { fieldId: 'type', values: ['video'] },
        ]}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(screen.queryByRole('button', { name: /Status:|Type:/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Filters' })).toBeInTheDocument();
  });

  it('read-only (disabled) bar cannot be edited', () => {
    renderDv(
      <DvFilterBar
        fields={FIELDS}
        value={[{ fieldId: 'status', values: ['active'] }]}
        text=""
        onChange={() => {}}
        disabled
      />,
    );
    expect(screen.getByRole('textbox', { name: 'Search or filter' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Filters, 1 active' })).toBeDisabled();
  });
});

const GROUPS: BulkMenuGroup[] = [
  {
    label: 'Status',
    items: [
      { id: 'activate', label: 'Activate' },
      { id: 'pause', label: 'Pause' },
    ],
  },
  {
    label: 'Bulk apply',
    items: [
      {
        id: 'template',
        label: 'Targeting template',
        disabled: true,
        disabledReason: 'Select line items first',
      },
    ],
  },
  {
    label: 'Bulk edit',
    items: [
      {
        id: 'inventory',
        label: 'Inventory',
        children: [{ id: 'inv-src', label: 'Inventory source' }],
      },
    ],
  },
  {
    label: 'Bulk action',
    items: [
      { id: 'archive', label: 'Archive' },
      { id: 'duplicate', label: 'Duplicate', shortcut: '⌘+D' },
    ],
  },
  { label: 'SDF', items: [{ id: 'download', label: 'Download', shortcut: '⌘+Shift+K' }] },
];

describe('DvBulkBar', () => {
  it('formats "{n} row(s) selected"', () => {
    expect(selectedText(1)).toBe('1 row selected');
    expect(selectedText(3)).toBe('3 rows selected');
  });

  it('renders nothing when no rows are selected', () => {
    renderDv(<DvBulkBar count={0} groups={GROUPS} onAction={() => {}} onClear={() => {}} />);
    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();
  });

  it('shows the blue bar with count text, Action and close', () => {
    renderDv(<DvBulkBar count={3} groups={GROUPS} onAction={() => {}} onClear={() => {}} />);
    const bar = screen.getByRole('toolbar', { name: 'Bulk actions' });
    expect(within(bar).getByText('3 rows selected')).toBeInTheDocument();
    expect(within(bar).getByRole('button', { name: 'Action' })).toBeInTheDocument();
    expect(within(bar).getByRole('button', { name: 'Clear selection' })).toBeInTheDocument();
    expect(bar).toHaveStyle({ backgroundColor: 'rgb(26, 115, 232)', height: '56px' });
  });

  it('menu groups, shortcut hints and disabled items', async () => {
    const user = userEvent.setup();
    renderDv(<DvBulkBar count={1} groups={GROUPS} onAction={() => {}} onClear={() => {}} />);
    await user.click(screen.getByRole('button', { name: 'Action' }));
    const menu = screen.getByRole('menu');
    for (const g of ['Status', 'Bulk apply', 'Bulk edit', 'Bulk action', 'SDF'])
      expect(within(menu).getByText(g)).toBeInTheDocument();
    expect(within(menu).getByText('⌘+D')).toBeInTheDocument();
    expect(within(menu).getByText('⌘+Shift+K')).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: 'Targeting template' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('runs an action and closes the menu', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    renderDv(<DvBulkBar count={2} groups={GROUPS} onAction={onAction} onClear={() => {}} />);
    await user.click(screen.getByRole('button', { name: 'Action' }));
    await user.click(screen.getByRole('menuitem', { name: 'Pause' }));
    expect(onAction).toHaveBeenCalledWith('pause');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('does not run a disabled item', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    renderDv(<DvBulkBar count={2} groups={GROUPS} onAction={onAction} onClear={() => {}} />);
    await user.click(screen.getByRole('button', { name: 'Action' }));
    const item = screen.getByRole('menuitem', { name: 'Targeting template' });
    expect(item).toHaveAttribute('aria-disabled', 'true');
    expect(item).toHaveStyle({ pointerEvents: 'none' });
    expect(onAction).not.toHaveBeenCalled();
  });

  it('opens a submenu to the right and runs a child action', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    renderDv(<DvBulkBar count={2} groups={GROUPS} onAction={onAction} onClear={() => {}} />);
    await user.click(screen.getByRole('button', { name: 'Action' }));
    await user.click(screen.getByRole('menuitem', { name: 'Inventory' }));
    await user.click(screen.getByRole('menuitem', { name: 'Inventory source' }));
    expect(onAction).toHaveBeenCalledWith('inv-src');
  });

  it('close clears the selection', async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    renderDv(<DvBulkBar count={2} groups={GROUPS} onAction={() => {}} onClear={onClear} />);
    await user.click(screen.getByRole('button', { name: 'Clear selection' }));
    expect(onClear).toHaveBeenCalledOnce();
  });

  it('Escape closes the open menu', async () => {
    const user = userEvent.setup();
    renderDv(<DvBulkBar count={2} groups={GROUPS} onAction={() => {}} onClear={() => {}} />);
    await user.click(screen.getByRole('button', { name: 'Action' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
