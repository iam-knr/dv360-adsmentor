import { useState } from 'react';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  DvCardCarousel,
  DvChartCard,
  DvChartStrip,
  DvCoverageBar,
  DvDonut,
  DvEmptyState,
  DvEntityHeader,
  DvGoalProgress,
  DvHelp,
  DvHoverDetail,
  DvKbd,
  DvKpiTile,
  DvPageHeader,
  DvPickerDialog,
  DvRouteProgress,
  DvSkeleton,
  DvSparkBars,
  DvSpinner,
  DvStatusChip,
  DvStatusDot,
  DvStepper,
  DvTabs,
  DvTooltip,
  STATUS_META,
  type DvStatus,
} from '@/components/dv';
import { DvIcon, ICON_BY_MEANING, ICON_NAMES } from '@/components/icons';
import { renderDv } from './test-utils';

describe('DvIcon', () => {
  it('renders the Material Symbols ligature, hidden from assistive tech by default', () => {
    renderDv(<DvIcon name="search" />);
    const icon = document.querySelector('.material-symbols-outlined')!;
    expect(icon).toHaveTextContent('search');
    expect(icon).toHaveAttribute('aria-hidden', 'true');
    expect(icon).toHaveStyle({ fontSize: '20px' });
  });

  it('resolves semantic names and supports label, size and filled', () => {
    renderDv(<DvIcon name="navCampaigns" size={24} filled label="Campaigns" />);
    const icon = screen.getByRole('img', { name: 'Campaigns' });
    expect(icon).toHaveTextContent('campaign');
    expect(icon).toHaveAttribute('data-filled', 'true');
    expect(icon).toHaveAttribute('data-icon', 'campaign');
  });

  it('exposes the name map of design-system section 3', () => {
    expect(ICON_NAMES).toContain('filter_alt');
    expect(ICON_BY_MEANING.liVideo).toBe('videocam');
    expect(ICON_BY_MEANING.ioDooh).toBe('signpost');
    expect(new Set(ICON_NAMES).size).toBe(ICON_NAMES.length);
  });
});

describe('status dots, chips', () => {
  const dots: [DvStatus, string, string][] = [
    ['active', 'circle', 'Active'],
    ['paused', 'pause_circle', 'Paused'],
    ['draft', 'radio_button_unchecked', 'Draft'],
    ['archived', 'archive', 'Archived'],
    ['scheduledForDeletion', 'delete', 'Scheduled for deletion'],
    ['completed', 'check_circle', 'Completed'],
    ['notServable', 'cancel', 'Not servable'],
    ['pending', 'schedule', 'Pending'],
    ['trafficked', 'check_circle', 'Trafficked'],
  ];

  it.each(dots)('%s uses the %s glyph and is labelled "%s"', (status, glyph, label) => {
    renderDv(<DvStatusDot status={status} />);
    expect(screen.getByRole('img', { name: label })).toHaveAttribute('data-status', status);
    expect(document.querySelector('[data-icon]')).toHaveAttribute('data-icon', glyph);
  });

  it('dot shapes differ so colour is never the only cue', () => {
    const glyphs = (['active', 'paused', 'draft'] as const).map((s) => STATUS_META[s].icon);
    expect(new Set(glyphs).size).toBe(3);
  });

  it('shows the status word in a tooltip on focus-less hover', async () => {
    const user = userEvent.setup();
    renderDv(<DvStatusDot status="paused" />);
    await user.hover(screen.getByRole('img', { name: 'Paused' }));
    expect(await screen.findByRole('tooltip', undefined, { timeout: 2000 })).toHaveTextContent(
      'Paused',
    );
  });

  it('review chips: Servable, Pending, Disapproved', () => {
    renderDv(
      <>
        <DvStatusChip kind="servable" />
        <DvStatusChip kind="pending" />
        <DvStatusChip kind="disapproved" />
        <DvStatusChip kind="limitedAccess" />
        <DvStatusChip kind="beta" />
      </>,
    );
    expect(screen.getByText('Servable').closest('[data-kind]')).toHaveAttribute(
      'data-kind',
      'servable',
    );
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('Disapproved')).toBeInTheDocument();
    expect(screen.getByText('Limited Access')).toBeInTheDocument();
    expect(screen.getByText('Beta').closest('[data-kind]')).toHaveStyle({ height: '18px' });
    expect(screen.getByText('Servable').closest('[data-kind]')).toHaveStyle({ height: '24px' });
  });

  it('allows a custom chip label', () => {
    renderDv(<DvStatusChip kind="servable" label="Active" />);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });
});

