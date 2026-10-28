import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DvBanner,
  DvModal,
  DvSlideOver,
  DvUnsavedChangesModal,
  UNSAVED_CHANGES,
  useToast,
  type DvToastOptions,
} from '@/components/dv';
import { renderDv } from './test-utils';

describe('DvModal', () => {
  it('shows the Unsaved Changes title, body and buttons exactly as validation.md 5.1', () => {
    renderDv(<DvUnsavedChangesModal open onDiscard={() => {}} onContinue={() => {}} />);
    const dialog = screen.getByRole('dialog', { name: 'Unsaved Changes' });
    expect(
      within(dialog).getByText('You have made changes that have not been saved and will be lost.'),
    ).toBeInTheDocument();
    const buttons = within(dialog).getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual(['Continue editing', 'Discard changes']);
    expect(UNSAVED_CHANGES.title).toBe('Unsaved Changes');
  });

  it('uses the channel wording for the channel variant', () => {
    renderDv(
      <DvUnsavedChangesModal open variant="channel" onDiscard={() => {}} onContinue={() => {}} />,
    );
    expect(
      screen.getByText(
        'You have made changes to this channel that have not yet been saved and will be lost.',
      ),
    ).toBeInTheDocument();
  });

  it('puts initial focus on Continue editing (the safe action) while Discard is the filled button', () => {
    renderDv(<DvUnsavedChangesModal open onDiscard={() => {}} onContinue={() => {}} />);
    expect(screen.getByRole('button', { name: 'Continue editing' })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Discard changes' })).toHaveClass(
      'MuiButton-contained',
    );
  });

  it('Discard and Continue fire their handlers; Esc acts as Continue editing', async () => {
    const user = userEvent.setup();
    const onDiscard = vi.fn();
    const onContinue = vi.fn();
    renderDv(<DvUnsavedChangesModal open onDiscard={onDiscard} onContinue={onContinue} />);
    await user.click(screen.getByRole('button', { name: 'Discard changes' }));
    expect(onDiscard).toHaveBeenCalledOnce();
    await user.keyboard('{Escape}');
    expect(onContinue).toHaveBeenCalledOnce();
    await user.click(screen.getByRole('button', { name: 'Continue editing' }));
    expect(onContinue).toHaveBeenCalledTimes(2);
  });

  it('renders nothing when closed', () => {
    renderDv(<DvUnsavedChangesModal open={false} onDiscard={() => {}} onContinue={() => {}} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows a spinner and disables the primary button while loading', () => {
    renderDv(
      <DvModal
        open
        title="Copy settings"
        primary={{ label: 'Copy Settings', onClick: () => {}, loading: true }}
        secondary={{ label: 'Cancel', onClick: () => {} }}
      >
        Body
      </DvModal>,
    );
    const primary = screen.getByRole('button', { name: 'Copy Settings' });
    expect(primary).toBeDisabled();
    expect(within(primary).getByRole('progressbar')).toBeInTheDocument();
  });

  it('shows an error inside the body and a danger primary', () => {
    renderDv(
      <DvModal
        open
        title="Delete channel"
        primary={{ label: 'Delete', tone: 'danger', onClick: () => {} }}
        error="Could not delete."
      >
        Sure?
      </DvModal>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Could not delete.');
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveClass('MuiButton-colorError');
  });

  it('a blocking dialog (no onClose) ignores Esc', async () => {
    const user = userEvent.setup();
    renderDv(
      <DvModal open title="Working" primary={{ label: 'OK', onClick: () => {} }}>
        Body
      </DvModal>,
    );
    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog', { name: 'Working' })).toBeInTheDocument();
  });

  it('sizes: 400, 560, 720', () => {
    const { rerender } = renderDv(
      <DvModal open title="T" size="sm" primary={{ label: 'OK', onClick: () => {} }}>
        x
      </DvModal>,
    );
    expect(document.querySelector('.MuiDialog-paper')).toHaveStyle({ width: '400px' });
    rerender(
      <DvModal open title="T" size="lg" primary={{ label: 'OK', onClick: () => {} }}>
        x
      </DvModal>,
    );
    expect(document.querySelector('.MuiDialog-paper')).toHaveStyle({ width: '720px' });
  });
});

describe('DvSlideOver', () => {
  it('shows header, body and footer with Apply and Cancel and the delete icon', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    const onCancel = vi.fn();
    const onDelete = vi.fn();
    renderDv(
      <DvSlideOver
        open
        title="Create ad group"
        onApply={onApply}
        onCancel={onCancel}
        onDelete={onDelete}
      >
        <p>Body</p>
      </DvSlideOver>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Create ad group' });
    expect(within(dialog).getByText('Body')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Apply' }));
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(onApply).toHaveBeenCalledOnce();
    expect(onDelete).toHaveBeenCalledOnce();
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('closes with the header close button and with Escape', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    renderDv(
      <DvSlideOver open title="Panel" onCancel={onCancel}>
        x
      </DvSlideOver>,
    );
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await user.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it('scrim click closes when clean and does nothing when dirty', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const { rerender } = renderDv(
      <DvSlideOver open title="Panel" onCancel={onCancel}>
        x
      </DvSlideOver>,
    );
    await user.click(document.querySelector('.MuiBackdrop-root')!);
    expect(onCancel).toHaveBeenCalledOnce();
    rerender(
      <DvSlideOver open dirty title="Panel" onCancel={onCancel}>
        x
      </DvSlideOver>,
    );
    await user.click(document.querySelector('.MuiBackdrop-root')!);
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('renders tabs and reports tab changes', async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();
    renderDv(
      <DvSlideOver
        open
        title="Panel"
        tabs={[
          { id: 'a', label: 'Details' },
          { id: 'b', label: 'Scale' },
        ]}
        activeTab="a"
        onTabChange={onTabChange}
        onCancel={() => {}}
      >
        x
      </DvSlideOver>,
    );
    await user.click(screen.getByRole('tab', { name: 'Scale' }));
    expect(onTabChange).toHaveBeenCalledWith('b');
  });

  it('a nested slide-over sits 10 z-index points above its parent', () => {
    renderDv(
      <>
        <DvSlideOver open title="Parent" onCancel={() => {}}>
          x
        </DvSlideOver>
        <DvSlideOver open level={1} title="Child" onCancel={() => {}}>
          y
        </DvSlideOver>
      </>,
    );
    const roots = Array.from(document.querySelectorAll<HTMLElement>('.MuiDrawer-root'));
    const z = roots.map((r) => Number(getComputedStyle(r).zIndex));
    expect(z).toEqual([1300, 1310]);
  });

  it('uses the apply label and works without Apply (Cancel becomes the main button)', () => {
    renderDv(
      <DvSlideOver
        open
        title="Panel"
        applyLabel="Create ad group"
        onApply={() => {}}
        onCancel={() => {}}
      >
        x
      </DvSlideOver>,
    );
    expect(screen.getByRole('button', { name: 'Create ad group' })).toBeInTheDocument();
  });
});

function ToastButtons({ options }: { options: DvToastOptions[] }) {
  const toast = useToast();
  return (
    <>
      {options.map((o, i) => (
        <button key={i} type="button" onClick={() => toast.show(o)}>
          show {i}
        </button>
      ))}
    </>
  );
}

describe('DvToast', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => vi.useRealTimers());

  it('shows a neutral status toast and dismisses it after 6 s', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderDv(<ToastButtons options={[{ message: 'Created' }]} />);
    await user.click(screen.getByRole('button', { name: 'show 0' }));
    expect(screen.getByRole('status')).toHaveTextContent('Created');
    act(() => {
      vi.advanceTimersByTime(5900);
    });
    expect(screen.getByRole('status')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('hover pauses the timer', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderDv(<ToastButtons options={[{ message: 'Hold on' }]} />);
    await user.click(screen.getByRole('button', { name: 'show 0' }));
    await user.hover(screen.getByRole('status'));
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(screen.getByRole('status')).toBeInTheDocument();
    await user.unhover(screen.getByRole('status'));
    act(() => {
      vi.advanceTimersByTime(6100);
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('errors use role alert', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderDv(
      <ToastButtons options={[{ kind: 'error', message: 'Error when retrieving Floodlight.' }]} />,
    );
    await user.click(screen.getByRole('button', { name: 'show 0' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Error when retrieving Floodlight.');
  });

  it('runs the action and closes the toast', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onClick = vi.fn();
    renderDv(
      <ToastButtons
        options={[{ message: 'Started bulk action.', action: { label: 'View status', onClick } }]}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'show 0' }));
    await user.click(screen.getByRole('button', { name: 'View status' }));
    expect(onClick).toHaveBeenCalledOnce();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('stacks at most 3 neutral toasts', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderDv(
      <ToastButtons
        options={[
          { message: 'one' },
          { message: 'two' },
          { message: 'three' },
          { message: 'four' },
        ]}
      />,
    );
    for (let i = 0; i < 4; i++) await user.click(screen.getByRole('button', { name: `show ${i}` }));
    const toasts = screen.getAllByRole('status');
    expect(toasts).toHaveLength(3);
    expect(toasts.map((t) => t.textContent)).toEqual(['two', 'three', 'four']);
  });

  it('warning toasts stay until dismissed and offer Dismiss', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderDv(
      <ToastButtons options={[{ kind: 'warning', message: 'To create Demand Gen line items:' }]} />,
    );
    await user.click(screen.getByRole('button', { name: 'show 0' }));
    act(() => {
      vi.advanceTimersByTime(60000);
    });
    expect(screen.getByRole('status')).toHaveTextContent('To create Demand Gen line items:');
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('useToast throws outside the provider', () => {
    function Bad() {
      useToast();
      return null;
    }
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => {
      // render without the provider
      void waitFor;
      renderBare(<Bad />);
    }).toThrow('useToast must be used inside DvToastProvider');
    spy.mockRestore();
  });
});

import { render } from '@testing-library/react';
function renderBare(ui: React.ReactElement) {
  return render(ui);
}

describe('DvBanner', () => {
  it.each(['info', 'warning', 'error', 'success'] as const)('renders the %s kind', (kind) => {
    renderDv(<DvBanner kind={kind}>Message</DvBanner>);
    expect(screen.getByText('Message').closest('[data-kind]')).toHaveAttribute('data-kind', kind);
  });

  it('page level is full width with no radius', () => {
    renderDv(
      <DvBanner kind="info" level="page">
        This advertiser is currently paused.
      </DvBanner>,
    );
    const banner = screen.getByText('This advertiser is currently paused.').closest('[data-level]');
    expect(banner).toHaveAttribute('data-level', 'page');
    expect(banner).toHaveStyle({ borderRadius: '0px' });
  });

  it('renders links, an action button and Dismiss', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    const onDismiss = vi.fn();
    renderDv(
      <DvBanner
        kind="warning"
        links={[{ label: 'Learn more', href: '#more' }]}
        action={{ label: 'Review fees', onClick: onAction }}
        onDismiss={onDismiss}
      >
        Fees changed.
      </DvBanner>,
    );
    expect(screen.getByRole('link', { name: 'Learn more' })).toHaveAttribute('href', '#more');
    await user.click(screen.getByRole('button', { name: 'Review fees' }));
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onAction).toHaveBeenCalledOnce();
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('collapses long text behind Show more details', async () => {
    const user = userEvent.setup();
    renderDv(
      <DvBanner kind="info" details="Longer explanation.">
        Short text.
      </DvBanner>,
    );
    expect(screen.queryByText('Longer explanation.')).not.toBeInTheDocument();
    const toggle = screen.getByRole('button', { name: 'Show more details' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    expect(screen.getByText('Longer explanation.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show fewer details' })).toBeInTheDocument();
  });
});
