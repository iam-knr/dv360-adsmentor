// Shell shortcuts (routes.md 4.7, module 01 4.10): `?` opens the shortcuts dialog with the 8 rows, but not while the
// person types in a text field (AC-01-14). Shift+N goes to the create page of the current list only (AC-01-15).
import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DialogHost } from '@/components/shell/DialogHost';
import { ShellHotkeys } from '@/components/shell/ShellHotkeys';
import { ViewerProvider, type ViewerValue } from '@/components/shell/ViewerProvider';
import { useUnsavedGuard } from '@/lib/hooks/useUnsavedGuard';
import { isTypingTarget, matchesHotkey } from '@/lib/hooks/useHotkeys';
import { ScopeBoundary, ScopeRegistryProvider } from '@/lib/scope/context';
import type { ScopeInfo } from '@/lib/scope/types';
import { renderDv } from '../components/test-utils';

const nav = vi.hoisted(() => ({ pathname: '/p/1/a/2/cs', search: '', push: vi.fn() }));
vi.mock('next/navigation', () => ({
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(nav.search),
  useRouter: () => ({ push: nav.push, replace: vi.fn() }),
}));

const ref = (publicId: string, name: string) => ({
  id: `row-${publicId}`,
  publicId,
  name,
  status: 'ACTIVE' as const,
});
const ADVERTISER_SCOPE: ScopeInfo = {
  partner: { ...ref('1', 'Agency'), currencyCode: 'INR', timeZone: 'Asia/Kolkata' },
  advertiser: {
    ...ref('2', 'Shop'),
    currencyCode: 'INR',
    timeZone: 'Asia/Kolkata',
    sdfVersion: '8.0',
    paused: false,
    scheduledForDeletion: false,
  },
};

function viewer(readOnly = false): ViewerValue {
  return {
    viewer: {
      name: 'Sam Student',
      initials: 'SS',
      appRole: 'user',
      dvRole: readOnly ? 'READ_ONLY' : 'STANDARD',
      limitedAccess: readOnly,
      readOnly,
      viewAs: null,
    },
    chrome: { clock: null },
  };
}

function Dirty() {
  useUnsavedGuard(true);
  return null;
}

function renderShell(opts: { readOnly?: boolean; scope?: ScopeInfo; dirty?: boolean } = {}) {
  return renderDv(
    <ViewerProvider value={viewer(opts.readOnly)}>
      <DialogHost>
        <ScopeRegistryProvider>
          <ScopeBoundary part={opts.scope ?? ADVERTISER_SCOPE}>
            <label>
              Search
              <input type="search" />
            </label>
            <label>
              Notes
              <textarea />
            </label>
            <div contentEditable suppressContentEditableWarning data-testid="editable">
              text
            </div>
            <button type="button">Plain button</button>
            {opts.dirty ? <Dirty /> : null}
          </ScopeBoundary>
          <ShellHotkeys />
        </ScopeRegistryProvider>
      </DialogHost>
    </ViewerProvider>,
  );
}

const dialog = () => screen.queryByRole('dialog', { name: 'Keyboard shortcuts' });

describe('shortcuts dialog (AC-01-14)', () => {
  beforeEach(() => {
    nav.pathname = '/p/1/a/2/cs';
    nav.search = '';
    nav.push.mockReset();
  });

  it('does not open while typing in the search box', async () => {
    const user = userEvent.setup();
    renderShell();
    const box = screen.getByRole('searchbox', { name: 'Search' });
    await user.click(box);
    await user.keyboard('?');
    expect(box).toHaveValue('?');
    expect(dialog()).toBeNull();
  });

  it('does not open from a textarea or a contenteditable region', async () => {
    const user = userEvent.setup();
    renderShell();
    await user.click(screen.getByRole('textbox', { name: 'Notes' }));
    await user.keyboard('?');
    fireEvent.keyDown(screen.getByTestId('editable'), { key: '?', shiftKey: true });
    expect(dialog()).toBeNull();
  });

  it('opens with ? anywhere else and lists the 8 rows of routes.md 4.7', async () => {
    const user = userEvent.setup();
    renderShell();
    await user.click(screen.getByRole('button', { name: 'Plain button' }));
    await user.keyboard('?');
    const modal = await screen.findByRole('dialog', { name: 'Keyboard shortcuts' });
    const rows = within(modal).getAllByRole('row').slice(1);
    const actions = rows.map((r) => within(r).getAllByRole('cell')[0]?.textContent ?? '');
    // The kit (P3-04, design-system 5.4) adds one simulator-only Esc row after the 8 rows of routes.md 4.7.
    expect(actions.filter((a) => !a.endsWith('Simulator'))).toEqual([
      'Keyboard shortcuts',
      'Search',
      'New (entity for current page)',
      'New insertion order',
      'New line item',
      'Download SDF',
      'Download CSV of view',
      'Duplicate',
    ]);
  });
});

