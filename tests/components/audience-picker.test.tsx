// The four audience pickers of the line item targeting as stacked slide-overs (fidelity audit LIT-006 to LIT-011,
// AUD-001 to AUD-011).
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  AudiencePicker,
  type PickerKind,
} from '@/components/targeting/editors/audience/AudiencePicker';
import type { CatalogueItem } from '@/components/targeting/editors/audience/useAudienceCatalogue';
import { GOOGLE_AUDIENCES } from '@/lib/targeting/audience';
import type { LiType } from '@/lib/validation/constants/li-compat';
import { renderDv } from './test-utils';

const YT: LiType[] = ['YT_VIDEO', 'YT_AUDIO', 'YT_ON_CTV'];
const item = (
  id: string,
  displayId: string,
  name: string,
  subtype: string,
  metaKind: 'CUSTOM' | 'FIRST_PARTY' | 'COMBINED' = 'CUSTOM',
  eligibleTypes?: LiType[],
): CatalogueItem => ({
  id,
  displayId,
  name,
  path: `${subtype} » ${name}`,
  subtype,
  meta: { id, name, kind: metaKind, ...(eligibleTypes ? { eligibleTypes } : {}) },
});

const CUSTOM: CatalogueItem[] = [
  item('cuid-a1', '733976506', 'Gadget fans', 'CUSTOM_AFFINITY'),
  item('cuid-a2', '733976507', 'Home cooks', 'CUSTOM_AFFINITY'),
  item('cuid-i1', '733976508', 'Buying a phone', 'CUSTOM_INTENT_DISPLAY_VIDEO'),
  item('cuid-y1', '733976509', 'Phone review viewers', 'CUSTOM_INTENT_YOUTUBE', 'CUSTOM', YT),
];
const GOOGLE: CatalogueItem[] = GOOGLE_AUDIENCES.map((g) => ({
  id: g.id,
  displayId: g.id,
  name: g.name,
  path: g.path.join(' » '),
  subtype: g.kind,
  meta: { id: g.id, name: g.name, kind: 'GOOGLE' },
}));

interface SetupOpts {
  type?: LiType;
  onApply?: (ids: string[]) => void;
  onCancel?: () => void;
  initial?: string[];
}

function setup(kind: PickerKind, items: CatalogueItem[], opts: SetupOpts = {}) {
  const type: LiType = opts.type ?? 'DISPLAY';
  const onApply = opts.onApply ?? vi.fn();
  const onCancel = opts.onCancel ?? vi.fn();
  const initial = opts.initial ?? [];
  renderDv(
    <AudiencePicker
      open
      kind={kind}
      items={items}
      lineItemType={type}
      initial={initial}
      onApply={onApply}
      onCancel={onCancel}
    />,
  );
  return { onApply, onCancel };
}

const typeOptions = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('combobox', { name: 'Audience type' }));
  const list = await screen.findByRole('listbox');
  return within(list)
    .getAllByRole('option')
    .filter((o) => !o.classList.contains('MuiListSubheader-root'))
    .map((o) => o.textContent);
};

