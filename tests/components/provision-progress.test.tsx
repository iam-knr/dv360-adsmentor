// PROV-RACE2: a FAILED build stays FAILED with its message, and the student can press Retry on /sim/welcome.
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderDv } from './test-utils';
import { ProvisionProgress } from '@/components/sim/ProvisionProgress';

afterEach(() => vi.unstubAllGlobals());

describe('ProvisionProgress', () => {
  it('shows the error of a FAILED build and a Retry that posts retry:true and then follows the build', async () => {
    const calls: unknown[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        calls.push(JSON.parse(String(init?.body ?? '{}')));
        return new Response(
          JSON.stringify({ state: 'BUILDING', percent: 40, message: 'Loading your history' }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }),
    );
    renderDv(
      <ProvisionProgress
        initial={{ state: 'FAILED', percent: 0, message: 'Failed', error: 'seed exploded' }}
      />,
    );
    expect(screen.getByText(/seed exploded/)).toBeInTheDocument();
    // FAILED is final for the loop: nothing was posted by itself
    expect(calls).toEqual([]);
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.getByTestId('provision-progress')).toBeInTheDocument());
    expect(calls[0]).toEqual({ retry: true });
  });
});
