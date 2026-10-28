import { useState } from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  DvAppBar,
  DvBreadcrumbs,
  DvHealthList,
  DvNav,
  DvPanel,
  DvRightRail,
  type NavItem,
  type RailPanelId,
} from '@/components/dv';
import { renderDv } from './test-utils';

const USER = { name: 'Sample Student', initials: 'SS', role: 'student' as const };

describe('DvAppBar', () => {
  it('renders the logo image (28 px high, linked home) and not a text wordmark', () => {
    renderDv(<DvAppBar crumbs={[]} unreadNotifications={0} onToggleNav={() => {}} user={USER} />);
    const link = screen.getByRole('link', {
      name: 'DV360 Simulator by Adsmetor, Partner Overview',
    });
    expect(link).toHaveAttribute('href', '/');
    const img = link.querySelector('img')!;
    expect(img.getAttribute('src')).toContain('adsmentor-logo-horizontal.png');
    expect(img).toHaveStyle({ height: '28px' });
    expect(screen.queryByText('DV360 Simulator by Adsmetor')).not.toBeInTheDocument();
  });

  it('is 56 px high with the icon group in spec order and the spec tooltip names', () => {
    renderDv(<DvAppBar crumbs={[]} unreadNotifications={0} onToggleNav={() => {}} user={USER} />);
    const header = screen.getByRole('banner');
    expect(header).toHaveStyle({ height: '56px' });
    const names = within(header)
      .getAllByRole('button')
      .map((b) => b.getAttribute('aria-label'));
    expect(names).toEqual([
      'Main menu',
      'Search (/)',
      'Notifications',
      'User management and email preferences',
      'Bulk status',
      'Reports',
      'Keyboard shortcuts',
      'Switch products',
      'Account: Sample Student',
    ]);
    expect(within(header).getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
  });

  it('shows the tooltip "Search (/)" when the icon gets keyboard focus', async () => {
    const user = userEvent.setup();
    renderDv(<DvAppBar crumbs={[]} unreadNotifications={0} onToggleNav={() => {}} user={USER} />);
    screen.getByRole('button', { name: 'Search (/)' }).focus();
    await user.tab({ shift: true });
    await user.tab();
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Search (/)');
  });

  it('shows the red dot on the bell only when notifications are unread', () => {
    const { rerender } = renderDv(
      <DvAppBar crumbs={[]} unreadNotifications={0} onToggleNav={() => {}} user={USER} />,
    );
    expect(screen.queryByTestId('unread-dot')).not.toBeInTheDocument();
    rerender(<DvAppBar crumbs={[]} unreadNotifications={3} onToggleNav={() => {}} user={USER} />);
    expect(screen.getByTestId('unread-dot')).toHaveAccessibleName('3 unread');
  });

  it('hamburger and icon group call back', async () => {
    const user = userEvent.setup();
    const onToggleNav = vi.fn();
    const onAction = vi.fn<(id: string) => void>();
    renderDv(
      <DvAppBar
        crumbs={[]}
        unreadNotifications={0}
        onToggleNav={onToggleNav}
        onAction={onAction}
        user={USER}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Main menu' }));
    await user.click(screen.getByRole('button', { name: 'Reports' }));
    await user.click(screen.getByRole('button', { name: 'Bulk status' }));
    expect(onToggleNav).toHaveBeenCalledOnce();
    expect(onAction.mock.calls.map((c) => c[0])).toEqual(['reports', 'bulkStatus']);
  });

  it('back header mode shows the arrow and title instead of the logo, crumbs and icons', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    renderDv(
      <DvAppBar
        crumbs={[{ level: 'Partner', name: 'P' }]}
        unreadNotifications={0}
        onToggleNav={() => {}}
        user={USER}
        mode="backHeader"
        backHeaderTitle="Reports"
        onBack={onBack}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Reports' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Search (/)' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('user menu shows name, role chip and Sign out', async () => {
    const user = userEvent.setup();
    const onSignOut = vi.fn();
    renderDv(
      <DvAppBar
        crumbs={[]}
        unreadNotifications={0}
        onToggleNav={() => {}}
        user={USER}
        onSignOut={onSignOut}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Account: Sample Student' }));
    const menu = screen.getByRole('menu');
    expect(within(menu).getByText('Student')).toBeInTheDocument();
    await user.click(within(menu).getByRole('menuitem', { name: 'Sign out' }));
    expect(onSignOut).toHaveBeenCalledOnce();
  });

  it('notifications menu shows items with Learn more and Dismiss', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    renderDv(
      <DvAppBar
        crumbs={[]}
        unreadNotifications={1}
        onToggleNav={() => {}}
        user={USER}
        notifications={[
          {
            id: 'n1',
            type: 'Alert',
            age: '9 d',
            title: 'Budget at risk',
            body: 'IO-1 is slow.',
            learnMoreHref: '#x',
          },
        ]}
        onDismissNotification={onDismiss}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Notifications' }));
    const card = screen.getByRole('dialog', { name: 'Notifications' });
    expect(within(card).getByText('9 d')).toBeInTheDocument();
    expect(within(card).getByText('Budget at risk')).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: 'Learn more' })).toHaveAttribute('href', '#x');
    await user.click(within(card).getByRole('button', { name: 'Dismiss' }));
    expect(onDismiss).toHaveBeenCalledWith('n1');
  });

  it('search overlay shows the placeholder, suggestions and footnote; Esc closes it', async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn();
    renderDv(
      <DvAppBar
        crumbs={[]}
        unreadNotifications={0}
        onToggleNav={() => {}}
        user={USER}
        searchSuggestions={['paused line items']}
        onSearch={onSearch}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Search (/)' }));
    expect(screen.getByRole('textbox', { name: 'Search' })).toHaveFocus();
    expect(
      screen.getByPlaceholderText("Search the advertiser with phrases like 'paused line items'"),
    ).toBeInTheDocument();
    expect(screen.getByText('Try searching this advertiser for:')).toBeInTheDocument();
    expect(screen.getByText("Results come from the simulator's saved filters")).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'paused line items' }));
    expect(onSearch).toHaveBeenCalledWith('paused line items');
    await waitFor(() =>
      expect(screen.queryByRole('textbox', { name: 'Search' })).not.toBeInTheDocument(),
    );

    await user.click(await screen.findByRole('button', { name: 'Search (/)' }));
    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(screen.queryByRole('textbox', { name: 'Search' })).not.toBeInTheDocument(),
    );
  });
});

