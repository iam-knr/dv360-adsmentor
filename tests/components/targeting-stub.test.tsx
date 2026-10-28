import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import { TargetingCard } from '@/components/targeting';
import { emptyTargetingState } from '@/lib/targeting';

describe('TargetingCard stub', () => {
  it('renders the placeholder text and has no a11y violations', async () => {
    const { container } = render(
      <TargetingCard
        lineItemType="display"
        value={emptyTargetingState('display')}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText('Targeting editors are not built yet')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });
});
