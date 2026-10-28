import { useState } from 'react';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DvGrid, DvNameCell, rangeText, type DvColumn } from '@/components/dv';
import { renderDv } from './test-utils';

interface Row {
  id: string;
  name: string;
  budget: number | null;
  ctr: number | null;
  children?: Row[];
}

const ROWS: Row[] = [
  { id: 'a', name: 'Alpha', budget: 1200, ctr: 0.5 },
  { id: 'b', name: 'Beta', budget: null, ctr: null },
  { id: 'c', name: 'Gamma', budget: 3000.5, ctr: 12.345 },
];

const COLUMNS: DvColumn<Row>[] = [
  {
    id: 'name',
    header: 'Name',
    type: 'link',
    sticky: true,
    width: 200,
    cell: (r) => <DvNameCell name={r.name} id={r.id} href="#" />,
  },
  {
    id: 'budget',
    header: 'Budget',
    type: 'currency',
    group: 'Money',
    sortable: true,
    total: (rows) => rows.length,
  },
  { id: 'ctr', header: 'CTR', type: 'percent', group: 'Money', sortable: true },
];

const GROUPS = [{ id: 'Money', label: 'Money', collapsible: true }];

function Harness(props: Partial<React.ComponentProps<typeof DvGrid<Row>>>) {
  const [selection, setSelection] = useState<Set<string>>(new Set());
  return (
    <DvGrid<Row>
      ariaLabel="Test grid"
      rows={ROWS}
      columns={COLUMNS}
      groups={GROUPS}
      getRowId={(r) => r.id}
      selection={selection}
      onSelectionChange={setSelection}
      page={1}
      pageSize={20}
      total={57}
      onPageChange={() => {}}
      {...props}
    />
  );
}

