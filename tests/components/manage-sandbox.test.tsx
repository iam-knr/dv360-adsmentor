import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderDv } from './test-utils';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
const rebuild = vi.hoisted(() => vi.fn());
vi.mock('@/lib/actions/accounts', () => ({
  rebuildSandboxAction: rebuild,
  retrySandboxAction: vi.fn(),
}));
vi.mock('@/components/sim/useProvisionDriver', () => ({
  useProvisionDriver: (_url: string, initial: unknown) => ({
    view: initial,
    setView: vi.fn(),
    busy: false,
  }),
}));

import { SandboxSection } from '@/components/manage/SandboxSection';

describe('SandboxSection', () => {
  it('S1: FAILED shows an admin message and puts the technical text behind Details', () => {
    const raw =
      'Reference data is missing: run the global seed (npm run db:seed) before building a sandbox';
    renderDv(
      <SandboxSection
        id="u1"
        canRecover
        initial={{ state: 'FAILED', percent: 0, message: 'Failed', error: raw }}
      />,
    );
    expect(screen.getByText(/The sandbox could not be built\. Try Retry/)).toBeInTheDocument();
    const details = screen.getByTestId<HTMLDetailsElement>('sandbox-error-details');
    expect(details.open).toBe(false);
    expect(details.querySelector('summary')?.textContent).toBe('Details');
    expect(details.textContent).toContain('npm run db:seed');
    expect(screen.getByText('State: Failed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry provisioning' })).toBeInTheDocument();
  });

  it('S8 and S9: BUILDING reads Building and shows the moving bar, step name and elapsed time', () => {
    renderDv(
      <SandboxSection
        id="u1"
        canRecover
        initial={{ state: 'BUILDING', percent: 55, message: 'Loading your history' }}
      />,
    );
    expect(screen.getByText('State: Building')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow');
    expect(screen.getByTestId('build-progress')).toHaveTextContent('Loading your history');
    expect(screen.getByTestId('build-progress')).toHaveTextContent('55%');
    expect(screen.getByTestId('build-elapsed')).toHaveTextContent(/^\d+s$/);
    expect(screen.queryByRole('button', { name: 'Rebuild sandbox' })).not.toBeInTheDocument();
  });

  it('S7: READY offers Rebuild sandbox behind a confirmation that says the work is deleted', async () => {
    const user = userEvent.setup();
    rebuild.mockResolvedValue({
      ok: true,
      data: { state: 'BUILDING', percent: 10, message: 'Creating your account' },
    });
    renderDv(
      <SandboxSection
        id="u1"
        studentName="Asha"
        canRecover
        initial={{ state: 'READY', percent: 100, message: 'Ready' }}
      />,
    );
    expect(screen.getByText('State: Ready')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Rebuild sandbox' }));
    expect(screen.getByText(/deletes everything Asha has built/)).toBeInTheDocument();
    expect(rebuild).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(rebuild).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Rebuild sandbox' }));
    const buttons = screen.getAllByRole('button', { name: 'Rebuild sandbox' });
    await user.click(buttons[buttons.length - 1]!);
    expect(rebuild).toHaveBeenCalledWith('u1');
  });

  it('S7: no rebuild button when the account may not be edited', () => {
    renderDv(
      <SandboxSection
        id="u1"
        canRecover={false}
        initial={{ state: 'READY', percent: 100, message: 'Ready' }}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Rebuild sandbox' })).not.toBeInTheDocument();
  });
});
