// Create custom lists from the line item targeting: the Create menu, the stacked side panel with the real field sets,
// the validation text, and the new list showing up in the picker (LIT-001 to LIT-005, CIL-001 to CIL-009).
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const create = vi.fn<(...a: unknown[]) => Promise<unknown>>();
vi.mock('@/lib/audiences/actions', () => ({
  createAudienceAction: (...a: unknown[]) => create(...a),
  getLookupsAction: () => Promise.resolve({ apps: [{ id: 'app1', label: 'Maps (Android)' }] }),
}));
vi.mock('next/navigation', () => ({ usePathname: () => '/p/1/a/2', useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

import { DvAudienceBuilder } from '@/components/targeting/editors/audience/DvAudienceBuilder';
import { TargetingEditorContext } from '@/components/targeting/editors/apps-urls/context';
import { renderDv } from './test-utils';

const catalogue = { firstParty: [], combined: [], custom: [] as unknown[], google: [] };
const makeFetch = () =>
  vi.fn((url: string | URL | Request) => {
    const u = typeof url === 'string' ? url : url instanceof URL ? url.href : url.url;
    return Promise.resolve(
      u.includes('/estimate/catalogue')
        ? new Response(JSON.stringify(catalogue), { status: 200 })
        : new Response('{}', { status: 500 }),
    );
  });

function Builder() {
  return (
    <TargetingEditorContext.Provider
      value={{ advertiserId: 'adv-int', partnerPublicId: '1', advertiserPublicId: '2' }}
    >
      <DvAudienceBuilder criteria={{}} onChange={vi.fn()} lineItemType="DISPLAY" />
    </TargetingEditorContext.Provider>
  );
}

beforeEach(() => {
  catalogue.custom = [];
  create.mockReset();
  vi.stubGlobal('fetch', makeFetch());
});
afterEach(() => vi.unstubAllGlobals());

const openCreate = async (user: ReturnType<typeof userEvent.setup>, item: string) => {
  await user.click(screen.getByRole('button', { name: 'Create' }));
  await user.click(await screen.findByRole('menuitem', { name: item }));
};

describe('Create menu and panel in the Audience lists editor', () => {
  it('the menu has exactly "Custom affinity" and "Custom Intent", no links, no YouTube item', async () => {
    const user = userEvent.setup();
    renderDv(<Builder />);
    await user.click(screen.getByRole('button', { name: 'Create' }));
    const items = await screen.findAllByRole('menuitem');
    expect(items.map((i) => i.textContent)).toEqual(['Custom affinity', 'Custom Intent']);
    for (const i of items) expect(i).not.toHaveAttribute('href');
  });

  it('Custom affinity opens a stacked side panel with the five fields and their helper text', async () => {
    const user = userEvent.setup();
    renderDv(<Builder />);
    await openCreate(user, 'Custom affinity');
    const panel = await screen.findByRole('dialog', { name: 'New Custom Affinity Audience' });
    for (const label of ['Audience name', 'Description', 'Interests', 'URLs'])
      expect(within(panel).getByLabelText(label, { selector: 'input' })).toBeInTheDocument();
    expect(within(panel).getByRole('combobox', { name: 'Apps' })).toBeInTheDocument();
    expect(within(panel).getByText('Optional')).toBeInTheDocument();
    expect(
      within(panel).getByText("Add topics your audience is interested in. Press 'Enter' after each, or separate with commas."),
    ).toBeInTheDocument();
    expect(within(panel).getByText('Search for apps your audience is interested in.')).toBeInTheDocument();
    expect(within(panel).getByText('Search for apps')).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'Help: Interests' })).toBeInTheDocument();
    expect(within(panel).queryByText(/Impressions Estimator/)).toBeNull();
    expect(within(panel).queryByText(/\/ 255/)).toBeNull();
  });

  it('Custom Intent opens "New Custom Intent (Display, Video) Audience" with Keywords and URLs, no Apps', async () => {
    const user = userEvent.setup();
    renderDv(<Builder />);
    await openCreate(user, 'Custom Intent');
    const panel = await screen.findByRole('dialog', { name: 'New Custom Intent (Display, Video) Audience' });
    for (const label of ['Audience name', 'Description', 'Keywords', 'URLs'])
      expect(within(panel).getByLabelText(label, { selector: 'input' })).toBeInTheDocument();
    expect(within(panel).queryByRole('combobox', { name: 'Apps' })).toBeNull();
    expect(within(panel).queryByLabelText('Interests')).toBeNull();
    expect(
      within(panel).getByText(
        "Add keywords related to products and services your audience is actively researching. Press 'Enter' after each, or separate with commas.",
      ),
    ).toBeInTheDocument();
  });

  it('Save with an empty name shows only "Enter a value" and does not call the server', async () => {
    const user = userEvent.setup();
    renderDv(<Builder />);
    await openCreate(user, 'Custom affinity');
    const panel = await screen.findByRole('dialog', { name: 'New Custom Affinity Audience' });
    await user.click(within(panel).getByRole('button', { name: 'Save' }));
    expect(within(panel).getAllByText('Enter a value')).toHaveLength(1);
    expect(within(panel).queryByText(/Add at least one/)).toBeNull();
    expect(create).not.toHaveBeenCalled();
  });

  it('saves in place, closes the panel back to Audience lists and reloads the picker catalogue', async () => {
    const user = userEvent.setup();
    create.mockImplementation(() => {
      catalogue.custom = [
        {
          id: 'cuid-new',
          displayId: '733976999',
          name: 'Trail runners',
          path: 'Custom affinity » Trail runners',
          subtype: 'CUSTOM_AFFINITY',
          meta: { id: 'cuid-new', name: 'Trail runners', kind: 'CUSTOM' },
        },
      ];
      return Promise.resolve({ ok: true, data: { id: 'cuid-new', availableAt: null, status: 'ACTIVE' } });
    });
    renderDv(<Builder />);
    await openCreate(user, 'Custom affinity');
    const panel = await screen.findByRole('dialog', { name: 'New Custom Affinity Audience' });
    await user.type(within(panel).getByLabelText('Audience name', { selector: 'input' }), 'Trail runners');
    await user.type(within(panel).getByLabelText('Interests', { selector: 'input' }), 'running{Enter}');
    await user.click(within(panel).getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'New Custom Affinity Audience' })).toBeNull(),
    );
    expect(create).toHaveBeenCalledWith(
      '2',
      expect.objectContaining({ kind: 'CUSTOM_AFFINITY', name: 'Trail runners', interests: ['running'] }),
    );
    // back on the Audience lists panel: open the custom lists picker, the new list is there
    await user.click(screen.getByRole('button', { name: 'Select Custom lists' }));
    const picker = await screen.findByRole('dialog', { name: 'Select custom lists' });
    expect(await within(picker).findByText('Trail runners')).toBeInTheDocument();
    expect(within(picker).getByText('733976999')).toBeInTheDocument();
  });

  it('Cancel on the panel leaves nothing created', async () => {
    const user = userEvent.setup();
    renderDv(<Builder />);
    await openCreate(user, 'Custom Intent');
    const panel = await screen.findByRole('dialog', { name: /New Custom Intent/ });
    await user.click(within(panel).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /New Custom Intent/ })).toBeNull());
    expect(create).not.toHaveBeenCalled();
  });
});

describe('Audience lists panel layout (LIT-012 to LIT-014)', () => {
  it('has Include and Exclude cards with the real row label and its separate help text', () => {
    renderDv(<Builder />);
    expect(screen.getByRole('heading', { name: 'Include' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Exclude' })).toBeInTheDocument();
    expect(
      screen.getByText("Add first-party and partner audiences to 'AND & OR' together."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Add audiences to combine into a new one. Expand the size by adding in a group. Intersect groups to narrow.',
      ),
    ).toBeInTheDocument();
  });

  it('the Impressions summary has the subtitle with Learn more', () => {
    renderDv(<Builder />);
    const pane = screen.getByTestId('impressions-summary');
    expect(pane).toHaveTextContent('Based only on flight dates and targeting (without expansion).');
    expect(within(pane).getByRole('link', { name: 'Learn more' })).toBeInTheDocument();
  });
});