describe('DvGrid', () => {
  it('renders two header rows, group labels and a grid role', () => {
    renderDv(<Harness />);
    const grid = screen.getByRole('grid', { name: 'Test grid' });
    expect(grid).toBeInTheDocument();
    expect(within(grid).getAllByRole('row').length).toBeGreaterThanOrEqual(5);
    expect(screen.getByRole('columnheader', { name: 'Money' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Budget' })).toBeInTheDocument();
  });

  it('formats cells: currency, percent, hyphen for empty, right alignment', () => {
    renderDv(<Harness />);
    expect(screen.getByText('₹1,200.00')).toBeInTheDocument();
    expect(screen.getByText('₹3,000.50')).toBeInTheDocument();
    expect(screen.getByText('12.35%')).toBeInTheDocument();
    expect(screen.getAllByText('-').length).toBe(2);
    const cell = screen.getByText('₹1,200.00').closest('td');
    expect(cell).toHaveStyle({ textAlign: 'right' });
  });

  it('shows the name with the grey ID underneath', () => {
    renderDv(<Harness />);
    const link = screen.getByRole('link', { name: 'Alpha' });
    expect(link).toHaveAttribute('href', '#');
    expect(screen.getByText('a')).toBeInTheDocument();
  });

  it('select all: empty, indeterminate and checked', async () => {
    const user = userEvent.setup();
    renderDv(<Harness />);
    const all = screen.getByRole('checkbox', { name: 'Select all rows' });
    expect(all).not.toBeChecked();
    expect(all).not.toBePartiallyChecked();

    await user.click(screen.getByRole('checkbox', { name: 'Select row a' }));
    expect(all).toBePartiallyChecked();

    await user.click(all);
    expect(all).toBeChecked();
    for (const id of ['a', 'b', 'c'])
      expect(screen.getByRole('checkbox', { name: `Select row ${id}` })).toBeChecked();

    await user.click(all);
    expect(all).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Select row a' })).not.toBeChecked();
  });

  it('collapses and expands a column group', async () => {
    const user = userEvent.setup();
    renderDv(<Harness />);
    expect(screen.getByRole('columnheader', { name: 'Budget' })).toBeInTheDocument();
    const collapse = screen.getByRole('button', { name: 'Collapse Money' });
    expect(collapse).toHaveAttribute('aria-expanded', 'true');
    await user.click(collapse);
    expect(screen.queryByRole('columnheader', { name: 'Budget' })).not.toBeInTheDocument();
    expect(screen.getByText('Money (2)')).toBeInTheDocument();
    const expand = screen.getByRole('button', { name: 'Expand Money' });
    expect(expand).toHaveAttribute('aria-expanded', 'false');
    await user.click(expand);
    expect(screen.getByRole('columnheader', { name: 'Budget' })).toBeInTheDocument();
  });

  it('reports collapsed groups when controlled', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderDv(<Harness collapsedGroups={[]} onCollapsedGroupsChange={onChange} />);
    await user.click(screen.getByRole('button', { name: 'Collapse Money' }));
    expect(onChange).toHaveBeenCalledWith(['Money']);
  });

  it('keeps the header sticky and pins the name column', () => {
    renderDv(<Harness />);
    expect(screen.getByRole('columnheader', { name: 'Money' })).toHaveStyle({ position: 'sticky' });
    expect(screen.getByRole('columnheader', { name: 'Budget' })).toHaveStyle({
      position: 'sticky',
    });
    expect(screen.getByRole('columnheader', { name: 'Name' })).toHaveStyle({
      position: 'sticky',
      left: '48px',
    });
  });

  it('cycles sort asc, desc, none and sets aria-sort', async () => {
    const user = userEvent.setup();
    const onSortChange = vi.fn();
    const { rerender: _ } = renderDv(<Harness sort={undefined} onSortChange={onSortChange} />);
    expect(screen.getByRole('columnheader', { name: 'Budget' })).toHaveAttribute(
      'aria-sort',
      'none',
    );
    await user.click(screen.getByRole('button', { name: 'Budget' }));
    expect(onSortChange).toHaveBeenLastCalledWith({ id: 'budget', dir: 'asc' });
  });

  it('moves from asc to desc and then clears', async () => {
    const user = userEvent.setup();
    const onSortChange = vi.fn();
    renderDv(<Harness sort={{ id: 'budget', dir: 'asc' }} onSortChange={onSortChange} />);
    expect(screen.getByRole('columnheader', { name: 'Budget' })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
    await user.click(screen.getByRole('button', { name: 'Budget' }));
    expect(onSortChange).toHaveBeenLastCalledWith({ id: 'budget', dir: 'desc' });
  });

  it('clears the sort after desc', async () => {
    const user = userEvent.setup();
    const onSortChange = vi.fn();
    renderDv(<Harness sort={{ id: 'budget', dir: 'desc' }} onSortChange={onSortChange} />);
    expect(screen.getByRole('columnheader', { name: 'Budget' })).toHaveAttribute(
      'aria-sort',
      'descending',
    );
    await user.click(screen.getByRole('button', { name: 'Budget' }));
    expect(onSortChange).toHaveBeenLastCalledWith(undefined);
  });

  it('shows the total row text "Total: Display" and column totals in bold', () => {
    renderDv(<Harness totalRow totalLabel="Total: Display" />);
    const label = screen.getByText('Total: Display');
    expect(label).toBeInTheDocument();
    expect(label.closest('td')).toHaveStyle({ fontWeight: '500' });
    expect(within(label.closest('tr') as HTMLElement).getByText('3')).toBeInTheDocument();
  });

  it('shows 8 skeleton rows while loading and keeps the headers', () => {
    renderDv(<Harness rows={[]} loading total={0} />);
    expect(screen.getByRole('columnheader', { name: 'Budget' })).toBeInTheDocument();
    expect(document.querySelectorAll('tbody tr')).toHaveLength(8);
    expect(screen.queryByText('No results.')).not.toBeInTheDocument();
  });

  it('shows the empty state', () => {
    renderDv(<Harness rows={[]} total={0} />);
    expect(screen.getByText('No results.')).toBeInTheDocument();
    expect(screen.getByText('0 of 0')).toBeInTheDocument();
  });

  it('shows a custom empty state', () => {
    renderDv(<Harness rows={[]} total={0} emptyState={<p>Nothing here</p>} />);
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });

  it('shows the error banner above the grid', () => {
    renderDv(<Harness error={<span>Could not load</span>} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load');
  });

  it('renders the pager: "Show rows:", range text, page size options', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    renderDv(<Harness page={2} pageSize={20} total={57} onPageChange={onPageChange} />);
    expect(screen.getByText('Show rows:')).toBeInTheDocument();
    expect(screen.getByText('21 - 40 of 57')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next page' }));
    expect(onPageChange).toHaveBeenLastCalledWith(3, 20);
    await user.click(screen.getByRole('button', { name: 'Last page' }));
    expect(onPageChange).toHaveBeenLastCalledWith(3, 20);
    await user.click(screen.getByRole('button', { name: 'First page' }));
    expect(onPageChange).toHaveBeenLastCalledWith(1, 20);
    await user.click(screen.getByRole('combobox'));
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      '10',
      '20',
      '50',
      '100',
    ]);
    await user.click(screen.getByRole('option', { name: '50' }));
    expect(onPageChange).toHaveBeenLastCalledWith(1, 50);
  });

  it('disables previous and first on page 1, next and last on the last page', () => {
    renderDv(<Harness page={1} total={10} />);
    expect(screen.getByRole('button', { name: 'First page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Last page' })).toBeDisabled();
  });

  it('rangeText formats the visible range', () => {
    expect(rangeText(1, 20, 57)).toBe('1 - 20 of 57');
    expect(rangeText(3, 20, 57)).toBe('41 - 57 of 57');
    expect(rangeText(1, 20, 0)).toBe('0 of 0');
  });

  it('shows the alert bell column and status column with the Activate / Pause menu', async () => {
    const user = userEvent.setup();
    const onStatusChange = vi.fn();
    const onAlertClick = vi.fn();
    renderDv(
      <Harness
        getAlert={(r) => (r.id === 'a' ? 'critical' : r.id === 'b' ? 'warning' : null)}
        onAlertClick={onAlertClick}
        getStatus={() => 'active'}
        onStatusChange={onStatusChange}
      />,
    );
    expect(screen.getByRole('columnheader', { name: /Alerts/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Critical alert' }));
    expect(onAlertClick).toHaveBeenCalledWith(ROWS[0]);
    expect(screen.getByRole('button', { name: 'Needs attention' })).toBeInTheDocument();
    expect(screen.getAllByRole('img', { name: 'Active' })).toHaveLength(3);

    await user.click(screen.getAllByRole('button', { name: 'Change status' })[0]!);
    expect(screen.getByRole('menuitem', { name: 'Activate' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await user.click(screen.getByRole('menuitem', { name: 'Pause' }));
    expect(onStatusChange).toHaveBeenCalledWith(ROWS[0], 'paused');
  });

  it('renders section rows', () => {
    renderDv(
      <Harness
        sections={[
          { id: 's1', label: 'Action required', rowIds: ['a'] },
          { id: 's2', label: 'Everything else', rowIds: ['b', 'c'] },
        ]}
      />,
    );
    const labels = screen.getAllByText(/Action required|Everything else/).map((n) => n.textContent);
    expect(labels).toEqual(['Action required', 'Everything else']);
  });

  it('expands tree rows', async () => {
    const user = userEvent.setup();
    const tree: Row[] = [
      {
        id: 'o',
        name: 'Order',
        budget: 1,
        ctr: 1,
        children: [{ id: 'd', name: 'Deal', budget: 1, ctr: 1 }],
      },
    ];
    renderDv(<Harness rows={tree} total={1} getChildren={(r) => r.children ?? []} />);
    expect(screen.getByRole('treegrid')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Deal' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Expand row' }));
    expect(screen.getByRole('link', { name: 'Deal' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Collapse row' }));
    expect(screen.queryByRole('link', { name: 'Deal' })).not.toBeInTheDocument();
  });

  it('moves between cells with the arrow keys and selects with Space', async () => {
    const user = userEvent.setup();
    renderDv(<Harness />);
    const first = document.querySelector<HTMLElement>('[data-r="1"][data-c="0"]')!;
    first.focus();
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toHaveAttribute('data-c', '1');
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toHaveAttribute('data-r', '2');
    await user.keyboard('{ArrowLeft}');
    expect(document.activeElement).toHaveAttribute('data-c', '0');
    await user.keyboard(' ');
    expect(screen.getByRole('checkbox', { name: 'Select row b' })).toBeChecked();
  });

  it('greys archived rows and shows row actions in the name cell', () => {
    renderDv(
      <Harness
        isArchived={(r) => r.id === 'a'}
        rowActions={(r) => <button type="button">Edit {r.id}</button>}
      />,
    );
    expect(screen.getByRole('button', { name: 'Edit a' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Alpha' }).closest('td')).toHaveStyle({
      color: 'rgb(95, 99, 104)',
    });
  });
});