describe('Select custom lists (LIT-006 to LIT-011)', () => {
  it('is a slide-over with Apply first and Cancel in the footer', () => {
    setup('custom', CUSTOM);
    const dialog = screen.getByRole('dialog', { name: 'Select custom lists' });
    const footer = dialog.querySelector('footer')!;
    expect(within(footer).getAllByRole('button').map((b) => b.textContent)).toEqual(['Apply', 'Cancel']);
  });

  it('Audience type defaults to Custom affinity and offers Custom lists, Custom affinity, Custom intent', async () => {
    const user = userEvent.setup();
    setup('custom', CUSTOM);
    expect(screen.getByRole('combobox', { name: 'Audience type' })).toHaveTextContent('Custom affinity');
    expect(await typeOptions(user)).toEqual(['Custom lists', 'Custom affinity', 'Custom intent']);
  });

  it('lists the affinity lists first with a Name header, a grey type line and a numeric ID column', () => {
    setup('custom', CUSTOM);
    const table = screen.getByRole('table', { name: 'Audiences' });
    expect(within(table).getByRole('columnheader', { name: 'Name' })).toBeInTheDocument();
    expect(within(table).getByText('Custom Affinity · Gadget fans')).toBeInTheDocument();
    expect(within(table).getByText('733976506')).toBeInTheDocument();
    expect(within(table).queryByText('Buying a phone')).toBeNull();
    expect(within(table).queryByText(/cuid-/)).toBeNull();
  });

  it('Custom intent shows the Display, Video list and hides the YouTube list on a Display line item', async () => {
    const user = userEvent.setup();
    setup('custom', CUSTOM);
    await user.click(screen.getByRole('combobox', { name: 'Audience type' }));
    await user.click(await screen.findByRole('option', { name: 'Custom intent' }));
    const table = screen.getByRole('table', { name: 'Audiences' });
    expect(within(table).getByText('Buying a phone')).toBeInTheDocument();
    expect(within(table).getByText('Custom Intent · Buying a phone')).toBeInTheDocument();
    expect(within(table).queryByText('Phone review viewers')).toBeNull();
  });

  it('a YouTube line item can pick the YouTube custom intent list', async () => {
    const user = userEvent.setup();
    const { onApply } = setup('custom', CUSTOM, { type: 'YT_VIDEO' });
    await user.click(screen.getByRole('combobox', { name: 'Audience type' }));
    await user.click(await screen.findByRole('option', { name: 'Custom intent' }));
    await user.click(screen.getByRole('checkbox', { name: 'Phone review viewers' }));
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(onApply).toHaveBeenCalledWith(['cuid-y1']);
  });

  it('has the filter bar, "None selected" with Clear all, and no suggestions or Add buttons', async () => {
    const user = userEvent.setup();
    setup('custom', CUSTOM);
    expect(screen.getByRole('textbox', { name: 'Enter a search term or select filters' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Filter' })).toBeInTheDocument();
    expect(screen.queryByText('Audience eligibility: Display')).toBeNull();
    expect(screen.getByText('None selected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear all' })).toBeDisabled();
    expect(screen.queryByText('Audience suggestions')).toBeNull();
    expect(screen.queryByRole('button', { name: /^Add/ })).toBeNull();
    await user.click(screen.getByRole('checkbox', { name: 'Gadget fans' }));
    expect(screen.getByText('1 selected')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(screen.getByText('None selected')).toBeInTheDocument();
  });

  it('the search box filters by name and by numeric ID, the × clears it', async () => {
    const user = userEvent.setup();
    setup('custom', CUSTOM);
    const box = screen.getByRole('textbox', { name: 'Enter a search term or select filters' });
    await user.type(box, '733976507');
    const table = screen.getByRole('table', { name: 'Audiences' });
    expect(within(table).getByText('Home cooks')).toBeInTheDocument();
    expect(within(table).queryByText('Gadget fans')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(within(table).getByText('Gadget fans')).toBeInTheDocument();
  });

  it('an empty list says "No audiences available"', () => {
    setup('custom', []);
    expect(screen.getByText('No audiences available')).toBeInTheDocument();
  });

  it('selects an affinity and an intent list and applies the internal ids, not the numeric ones', async () => {
    const user = userEvent.setup();
    const { onApply } = setup('custom', CUSTOM);
    await user.click(screen.getByRole('checkbox', { name: 'Gadget fans' }));
    await user.click(screen.getByRole('combobox', { name: 'Audience type' }));
    await user.click(await screen.findByRole('option', { name: 'Custom lists' }));
    await user.click(screen.getByRole('checkbox', { name: 'Buying a phone' }));
    expect(screen.getByText('2 selected')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(onApply).toHaveBeenCalledWith(['cuid-a1', 'cuid-i1']);
  });

  it('Cancel closes without applying', async () => {
    const user = userEvent.setup();
    const { onApply, onCancel } = setup('custom', CUSTOM);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
    expect(onApply).not.toHaveBeenCalled();
  });
});

describe('First-party and partner audiences (AUD-001, AUD-002)', () => {
  const FP: CatalogueItem[] = [
    item('f1', '9493897247', 'Site visitors', 'FIRST_PARTY', 'FIRST_PARTY'),
    item('p1', '9493897248', 'Auto intenders', 'PARTNER', 'FIRST_PARTY'),
  ];

  it('titles the slide-over and groups the type dropdown First-party / Partner, default First-party', async () => {
    const user = userEvent.setup();
    setup('firstParty', FP);
    expect(screen.getByRole('dialog', { name: 'First-party and partner audiences' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Audience type' })).toHaveTextContent('First-party');
    expect(await typeOptions(user)).toEqual(['First-party', 'PAIR', 'Commerce', 'Linear TV', 'Third-party']);
    const list = screen.getByRole('listbox');
    expect(within(list).getByText('Partner')).toBeInTheDocument();
    expect(within(list).queryByRole('option', { name: 'Lookalike' })).toBeNull();
    expect(within(list).queryByRole('option', { name: 'All types' })).toBeNull();
  });

  it('shows the eligibility chip with a ×, the funnel badge and the suggestions panel with its two buttons', async () => {
    const user = userEvent.setup();
    setup('firstParty', FP);
    expect(screen.getByText('Audience eligibility: Display')).toBeInTheDocument();
    expect(screen.getByTestId('filter-badge')).toHaveTextContent('1');
    const panel = screen.getByTestId('audience-suggestions');
    expect(within(panel).getByRole('heading', { name: 'Audience suggestions' })).toBeInTheDocument();
    expect(panel).toHaveTextContent(
      "For the best results, make sure you've entered some landing page URLs or keywords in your campaign settings.",
    );
    expect(within(panel).getByRole('button', { name: 'View suggestions' })).toBeInTheDocument();
    await user.click(within(panel).getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByTestId('audience-suggestions')).toBeNull();
  });

  it('has a header row with a select-all checkbox and an ID column; Third-party lists the partner list', async () => {
    const user = userEvent.setup();
    const { onApply } = setup('firstParty', FP);
    const table = screen.getByRole('table', { name: 'Audiences' });
    expect(within(table).getByRole('columnheader', { name: 'ID' })).toBeInTheDocument();
    expect(within(table).getByText('9493897247')).toBeInTheDocument();
    expect(within(table).queryByText('Auto intenders')).toBeNull();
    await user.click(within(table).getByRole('checkbox', { name: 'Select all' }));
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(onApply).toHaveBeenCalledWith(['f1']);
    await user.click(screen.getByRole('combobox', { name: 'Audience type' }));
    await user.click(await screen.findByRole('option', { name: 'Third-party' }));
    expect(within(table).getByText('Auto intenders')).toBeInTheDocument();
  });

  it('removing the eligibility chip stops filtering by line item type', async () => {
    const user = userEvent.setup();
    const yt = item('y', '1', 'YT only', 'FIRST_PARTY', 'FIRST_PARTY', YT);
    setup('firstParty', [yt]);
    expect(screen.getByText('No audiences available')).toBeInTheDocument();
    const chip = screen.getByText('Audience eligibility: Display').closest('.MuiChip-root')!;
    await user.click(chip.querySelector('.MuiChip-deleteIcon')!);
    expect(screen.getByText('YT only')).toBeInTheDocument();
  });

  it('View suggestions narrows the table to the suggested lists', async () => {
    const user = userEvent.setup();
    const many = Array.from({ length: 9 }, (_, n) =>
      item(`m${n}`, `${100 + n}`, `List ${n}`, 'FIRST_PARTY', 'FIRST_PARTY'),
    );
    setup('firstParty', many);
    await user.click(screen.getByRole('button', { name: 'View suggestions' }));
    expect(within(screen.getByRole('table', { name: 'Audiences' })).getAllByRole('checkbox')).toHaveLength(7);
  });
});

describe('Google audiences (AUD-003, AUD-006, AUD-007)', () => {
  it('has Affinity and In-market only, default Affinity', async () => {
    const user = userEvent.setup();
    setup('google', GOOGLE);
    expect(screen.getByRole('dialog', { name: 'Google audiences' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Audience type' })).toHaveTextContent('Affinity');
    expect(await typeOptions(user)).toEqual(['Affinity', 'In-market']);
  });

  it('lists Outdoor Enthusiasts with the real path and a numeric ID', () => {
    setup('google', GOOGLE);
    const table = screen.getByRole('table', { name: 'Audiences' });
    expect(
      within(table).getByText(
        'Display & Video 360 Audiences » Affinity Categories » Lifestyles & Hobbies » Outdoor Enthusiasts',
      ),
    ).toBeInTheDocument();
    expect(within(table).getByText('4929160')).toBeInTheDocument();
  });

  it('the catalogue is large enough: 40 affinity and 30 in-market audiences', () => {
    expect(GOOGLE.filter((g) => g.subtype === 'AFFINITY').length).toBeGreaterThanOrEqual(40);
    expect(GOOGLE.filter((g) => g.subtype === 'IN_MARKET').length).toBeGreaterThanOrEqual(30);
    for (const n of ['Outdoor Enthusiasts', 'Sports Fans', 'Fans of American Football', 'Basketball Fans', 'Soccer Fans', 'Baseball Fans', 'Cricket Fans', 'Tennis Fans', 'Yoga Enthusiasts'])
      expect(GOOGLE.some((g) => g.name === n)).toBe(true);
    expect(GOOGLE.every((g) => /^\d+$/.test(g.id))).toBe(true);
  });

  it('rows are 45 px with full-width rules', () => {
    setup('google', GOOGLE);
    const row = within(screen.getByRole('table', { name: 'Audiences' })).getAllByRole('row')[1]!;
    expect(getComputedStyle(row).height).toBe('45px');
    expect(getComputedStyle(row).borderBottomStyle).toBe('solid');
  });

  it('In-market switches the rows', async () => {
    const user = userEvent.setup();
    setup('google', GOOGLE);
    await user.click(screen.getByRole('combobox', { name: 'Audience type' }));
    await user.click(await screen.findByRole('option', { name: 'In-market' }));
    const table = screen.getByRole('table', { name: 'Audiences' });
    expect(within(table).getByText('Footwear')).toBeInTheDocument();
    expect(within(table).queryByText('Outdoor Enthusiasts')).toBeNull();
  });
});

describe('Select combined audience (AUD-004, AUD-008)', () => {
  it('has the Combined type, Display users and YouTube users tabs and the empty state', async () => {
    const user = userEvent.setup();
    setup('combined', []);
    expect(screen.getByRole('dialog', { name: 'Select combined audience' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Audience type' })).toHaveTextContent('Combined');
    expect(await typeOptions(user)).toEqual(['Combined']);
    await user.keyboard('{Escape}');
    expect(screen.getByRole('tab', { name: 'Display users' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'YouTube users' })).toBeInTheDocument();
    expect(screen.getByText('No audiences available')).toBeInTheDocument();
  });

  it('puts a YouTube combined audience on the YouTube users tab', async () => {
    const user = userEvent.setup();
    const c = [
      item('c1', '11', 'Display mix', 'COMBINED', 'COMBINED'),
      item('c2', '12', 'YouTube mix', 'COMBINED', 'COMBINED', YT),
    ];
    setup('combined', c, { type: 'YT_VIDEO' });
    expect(screen.queryByText('Display mix')).not.toBeNull();
    await user.click(screen.getByRole('tab', { name: 'YouTube users' }));
    expect(screen.getByText('YouTube mix')).toBeInTheDocument();
    expect(screen.queryByText('Display mix')).toBeNull();
  });
});
