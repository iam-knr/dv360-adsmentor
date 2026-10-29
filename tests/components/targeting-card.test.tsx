import { useState } from 'react';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { TargetingCard } from '@/components/targeting';
import { emptyTargetingState, type TargetingState } from '@/lib/targeting';
import { renderDv } from './test-utils';

function Harness({ type = 'DISPLAY', readOnly = false }: { type?: string; readOnly?: boolean }) {
  const [state, setState] = useState<TargetingState>(emptyTargetingState(type));
  return (
    <TargetingCard lineItemType={type} value={state} onChange={setState} readOnly={readOnly} />
  );
}

describe('TargetingCard', () => {
  it('shows pre-added rows and adds a row from the menu with an "Added" mark', async () => {
    const user = userEvent.setup();
    renderDv(<Harness type="CTV" />);
    expect(screen.getByTestId('target-row-DEVICE')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add targeting' }));
    await user.click(await screen.findByRole('menuitem', { name: /Language/ }));
    expect(await screen.findByRole('dialog', { name: /Language/ })).toBeInTheDocument();
  });

  it('opens an editor as a slide-over and Cancel keeps the state', async () => {
    const user = userEvent.setup();
    renderDv(<Harness type="CTV" />);
    await user.click(screen.getByRole('button', { name: 'Edit Device' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.getByTestId('target-row-DEVICE')).toBeInTheDocument();
  });

  it('read-only users see the editor without Apply (AC-10-23)', async () => {
    const user = userEvent.setup();
    renderDv(<Harness type="CTV" readOnly />);
    await user.click(screen.getByRole('button', { name: 'View Device' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByRole('button', { name: 'Apply' })).toBeNull();
  });

  it('removes a removable row with the trash icon', async () => {
    const user = userEvent.setup();
    renderDv(<Harness type="CTV" />);
    await user.click(screen.getByRole('button', { name: 'Remove Device' }));
    expect(screen.queryByTestId('target-row-DEVICE')).toBeNull();
  });
});

describe('TargetingCard locks, tree and device editors', () => {
  it('Display Viewability is locked: Open Measurement text, lock icon, no trash (AC-10-09, AC-10-16)', async () => {
    const user = userEvent.setup();
    renderDv(<Harness type="DISPLAY" />);
    expect(screen.getByTestId('target-row-VIEWABILITY')).toHaveTextContent('Open Measurement');
    expect(screen.queryByRole('button', { name: 'Remove Viewability' })).toBeNull();
    expect(screen.getByTestId('locked-VIEWABILITY')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Edit Viewability' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Open Measurement enabled')).toBeInTheDocument();
    expect(dialog).toHaveTextContent('(locked)');
    expect(within(dialog).queryByRole('button', { name: /delete|remove/i })).toBeNull();
    expect(
      within(dialog).getByRole('combobox', { name: /Predicted viewability/ }),
    ).toHaveTextContent('All impressions');
  });

  it('a locked row shows the LI-100 tooltip text on focus (AC-10-16)', async () => {
    const user = userEvent.setup();
    renderDv(<Harness type="DISPLAY" />);
    await user.tab();
    screen.getByTestId('locked-VIEWABILITY').focus();
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      "This targeting is set in the advertiser's targeting rules.",
    );
  });

  it('Categories tree expands and ✓/⊘ works on a child (AC-10-02, AC-10-07)', async () => {
    const user = userEvent.setup();
    renderDv(<Harness type="DISPLAY" />);
    await user.click(screen.getByRole('button', { name: 'Add targeting' }));
    await user.click(await screen.findByRole('menuitem', { name: /Categories/ }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByRole('button', { name: 'Include Team Sports' })).toBeNull();
    await user.click(within(dialog).getByRole('button', { name: 'Expand Sports' }));
    await user.click(within(dialog).getByRole('button', { name: 'Include Team Sports' }));
    expect(within(dialog).getByRole('button', { name: 'Include Team Sports' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Exclude Team Sports' }));
    expect(within(dialog).getByRole('button', { name: 'Include Team Sports' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Include Sports' }));
    await user.click(within(dialog).getByRole('button', { name: 'Apply' }));
    expect(screen.getByTestId('target-row-CATEGORIES')).toHaveTextContent('Include: Sports');
  });

  it('Categories search reveals matching sub-categories', async () => {
    const user = userEvent.setup();
    renderDv(<Harness type="DISPLAY" />);
    await user.click(screen.getByRole('button', { name: 'Add targeting' }));
    await user.click(await screen.findByRole('menuitem', { name: /Categories/ }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByRole('textbox', { name: 'Search categories' }), 'poetry');
    expect(within(dialog).getByRole('button', { name: 'Include Poetry' })).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Include Finance' })).toBeNull();
  });

  it('Device editor has operating system and make and model lists', async () => {
    const user = userEvent.setup();
    renderDv(<Harness type="CTV" />);
    await user.click(screen.getByRole('button', { name: 'Edit Device' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Operating system')).toBeInTheDocument();
    expect(within(dialog).getByText('Make and model')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('checkbox', { name: 'Apple iPhone' }));
    await user.click(within(dialog).getByRole('button', { name: 'Apply' }));
    expect(screen.getByTestId('target-row-DEVICE')).toHaveTextContent(
      '1 operating system or model',
    );
  });
});
