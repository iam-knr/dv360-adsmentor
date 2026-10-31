import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { LiTypePicker } from '@/components/line-items/LiTypePicker';
import { liTypeOptions } from '@/lib/line-items/type-config';

const io = { type: 'STANDARD', objective: 'BRAND_AWARENESS', mode: 'MANUAL' } as never;

describe('Q6 line item type picker', () => {
  it('shows the DV360 reason on a disabled type and the prerequisite on Demand Gen', () => {
    const options = liTypeOptions(io, { demandGenFloodlightOptimization: false });
    render(
      <LiTypePicker
        partnerId="1"
        advertiserId="2"
        campaignId="3"
        ioId="4"
        options={options}
        ios={[]}
      />,
    );
    const disabled = options.filter((o) => !o.enabled);
    for (const o of disabled) {
      expect(screen.getByTestId(`li-type-reason-${o.type}`)).toHaveTextContent(o.reason!);
    }
    const dg = options.find((o) => o.type === 'DEMAND_GEN')!;
    if (dg.enabled) expect(screen.getByTestId('li-type-prereq-DEMAND_GEN')).toHaveTextContent(dg.prerequisite!);
    else expect(screen.getByTestId('li-type-reason-DEMAND_GEN')).toBeInTheDocument();
  });
});