describe('DvBreadcrumbs', () => {
  it('shows the level label above the name, chevron separators, and marks the last crumb current', () => {
    renderDv(
      <DvBreadcrumbs
        crumbs={[
          { level: 'Partner', name: 'Acme Partner', href: '/p' },
          { level: 'Advertiser', name: 'Northwind', href: '/a' },
          { level: 'Campaign', name: 'Autumn launch' },
        ]}
      />,
    );
    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(nav).getByText('Partner')).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Acme Partner' })).toHaveAttribute('href', '/p');
    expect(within(nav).getAllByText('chevron_right')).toHaveLength(2);
    const current = within(nav)
      .getAllByRole('listitem')
      .filter((li) => li.getAttribute('aria-current'));
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent('Autumn launch');
  });

  it('truncates long names at 200 px', () => {
    const long = 'Northwind Outdoor Gear and Equipment Company International';
    renderDv(<DvBreadcrumbs crumbs={[{ level: 'Advertiser', name: long }]} />);
    expect(screen.getByText(long)).toHaveStyle({ maxWidth: '200px', textOverflow: 'ellipsis' });
  });
});

const NAV: NavItem[] = [
  { id: 'campaigns', label: 'Campaigns', icon: 'navCampaigns', href: '/c' },
  {
    id: 'audiences',
    label: 'Audiences',
    icon: 'navAudiences',
    children: [
      { id: 'all', label: 'All audiences', href: '/a/all' },
      { id: 'analysis', label: 'Analysis', href: '/a/analysis' },
    ],
  },
  {
    id: 'resources',
    label: 'Resources',
    icon: 'navResources',
    dividerAfter: true,
    children: [{ id: 'fl', label: 'Floodlight group', newDot: true }],
  },
  {
    id: 'settings',
    label: 'Advertiser settings',
    icon: 'navSettings',
    children: [{ id: 'dm', label: 'Data manager', secondLine: '(Linked accounts)' }],
  },
  { id: 'alerts', label: 'Alerts', icon: 'navCampaignAlerts', badge: 'NEW' },
  {
    id: 'locked',
    label: 'Experiments',
    icon: 'navExperiments',
    disabled: true,
    disabledReason: 'You do not have access',
  },
];

function NavHarness({
  mode = 'expanded',
  activeId = 'campaigns',
}: {
  mode?: 'expanded' | 'rail';
  activeId?: string;
}) {
  const [open, setOpen] = useState<string[]>([]);
  return (
    <DvNav
      items={NAV}
      mode={mode}
      activeId={activeId}
      openGroupIds={open}
      onToggleGroup={(id) =>
        setOpen((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]))
      }
    />
  );
}