describe('Shift+N (AC-01-15)', () => {
  beforeEach(() => {
    nav.push.mockReset();
    nav.search = '';
  });

  it('on the Campaigns list opens cs/new and keeps the sticky sim params', () => {
    nav.pathname = '/p/1/a/2/cs';
    nav.search = 'sim_as=u1&q=x';
    renderShell();
    fireEvent.keyDown(document.body, { key: 'N', shiftKey: true });
    expect(nav.push).toHaveBeenCalledWith('/p/1/a/2/cs/new?sim_as=u1');
  });

  it('does nothing on the Overview', () => {
    nav.pathname = '/p/1/home_v3';
    renderShell({ scope: { partner: ADVERTISER_SCOPE.partner } });
    fireEvent.keyDown(document.body, { key: 'N', shiftKey: true });
    expect(nav.push).not.toHaveBeenCalled();
  });

  it('does nothing for a read-only person', () => {
    nav.pathname = '/p/1/a/2/cs';
    renderShell({ readOnly: true });
    fireEvent.keyDown(document.body, { key: 'N', shiftKey: true });
    expect(nav.push).not.toHaveBeenCalled();
  });

  it('asks the Unsaved Changes dialog first when a form is dirty (DLG-01)', async () => {
    const user = userEvent.setup();
    nav.pathname = '/p/1/a/2/cs';
    renderShell({ dirty: true });
    fireEvent.keyDown(document.body, { key: 'N', shiftKey: true });
    expect(nav.push).not.toHaveBeenCalled();
    const modal = await screen.findByRole('dialog', { name: 'Unsaved Changes' });
    await user.click(within(modal).getByRole('button', { name: 'Discard changes' }));
    expect(nav.push).toHaveBeenCalledWith('/p/1/a/2/cs/new');
  });
});

describe('hotkey helpers', () => {
  const ev = (key: string, mods: Partial<Record<'shiftKey' | 'ctrlKey' | 'metaKey', boolean>>) => ({
    key,
    shiftKey: false,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    ...mods,
  });

  it('matches mod as Ctrl off Mac and ⌘ on Mac', () => {
    const hk = { key: 'K', mod: true, shift: true, handler: () => undefined };
    expect(matchesHotkey(ev('K', { ctrlKey: true, shiftKey: true }), hk, false)).toBe(true);
    expect(matchesHotkey(ev('K', { metaKey: true, shiftKey: true }), hk, false)).toBe(false);
    expect(matchesHotkey(ev('K', { metaKey: true, shiftKey: true }), hk, true)).toBe(true);
  });

  it('compares ? by character whatever the Shift state', () => {
    const hk = { key: '?', handler: () => undefined };
    expect(matchesHotkey(ev('?', { shiftKey: true }), hk, false)).toBe(true);
    expect(matchesHotkey(ev('?', {}), hk, false)).toBe(true);
    expect(matchesHotkey(ev('/', {}), hk, false)).toBe(false);
  });

  it('treats checkboxes and buttons as not typing', () => {
    const box = document.createElement('input');
    box.type = 'checkbox';
    expect(isTypingTarget(box)).toBe(false);
    expect(isTypingTarget(document.createElement('input'))).toBe(true);
    expect(isTypingTarget(document.createElement('button'))).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});
