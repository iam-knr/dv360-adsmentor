// Custom lists in the audience picker: Custom affinity and the two Custom intent types are separate, labelled
// options, and the Create menu links to the three create forms (it used to be a permanently disabled button).
import { useState } from 'react';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AudiencePicker } from '@/components/targeting/editors/audience/AudiencePicker';
import type { CatalogueItem } from '@/components/targeting/editors/audience/useAudienceCatalogue';
import { renderDv } from './test-utils';

const custom = (id: string, name: string, type: string): CatalogueItem => ({
  id,
  name,
  path: `${name} » ${type}`,
  subtype: type,
  meta: { id, name, kind: 'CUSTOM' },
});
const ITEMS: CatalogueItem[] = [
  custom('1', 'Gadget fans', 'CUSTOM_AFFINITY'),
  custom('2', 'Buying a phone', 'CUSTOM_INTENT_DISPLAY_VIDEO'),
  custom('3', 'Watching phone reviews', 'CUSTOM_INTENT_YOUTUBE'),
];

function Harness() {
  const [ids, setIds] = useState<string[]>([]);
  return (
    <AudiencePicker
      open
      title="Custom lists"
      items={ITEMS}
      lineItemType={null}
      initial={ids}
      onApply={setIds}
      onCancel={vi.fn()}
    />
  );
}

describe('AudiencePicker custom lists', () => {
  it('offers Custom affinity and both Custom intent types as filters', async () => {
    const user = userEvent.setup();
    renderDv(<Harness />);
    await user.click(screen.getByRole('combobox', { name: 'Audience type' }));
    const list = await screen.findByRole('listbox');
    expect(within(list).getByRole('option', { name: 'Custom affinity' })).toBeInTheDocument();
    expect(
      within(list).getByRole('option', { name: 'Custom intent (Display, Video)' }),
    ).toBeInTheDocument();
    expect(within(list).getByRole('option', { name: 'Custom intent (YouTube)' })).toBeInTheDocument();
    await user.click(within(list).getByRole('option', { name: 'Custom intent (YouTube)' }));
    const group = screen.getByRole('group', { name: 'Audiences' });
    expect(within(group).getByText('Watching phone reviews')).toBeInTheDocument();
    expect(within(group).queryByText('Gadget fans')).not.toBeInTheDocument();
  });
});
