// Search overlay states (module 01 2.3): closed, open with chips, typing, result, no match, error, partner scope.
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SearchOverlay, SEARCH_DEBOUNCE_MS } from '@/components/shell/SearchOverlay';
import type { SearchResponse } from '@/lib/search/types';
import { renderDv } from '../components/test-utils';

vi.mock('next/navigation', () => ({
  usePathname: () => '/p/1/a/2/cs',
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const ADV = { kind: 'advertiser', partnerId: '1', advertiserId: '2' } as const;

const response = (over: Partial<SearchResponse> = {}): SearchResponse => ({
  interpretation: 'Showing paused line items',
  target: { route: 'explorerlis', query: { 'f.status': ['PAUSED'] } },
  fallback: { route: 'cs', query: { q: ['x'], 'f.status': ['*'] } },
  base: '/p/1/a/2',
  scope: 'advertiser',
  results: [],
  ...over,
});

function mockFetch(body: unknown, ok = true) {
  const f = vi.fn().mockResolvedValue({ ok, json: () => Promise.resolve(body) });
  vi.stubGlobal('fetch', f);
  return f;
}

beforeEach(() => vi.unstubAllGlobals());
afterEach(() => vi.unstubAllGlobals());

describe('SearchOverlay', () => {
  it('is closed until opened, then shows the input, the 7 chips and the footnote', () => {
    const { rerender } = renderDv(<SearchOverlay open={false} onClose={() => {}} scope={ADV} />);
    expect(screen.queryByRole('dialog', { name: 'Search' })).not.toBeInTheDocument();
    rerender(<SearchOverlay open onClose={() => {}} scope={ADV} />);
    const dialog = screen.getByRole('dialog', { name: 'Search' });
    expect(within(dialog).getByRole('textbox', { name: 'Search' })).toHaveFocus();
    expect(
      within(dialog).getByPlaceholderText(
        "Search the advertiser with phrases like 'paused line items'",
      ),
    ).toBeInTheDocument();
    expect(within(dialog).getByText('Try searching this advertiser for:')).toBeInTheDocument();
    expect(
      within(dialog)
        .getAllByRole('button')
        .filter((b) => b.className.includes('MuiChip')),
    ).toHaveLength(7);
    expect(
      within(dialog).getByText("Results come from the simulator's saved filters"),
    ).toBeInTheDocument();
  });

  it('a chip navigates to its saved filter link and closes', async () => {
    const onNavigate = vi.fn();
    const onClose = vi.fn();
    renderDv(<SearchOverlay open onClose={onClose} scope={ADV} onNavigate={onNavigate} />);
    await userEvent.click(screen.getByRole('button', { name: 'Paused line items' }));
    expect(onNavigate).toHaveBeenCalledWith('/p/1/a/2/explorerlis?f.status=PAUSED');
    expect(onClose).toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'IOs with pacing type AHEAD' }));
    expect(onNavigate).toHaveBeenLastCalledWith('/p/1/a/2/explorerios?f.pacingType=AHEAD');
  });

  it('typing shows Searching, waits 250 ms, then the interpretation line and Open', async () => {
    const f = mockFetch(response());
    const onNavigate = vi.fn();
    renderDv(<SearchOverlay open onClose={() => {}} scope={ADV} onNavigate={onNavigate} />);
    await userEvent.type(screen.getByRole('textbox', { name: 'Search' }), 'paused line items');
    expect(screen.getByText('Searching')).toBeInTheDocument();
    expect(SEARCH_DEBOUNCE_MS).toBe(250);
    await waitFor(() => expect(f).toHaveBeenCalledTimes(1));
    expect(f).toHaveBeenCalledWith(
      '/api/dv/advertisers/2/search',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ query: 'paused line items' }),
      }),
    );
    expect(await screen.findByText('Showing paused line items')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(onNavigate).toHaveBeenCalledWith('/p/1/a/2/explorerlis?f.status=PAUSED');
  });

  it('lists direct name/ID hits with links', async () => {
    mockFetch(
      response({
        interpretation: 'x',
        target: null,
        results: [
          {
            kind: 'campaign',
            id: '55',
            name: 'Festive',
            href: '/p/1/a/2/c/55/explorerios',
            label: 'Campaign',
          },
        ],
      }),
    );
    renderDv(<SearchOverlay open onClose={() => {}} scope={ADV} />);
    await userEvent.type(screen.getByRole('textbox', { name: 'Search' }), 'festive');
    const link = await screen.findByRole('link', { name: /Festive/ });
    expect(link).toHaveAttribute('href', '/p/1/a/2/c/55/explorerios');
  });

  it('no match shows the text and a name/ID link', async () => {
    mockFetch(
      response({
        target: null,
        results: [],
        interpretation: "I couldn't match that to a saved search.",
      }),
    );
    renderDv(<SearchOverlay open onClose={() => {}} scope={ADV} />);
    await userEvent.type(screen.getByRole('textbox', { name: 'Search' }), 'zzzz');
    const msg = await screen.findByTestId('search-nomatch');
    expect(msg).toHaveTextContent(
      "I couldn't match that to a saved search. Search by name or ID instead.",
    );
    expect(within(msg).getByRole('link', { name: 'Search by name or ID' })).toHaveAttribute(
      'href',
      '/p/1/a/2/cs?q=x&f.status=*',
    );
  });

  it('shows an error when the API fails', async () => {
    mockFetch({ error: 'INVALID', issues: [{ message: 'Use 200 characters or fewer.' }] }, false);
    renderDv(<SearchOverlay open onClose={() => {}} scope={ADV} />);
    await userEvent.type(screen.getByRole('textbox', { name: 'Search' }), 'abc');
    expect(await screen.findByRole('alert')).toHaveTextContent('Use 200 characters or fewer.');
  });

  it('partner pages: no chips, searches advertisers through the partner API', async () => {
    const f = mockFetch(response({ scope: 'partner', base: '/p/1', target: null, results: [] }));
    renderDv(<SearchOverlay open onClose={() => {}} scope={{ kind: 'partner', partnerId: '1' }} />);
    expect(screen.queryByText('Try searching this advertiser for:')).not.toBeInTheDocument();
    await userEvent.type(screen.getByRole('textbox', { name: 'Search' }), 'shop');
    await waitFor(() => expect(f).toHaveBeenCalled());
    expect(f.mock.calls[0]?.[0]).toBe('/api/dv/partners/1/search');
  });

  it('Esc closes and the text is forgotten on reopen', async () => {
    const onClose = vi.fn();
    const { rerender } = renderDv(<SearchOverlay open onClose={onClose} scope={ADV} />);
    await userEvent.type(screen.getByRole('textbox', { name: 'Search' }), 'abc');
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
    rerender(<SearchOverlay open={false} onClose={onClose} scope={ADV} />);
    rerender(<SearchOverlay open onClose={onClose} scope={ADV} />);
    expect(screen.getByRole('textbox', { name: 'Search' })).toHaveValue('');
  });

  it('static mode (design-system app bar): chips come from props and call onSearch', async () => {
    const onSearch = vi.fn();
    renderDv(
      <SearchOverlay
        open
        onClose={() => {}}
        suggestions={['paused line items']}
        onSearch={onSearch}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'paused line items' }));
    expect(onSearch).toHaveBeenCalledWith('paused line items');
  });
});
