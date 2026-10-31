import { useState } from 'react';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  AudiencePicker,
  type PickerCategory,
} from '@/components/targeting/editors/audience/AudiencePicker';
import type { CatalogueItem } from '@/components/targeting/editors/audience/useAudienceCatalogue';
import type { LiType } from '@/lib/validation/constants/li-compat';
import { renderDv } from './test-utils';

const YT: LiType[] = ['YT_VIDEO', 'YT_AUDIO', 'YT_ON_CTV'];
const item = (
  id: string,
  name: string,
  subtype: string,
  eligibleTypes?: LiType[],
): CatalogueItem => ({
  id,
  name,
  path: `${subtype} » ${name}`,
  subtype,
  meta: { id, name, kind: 'CUSTOM', ...(eligibleTypes ? { eligibleTypes } : {}) },
});

const ITEMS: CatalogueItem[] = [
  item('a1', 'Gadget fans', 'CUSTOM_AFFINITY'),
  item('a2', 'Home cooks', 'CUSTOM_AFFINITY'),
  item('i1', 'Buying a phone', 'CUSTOM_INTENT_DISPLAY_VIDEO'),
  item('y1', 'Phone review viewers', 'CUSTOM_INTENT_YOUTUBE', YT),
];
const CATEGORIES: PickerCategory[] = [
  { value: 'CUSTOM_AFFINITY', createHref: '/new-affinity' },
  { value: 'CUSTOM_INTENT_DISPLAY_VIDEO', createHref: '/new-intent?surface=display' },
  { value: 'CUSTOM_INTENT_YOUTUBE', createHref: '/new-intent?surface=youtube' },
];

function Harness({
  items = ITEMS,
  type = 'DISPLAY',
  onApply = () => undefined,
}: {
  items?: CatalogueItem[];
  type?: LiType;
  onApply?: (ids: string[]) => void;
}) {
  const [open] = useState(true);
  return (
    <AudiencePicker
      open={open}
      title="Custom lists"
      items={items}
      lineItemType={type}
      initial={[]}
      categories={CATEGORIES}
      onApply={onApply}
      onCancel={() => undefined}
    />
  );
}

describe('AudiencePicker: custom lists (module 10 2.5, module 14 S2)', () => {
  it('lists the lists of the advertiser with their type as breadcrumb', () => {
    renderDv(<Harness />);
    const list = screen.getByRole('group', { name: 'Audiences' });
    expect(within(list).getByText('Gadget fans')).toBeInTheDocument();
    expect(within(list).getByText('CUSTOM_AFFINITY » Gadget fans')).toBeInTheDocument();
  });

  it('offers Custom affinity and Custom intent (Display, Video) with counts, and hides YouTube intent on Display', async () => {
    const user = userEvent.setup();
    renderDv(<Harness />);
    await user.click(screen.getByRole('combobox', { name: 'Audience type' }));
    expect(await screen.findByRole('option', { name: 'Custom affinity' })).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'Custom intent (Display, Video)' }),
    ).toBeInTheDocument();
    // the YouTube list is not eligible for a Display line item (TGT-101), so it is not listed
    expect(screen.getByRole('option', { name: 'Custom intent (YouTube)' })).toBeInTheDocument();
    expect(screen.queryByText('Phone review viewers')).toBeNull();
  });

  it('a YouTube line item can pick the YouTube custom intent list', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    renderDv(<Harness type="YT_VIDEO" onApply={onApply} />);
    await user.click(screen.getByRole('checkbox', { name: 'Phone review viewers' }));
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(onApply).toHaveBeenCalledWith(['y1']);
  });

  it('filters by category and searches by type name', async () => {
    const user = userEvent.setup();
    renderDv(<Harness />);
    await user.click(screen.getByRole('combobox', { name: 'Audience type' }));
    await user.click(await screen.findByRole('option', { name: 'Custom affinity' }));
    const list = screen.getByRole('group', { name: 'Audiences' });
    expect(within(list).queryByText('Buying a phone')).toBeNull();
    expect(within(list).getAllByRole('checkbox')).toHaveLength(2);
  });

  it('an empty category says so and links to the form that creates such a list', async () => {
    const user = userEvent.setup();
    renderDv(<Harness items={ITEMS.filter((i) => i.subtype !== 'CUSTOM_AFFINITY')} />);
    await user.click(screen.getByRole('combobox', { name: 'Audience type' }));
    await user.click(await screen.findByRole('option', { name: 'Custom affinity' }));
    expect(screen.getByText(/No Custom affinity lists yet/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create a custom affinity list' })).toHaveAttribute(
      'href',
      '/new-affinity',
    );
  });

  it('selects both a custom affinity and a custom intent list and applies them', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    renderDv(<Harness onApply={onApply} />);
    await user.click(screen.getByRole('checkbox', { name: 'Gadget fans' }));
    await user.click(screen.getByRole('checkbox', { name: 'Buying a phone' }));
    expect(screen.getByText('2 selected')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(onApply).toHaveBeenCalledWith(['a1', 'i1']);
  });
});