describe('DvNav', () => {
  it('is a "Main" navigation landmark 256 px wide with the active item marked', () => {
    renderDv(<NavHarness />);
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(nav).toHaveStyle({ width: '256px' });
    const active = within(nav).getByRole('link', { name: 'Campaigns' });
    expect(active).toHaveAttribute('aria-current', 'page');
    expect(active).toHaveClass('Mui-selected');
  });

  it('shows the NEW badge and two-line labels', async () => {
    const user = userEvent.setup();
    renderDv(<NavHarness />);
    expect(screen.getByText('New')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Advertiser settings/ }));
    expect(screen.getByText('(Linked accounts)')).toBeInTheDocument();
  });

  it('keeps the item order', () => {
    renderDv(<NavHarness />);
    const items = within(screen.getByRole('navigation', { name: 'Main' }))
      .getAllByRole('listitem')
      .map((li) => li.textContent ?? '');
    const order = [
      'Campaigns',
      'Audiences',
      'Resources',
      'Advertiser settings',
      'Alerts',
      'Experiments',
    ];
    const positions = order.map((label) => items.findIndex((t) => t.includes(label)));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(positions.every((p) => p >= 0)).toBe(true);
  });

  it('groups expand and collapse with aria-expanded; children have no icons', async () => {
    const user = userEvent.setup();
    renderDv(<NavHarness />);
    const group = screen.getByRole('button', { name: /Audiences/ });
    expect(group).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('link', { name: 'All audiences' })).not.toBeInTheDocument();
    await user.click(group);
    expect(group).toHaveAttribute('aria-expanded', 'true');
    const child = screen.getByRole('link', { name: 'All audiences' });
    expect(child).toHaveAttribute('href', '/a/all');
    expect(child.querySelector('.material-symbols-outlined')).toBeNull();
    await user.click(group);
    expect(screen.queryByRole('link', { name: 'All audiences' })).not.toBeInTheDocument();
  });

  it('shows the "new" dot beside a child label', async () => {
    const user = userEvent.setup();
    renderDv(<NavHarness />);
    await user.click(screen.getByRole('button', { name: /Resources/ }));
    expect(screen.getByRole('img', { name: 'New' })).toBeInTheDocument();
  });

  it('a closed group holding the active child shows the pill; when open the child shows it', async () => {
    const user = userEvent.setup();
    renderDv(<NavHarness activeId="analysis" />);
    const group = screen.getByRole('button', { name: /Audiences/ });
    expect(group).toHaveClass('Mui-selected');
    await user.click(group);
    expect(group).not.toHaveClass('Mui-selected');
    expect(screen.getByRole('link', { name: 'Analysis' })).toHaveClass('Mui-selected');
  });

  it('rail mode is 72 px wide, icon only, labels become accessible names', () => {
    renderDv(<NavHarness mode="rail" />);
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(nav).toHaveStyle({ width: '72px' });
    expect(within(nav).getByRole('link', { name: 'Campaigns' })).toBeInTheDocument();
    expect(within(nav).queryByText('Campaigns')).not.toBeInTheDocument();
  });

  it('rail mode opens a flyout menu with the children of a group', async () => {
    const user = userEvent.setup();
    renderDv(<NavHarness mode="rail" />);
    await user.click(screen.getByRole('button', { name: 'Audiences' }));
    const menu = screen.getByRole('menu');
    expect(within(menu).getByRole('menuitem', { name: 'All audiences' })).toHaveAttribute(
      'href',
      '/a/all',
    );
    expect(within(menu).getByRole('menuitem', { name: 'Analysis' })).toBeInTheDocument();
  });

  it('disabled items cannot be activated', () => {
    renderDv(<NavHarness />);
    expect(screen.getByRole('button', { name: /Experiments/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });
});

function RailHarness({ initial = null }: { initial?: RailPanelId | null }) {
  const [open, setOpen] = useState<RailPanelId | null>(initial);
  return (
    <>
      <DvRightRail
        available={['advisor', 'help', 'intelligence', 'exercise']}
        open={open}
        onChange={setOpen}
      />
      <output data-testid="open">{open ?? 'none'}</output>
    </>
  );
}

describe('DvRightRail', () => {
  it('is 48 px wide with icons in order: Ask Advisor, Quick help, Intelligence, Exercise', () => {
    renderDv(<RailHarness />);
    expect(screen.getByRole('complementary', { name: 'Side panels' })).toHaveStyle({
      width: '48px',
    });
    const names = screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'));
    expect(names).toEqual(['Ask Advisor', 'Quick help', 'Intelligence', 'Exercise', 'Open panel']);
  });

  it('only lists the available panels (Exercise only during an attempt)', () => {
    renderDv(<DvRightRail available={['advisor', 'help']} onChange={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Exercise' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Intelligence' })).not.toBeInTheDocument();
  });

  it('opening one panel replaces the current one; the same icon closes it', async () => {
    const user = userEvent.setup();
    renderDv(<RailHarness />);
    await user.click(screen.getByRole('button', { name: 'Quick help' }));
    expect(screen.getByTestId('open')).toHaveTextContent('help');
    expect(screen.getByRole('button', { name: 'Quick help' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(screen.getByRole('button', { name: 'Intelligence' }));
    expect(screen.getByTestId('open')).toHaveTextContent('intelligence');
    expect(screen.getByRole('button', { name: 'Quick help' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await user.click(screen.getByRole('button', { name: 'Intelligence' }));
    expect(screen.getByTestId('open')).toHaveTextContent('none');
  });

  it('the panel toggle closes the open panel and reopens the last one', async () => {
    const user = userEvent.setup();
    renderDv(<RailHarness initial="advisor" />);
    await user.click(screen.getByRole('button', { name: 'Close panel' }));
    expect(screen.getByTestId('open')).toHaveTextContent('none');
    await user.click(screen.getByRole('button', { name: 'Open panel' }));
    expect(screen.getByTestId('open')).toHaveTextContent('advisor');
  });
});

describe('DvPanel and DvHealthList', () => {
  it('panel frame: title, BETA badge, width, header actions and close', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onAction = vi.fn();
    renderDv(
      <DvPanel
        title="Quick help"
        beta
        onClose={onClose}
        actions={[{ icon: 'history', label: 'Chat history', onClick: onAction }]}
        width={400}
      >
        <p>Body</p>
      </DvPanel>,
    );
    const panel = screen.getByRole('complementary', { name: 'Quick help' });
    expect(panel).toHaveStyle({ width: '400px' });
    expect(within(panel).getByText('Beta')).toBeInTheDocument();
    await user.click(within(panel).getByRole('button', { name: 'Chat history' }));
    await user.click(within(panel).getByRole('button', { name: 'Close' }));
    expect(onAction).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('marks an overlaying panel', () => {
    const { rerender } = renderDv(
      <DvPanel title="A" overlay onClose={() => {}}>
        x
      </DvPanel>,
    );
    expect(screen.getByRole('complementary', { name: 'A' })).toHaveAttribute(
      'data-overlay',
      'true',
    );
    rerender(
      <DvPanel title="A" onClose={() => {}}>
        x
      </DvPanel>,
    );
    expect(screen.getByRole('complementary', { name: 'A' })).not.toHaveAttribute('data-overlay');
  });

  it('shows loading skeletons and an error with Retry', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    const { rerender } = renderDv(
      <DvPanel title="P" state="loading" onClose={() => {}}>
        body
      </DvPanel>,
    );
    expect(screen.queryByText('body')).not.toBeInTheDocument();
    expect(document.querySelector('[data-skeleton]')).toBeInTheDocument();
    rerender(
      <DvPanel title="P" state="error" onRetry={onRetry} onClose={() => {}}>
        body
      </DvPanel>,
    );
    expect(screen.getByText("Couldn't load.")).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('health list: section overlines, severity icons, Investigate and "+N more"', async () => {
    const user = userEvent.setup();
    const onInvestigate = vi.fn();
    const rows = Array.from({ length: 5 }, (_, i) => ({
      id: `a${i}`,
      severity: i === 0 ? ('error' as const) : ('warning' as const),
      text: `Alert ${i}`,
      onInvestigate,
    }));
    renderDv(
      <DvHealthList
        healthTitle="ADVERTISER HEALTH"
        alerts={rows}
        suggestions={[
          { id: 's', severity: 'suggestion', text: 'Try automated bidding', onInvestigate },
        ]}
      />,
    );
    expect(screen.getByRole('heading', { name: 'ADVERTISER HEALTH' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Optimization suggestions' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Critical' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Suggestion' })).toBeInTheDocument();
    expect(screen.queryByText('Alert 4')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '+2 more' }));
    expect(screen.getByText('Alert 4')).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'Investigate' })[0]!);
    expect(onInvestigate).toHaveBeenCalledOnce();
  });

  it('health list empty texts and Go to Alerts', async () => {
    const user = userEvent.setup();
    const onGo = vi.fn();
    renderDv(
      <DvHealthList
        healthTitle="CAMPAIGN HEALTH"
        alerts={[]}
        suggestions={[]}
        onGoToAlerts={onGo}
      />,
    );
    expect(screen.getByText('No alerts')).toBeInTheDocument();
    expect(screen.getByText('There are no recommendations at this time')).toBeInTheDocument();
    expect(screen.getByText('Check the Alerts tab for these alerts')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Go to Alerts' }));
    expect(onGo).toHaveBeenCalledOnce();
  });
});