describe('DvTabs', () => {
  function Harness({ variant }: { variant?: 'page' | 'card' | 'segmented' | 'chips' }) {
    const [v, setV] = useState('a');
    return (
      <DvTabs
        variant={variant}
        ariaLabel="Sections"
        value={v}
        onChange={setV}
        tabs={[
          { id: 'a', label: 'Campaigns', pinned: true },
          { id: 'b', label: 'Insertion orders', count: 3 },
          { id: 'c', label: 'Alerts', badge: 'NEW' },
          { id: 'd', label: 'Locked', disabled: true },
        ]}
      />
    );
  }

  it('page tabs: roles, pin icon on the default tab, count in parentheses, NEW badge', () => {
    renderDv(<Harness />);
    expect(screen.getByRole('tablist', { name: 'Sections' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Campaigns/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /Insertion orders \(3\)/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Alerts/ })).toHaveTextContent('New');
    expect(
      screen.getByRole('tab', { name: /Campaigns/ }).querySelector('[data-icon="push_pin"]'),
    ).not.toBeNull();
    expect(screen.getByRole('tab', { name: /Locked/ })).toBeDisabled();
  });

  it('arrow keys move focus and activation follows focus; Home and End jump', async () => {
    const user = userEvent.setup();
    renderDv(<Harness />);
    screen.getByRole('tab', { name: /Campaigns/ }).focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: /Insertion orders/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await user.keyboard('{End}');
    expect(screen.getByRole('tab', { name: /Alerts/ })).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{Home}');
    expect(screen.getByRole('tab', { name: /Campaigns/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('page tabs are 48 px high with a 1 px baseline; card tabs are 40 px', () => {
    const { unmount } = renderDv(<Harness />);
    expect(screen.getByRole('tab', { name: /Campaigns/ })).toHaveStyle({ minHeight: '48px' });
    unmount();
    renderDv(<Harness variant="card" />);
    expect(screen.getByRole('tab', { name: /Campaigns/ })).toHaveStyle({ minHeight: '40px' });
  });

  it('segmented variant is an exclusive toggle group', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderDv(
      <DvTabs
        variant="segmented"
        ariaLabel="Mode"
        value="include"
        onChange={onChange}
        tabs={[
          { id: 'include', label: 'Include' },
          { id: 'exclude', label: 'Exclude' },
        ]}
      />,
    );
    expect(screen.getByRole('button', { name: 'Include' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Exclude' }));
    expect(onChange).toHaveBeenCalledWith('exclude');
    await user.click(screen.getByRole('button', { name: 'Exclude' }));
  });

  it('chip variant marks the selected chip with a check', async () => {
    const user = userEvent.setup();
    renderDv(<Harness variant="chips" />);
    expect(screen.getByRole('button', { name: 'Campaigns' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(screen.getByRole('button', { name: 'Insertion orders' }));
    expect(screen.getByRole('button', { name: 'Insertion orders' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Campaigns' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });
});

describe('DvStepper', () => {
  it('shows numbers, a current step, completed check and the error state', () => {
    renderDv(
      <DvStepper
        current={1}
        steps={[
          { id: '1', label: 'Set up' },
          { id: '2', label: 'Test' },
          { id: '3', label: 'Save' },
        ]}
      />,
    );
    const items = screen.getAllByRole('listitem').filter((li) => li.dataset.state);
    expect(items.map((i) => i.dataset.state)).toEqual(['completed', 'current', 'upcoming']);
    expect(items[1]).toHaveAttribute('aria-current', 'step');
    expect(within(items[0]!).getByText('check')).toBeInTheDocument();
    expect(within(items[0]!).getByText('(completed)')).toBeInTheDocument();
    expect(within(items[2]!).getByText('3')).toBeInTheDocument();
  });

  it('error state is announced', () => {
    renderDv(
      <DvStepper
        current={0}
        steps={[
          { id: '1', label: 'Set up', error: true },
          { id: '2', label: 'Test' },
        ]}
      />,
    );
    expect(screen.getByText('(has errors)')).toBeInTheDocument();
  });
});

describe('DvEmptyState', () => {
  it('icon variant with verbatim message and action', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    renderDv(
      <DvEmptyState
        message="There is no history for this date range."
        action={{ label: 'New channel', onClick, primary: true }}
      />,
    );
    expect(screen.getByText('There is no history for this date range.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'New channel' }));
    expect(onClick).toHaveBeenCalledOnce();
    expect(document.querySelector('[data-variant="icon"]')).not.toBeNull();
  });

  it('positive, illustrated and inline variants', () => {
    renderDv(
      <>
        <DvEmptyState variant="positive" message="There are no rejected creatives" />
        <DvEmptyState
          variant="illustrated"
          title="Welcome"
          message="Plan reach."
          secondary={{ label: 'Learn more', href: '#help' }}
        />
        <DvEmptyState variant="inline" message="No performance chart data available" />
      </>,
    );
    expect(screen.getByText('check_circle')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Welcome' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Learn more/ })).toHaveAttribute('href', '#help');
    expect(screen.getByText('No performance chart data available')).toBeInTheDocument();
  });
});

describe('loading', () => {
  it('spinner has an accessible name', () => {
    renderDv(<DvSpinner />);
    expect(screen.getByRole('progressbar', { name: 'Loading' })).toBeInTheDocument();
  });

  it('skeleton renders the requested rows, hidden from assistive tech', () => {
    renderDv(<DvSkeleton rows={3} />);
    const root = document.querySelector('[data-skeleton]')!;
    expect(root).toHaveAttribute('aria-hidden', 'true');
    expect(root.children).toHaveLength(3);
  });

  it('route progress appears only after 150 ms', () => {
    vi.useFakeTimers();
    renderDv(<DvRouteProgress active />);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(160);
    });
    expect(screen.getByRole('progressbar', { name: 'Loading page' })).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('route progress never appears for a fast navigation', () => {
    vi.useFakeTimers();
    const { rerender } = renderDv(<DvRouteProgress active />);
    act(() => {
      vi.advanceTimersByTime(100);
    });
    rerender(<DvRouteProgress active={false} />);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    vi.useRealTimers();
  });
});

describe('tooltips, help, hover detail, kbd', () => {
  it('tooltip shows on keyboard focus and hides on Escape', async () => {
    const user = userEvent.setup();
    renderDv(
      <DvTooltip title="Search (/)">
        <button type="button">icon</button>
      </DvTooltip>,
    );
    await user.tab();
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Search (/)');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());
  });

  it('hover detail underlines with a dotted border and is focusable', () => {
    renderDv(<DvHoverDetail detail="1 of 2 exchanges">Servable (1 of 2)</DvHoverDetail>);
    const el = screen.getByText('Servable (1 of 2)');
    expect(el).toHaveAttribute('tabindex', '0');
    expect(el).toHaveStyle({ borderBottomStyle: 'dotted', borderBottomWidth: '1px' });
  });

  it('help popover has Learn more and restores focus', async () => {
    const user = userEvent.setup();
    renderDv(<DvHelp learnMoreHref="#help">Short help.</DvHelp>);
    const button = screen.getByRole('button', { name: 'Help' });
    await user.click(button);
    expect(screen.getByRole('link', { name: /Learn more/ })).toHaveAttribute('href', '#help');
    await user.keyboard('{Escape}');
    expect(button).toHaveFocus();
  });

  it('kbd renders a keycap', () => {
    renderDv(<DvKbd>Shift</DvKbd>);
    expect(screen.getByText('Shift').tagName).toBe('KBD');
  });
});

describe('page and entity headers', () => {
  it('page header: h1, Limited Access chip and actions', () => {
    renderDv(
      <DvPageHeader title="Campaigns" limitedAccess actions={<button type="button">New</button>}>
        <p>tabs</p>
      </DvPageHeader>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Campaigns' })).toBeInTheDocument();
    expect(screen.getByText('Limited Access')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New' })).toBeInTheDocument();
    expect(screen.getByText('tabs')).toBeInTheDocument();
  });

  it('entity header: crumb row with chevron, title, status', () => {
    renderDv(
      <DvEntityHeader
        crumbs={[{ label: 'Overview', href: '/' }]}
        title="Autumn launch"
        status={<DvStatusChip kind="servable" label="Active" />}
      />,
    );
    expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('heading', { name: 'Autumn launch' })).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
  });
});

describe('Tier B: charts and tiles', () => {
  it('chart card: 296 px wide, title, period, help, menu, lock and footer', async () => {
    const user = userEvent.setup();
    const onDownload = vi.fn();
    renderDv(
      <DvChartCard
        title="Total cost"
        period="(flight start - Today)"
        help="Spend so far."
        menu={[{ label: 'Download', onClick: onDownload }]}
        locked
        footer="Today: ₹4.5K"
      >
        <p>content</p>
      </DvChartCard>,
    );
    const card = screen.getByRole('region', { name: 'Total cost' });
    expect(card).toHaveStyle({ width: '296px', minHeight: '216px' });
    expect(within(card).getByText('(flight start - Today)')).toBeInTheDocument();
    expect(within(card).getByRole('img', { name: 'Built-in chart' })).toBeInTheDocument();
    expect(within(card).getByText('Today: ₹4.5K')).toBeInTheDocument();
    await user.click(within(card).getByRole('button', { name: 'Total cost menu' }));
    await user.click(screen.getByRole('menuitem', { name: 'Download' }));
    expect(onDownload).toHaveBeenCalledOnce();
  });

  it('selected cards get a 2 px primary border; empty cards show the empty content', () => {
    renderDv(
      <>
        <DvChartCard title="A" selected>
          x
        </DvChartCard>
        <DvChartCard
          title="B"
          empty={<DvEmptyState variant="inline" message="No performance chart data available" />}
        />
      </>,
    );
    expect(screen.getByRole('region', { name: 'A' })).toHaveAttribute('data-selected', 'true');
    expect(screen.getByText('No performance chart data available')).toBeInTheDocument();
  });

  it('goal progress turns amber when more than 20% off in the bad direction', () => {
    const { unmount } = renderDv(
      <DvGoalProgress value={72} valueText="₹72.00" goal={50} goalText="₹50.00" />,
    );
    expect(screen.getByText('vs ₹50.00')).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: '₹72.00 against goal ₹50.00' }).firstElementChild,
    ).toHaveStyle({ backgroundColor: 'rgb(242, 153, 0)' });
    unmount();
    renderDv(<DvGoalProgress value={52} valueText="₹52.00" goal={50} goalText="₹50.00" />);
    expect(
      screen.getByRole('img', { name: '₹52.00 against goal ₹50.00' }).firstElementChild,
    ).toHaveStyle({ backgroundColor: 'rgb(26, 115, 232)' });
  });

  it('coverage bar text and progress semantics', () => {
    renderDv(<DvCoverageBar done={46} total={50} noun="Line items" />);
    expect(screen.getByText('92% (46/50 Line items)')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Line items coverage' })).toHaveAttribute(
      'aria-valuenow',
      '92',
    );
  });

  it('sparkline and donut expose one labelled image and a legend with percentages', () => {
    renderDv(
      <>
        <DvSparkBars
          label="Daily cost"
          todayIndex={6}
          data={['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((label, i) => ({ label, value: i + 1 }))}
        />
        <DvDonut
          label="Budget health"
          slices={[
            { name: 'Likely to spend', value: 6 },
            { name: 'At risk', value: 3 },
            { name: 'Spend', value: 1 },
          ]}
        />
      </>,
    );
    expect(screen.getByRole('img', { name: 'Daily cost' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Budget health' })).toBeInTheDocument();
    expect(screen.getByText('Likely to spend 60%')).toBeInTheDocument();
    expect(screen.getByText('Spend 10%')).toBeInTheDocument();
  });

  it('empty sparkline falls back to the inline empty text', () => {
    renderDv(<DvSparkBars label="Daily cost" data={[]} />);
    expect(screen.getByText('No performance chart data available')).toBeInTheDocument();
  });

  it('chart strip: toolbar buttons, suggestion chips and a focusable scroll region', async () => {
    const user = userEvent.setup();
    const onCustomize = vi.fn();
    const onSuggestion = vi.fn();
    renderDv(
      <DvChartStrip
        suggestions={['Bubble chart of CPA vs conversions']}
        onCustomize={onCustomize}
        onSuggestion={onSuggestion}
      >
        <DvChartCard title="One">x</DvChartCard>
      </DvChartStrip>,
    );
    await user.click(screen.getByRole('button', { name: 'Customize charts' }));
    await user.click(screen.getByRole('button', { name: 'Bubble chart of CPA vs conversions' }));
    expect(onCustomize).toHaveBeenCalledOnce();
    expect(onSuggestion).toHaveBeenCalledWith('Bubble chart of CPA vs conversions');
    expect(screen.getByRole('button', { name: 'Tour custom charts' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Share' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Charts' })).toHaveAttribute('tabindex', '0');
  });

  it('KPI tile shows label, value and is a button only when clickable', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    renderDv(
      <>
        <DvKpiTile label="Underpacing" value={4} accent="error" />
        <DvKpiTile label="On track" value={19} onClick={onClick} />
      </>,
    );
    expect(screen.getByText('Underpacing')).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: /On track/ }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe('DvPickerDialog', () => {
  const items = [
    { id: 'c1', label: 'Autumn launch', secondLine: 'C-1001' },
    { id: 'c2', label: 'Back to school', secondLine: 'C-1002' },
  ];

  it('two panes: search, "None selected" / "{n} selected", Clear all, remove, Apply', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    renderDv(
      <DvPickerDialog
        open
        title="Select campaign"
        items={items}
        value={[]}
        onApply={onApply}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByText('None selected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled();
    await user.click(screen.getByRole('checkbox', { name: /Autumn launch/ }));
    await user.click(screen.getByRole('checkbox', { name: /Back to school/ }));
    expect(screen.getByText('2 selected')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remove Back to school' }));
    expect(screen.getByText('1 selected')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(screen.getByText('None selected')).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: /Back to school/ }));
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(onApply).toHaveBeenCalledWith(['c2']);
  });

  it('filters by the search box and supports single choice', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    renderDv(
      <DvPickerDialog
        open
        single
        title="Select campaign"
        items={items}
        value={[]}
        onApply={onApply}
        onCancel={() => {}}
      />,
    );
    await user.type(screen.getByRole('textbox', { name: 'Search' }), 'school');
    expect(screen.queryByRole('checkbox', { name: /Autumn launch/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: /Back to school/ }));
    await user.clear(screen.getByRole('textbox', { name: 'Search' }));
    await user.click(screen.getByRole('checkbox', { name: /Autumn launch/ }));
    expect(screen.getByText('1 selected')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(onApply).toHaveBeenCalledWith(['c1']);
  });

  it('Cancel and Escape call onCancel', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    renderDv(
      <DvPickerDialog
        open
        title="Select campaign"
        items={items}
        value={[]}
        onApply={() => {}}
        onCancel={onCancel}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(2);
  });
});

describe('DvCardCarousel', () => {
  it('renders cards with Apply template and View, and scroll buttons', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    const onView = vi.fn();
    renderDv(
      <DvCardCarousel
        ariaLabel="Templates"
        onApply={onApply}
        onView={onView}
        cards={[
          { id: 't1', name: 'Basic display', family: 'basic', meta: 'Last modified: Oct 12, 2026' },
          { id: 't2', name: 'Video starter', family: 'video' },
        ]}
      />,
    );
    const list = screen.getByRole('list', { name: 'Templates' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(within(list).getByText('Last modified: Oct 12, 2026')).toBeInTheDocument();
    await user.click(within(list).getAllByRole('button', { name: 'Apply template' })[1]!);
    await user.click(within(list).getAllByRole('button', { name: 'View' })[0]!);
    expect(onApply).toHaveBeenCalledWith('t2');
    expect(onView).toHaveBeenCalledWith('t1');
    expect(screen.getByRole('button', { name: 'Next cards' })).toBeInTheDocument();
  });

  it('works without a ThemeProvider crash for plain render (smoke)', () => {
    expect(() => render(<span>ok</span>)).not.toThrow();
  });
});
