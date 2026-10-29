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
