// plan-fix2 UI fixes: wizard (single day count, demographics), Combined tab filter, template dates, Max CPM warning.
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderDv } from './test-utils';

const nav = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push, replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));
const created = vi.hoisted(() => vi.fn());
vi.mock('@/lib/planning/actions', () => ({
  createPlanAction: created,
}));
vi.mock('@/lib/templates/actions', () => ({ setTemplateStatusAction: vi.fn() }));
vi.mock('@/components/shell/ViewerProvider', () => ({
  useViewer: () => ({ viewer: { readOnly: false, limitedAccess: false } }),
}));

const { NewPlanWizard } = await import('@/components/planning/NewPlanWizard');
const { CombinedGrid } = await import('@/components/campaigns/CombinedGrid');
const { TemplateList } = await import('@/components/templates/TemplateList');
const { cpmWarningsOf } = await import('@/components/planning/PlanPage');

describe('New plan wizard', () => {
  it('shows the day count once and saves All people as 18 to 65+', async () => {
    created.mockResolvedValue({ ok: true, data: { publicId: '9' } });
    renderDv(
      <NewPlanWizard
        partnerId="1"
        advertiserId="2"
        defaults={{
          name: 'Plan',
          location: 'IN',
          currencyCode: 'INR',
          start: '2026-11-01',
          end: '2026-11-30',
          simToday: '2026-10-30',
          canWrite: true,
        }}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getAllByText('30 days')).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: 'Next: Add products' }));
    expect(created).toHaveBeenCalledWith(
      '2',
      expect.objectContaining({
        demographics: { genders: ['MALE', 'FEMALE', 'UNKNOWN'], ageMin: 18, ageMax: 120 },
      }),
    );
  });
});

describe('Campaign Combined tab', () => {
  const io = (publicId: string, status: 'DRAFT' | 'ACTIVE') => ({
    kind: 'IO' as const,
    key: `io-${publicId}`,
    publicId,
    ioPublicId: publicId,
    name: `IO ${publicId}`,
    status,
    type: 'Standard',
    impressions: 0,
    clicks: 0,
    conversions: 0,
    revenue: 0,
    children: [],
  });
  it('uses the Active default of the Insertion orders tab: a draft IO is not listed until the filter allows it', async () => {
    renderDv(
      <CombinedGrid
        partnerId="1"
        advertiserId="2"
        campaignId="3"
        currency="INR"
        rows={[io('10', 'DRAFT'), io('11', 'DRAFT')]}
      />,
    );
    expect(screen.getByText('No insertion orders')).toBeInTheDocument();
    expect(screen.queryByText('IO 10')).toBeNull();
    await userEvent.click(screen.getByRole('combobox', { name: 'Status filter' }));
    await userEvent.click(screen.getByRole('option', { name: 'Status: All' }));
    expect(screen.getByText('IO 10')).toBeInTheDocument();
  });
});

describe('Targeting templates list', () => {
  it('shows Last modified like the rest of the app, not dd/mm/yyyy', () => {
    renderDv(
      <TemplateList
        partnerId="1"
        advertiserId="2"
        data={{
          canWrite: true,
          limitedAccess: false,
          rows: [
            {
              id: 't',
              publicId: '5',
              name: 'T1',
              type: 'DISPLAY',
              typeLabel: 'Display',
              description: '',
              status: 'ACTIVE',
              lastModified: '2026-10-31T10:00:00.000Z',
            },
          ],
        }}
      />,
    );
    expect(screen.getByText('Oct 31, 2026')).toBeInTheDocument();
    expect(screen.queryByText('31/10/2026')).toBeNull();
  });
});

describe('Max CPM warning', () => {
  it('names the line item whose Max CPM is below the expected CPM', () => {
    const rows = [{ id: 'a', name: 'Banner', maxCpm: 100 }] as never;
    const forecast = {
      perRow: { a: { avgCost: 142.9, expectedSpendPct: 75.1 } },
    } as never;
    const [w] = cpmWarningsOf(rows, forecast, 'INR');
    expect(w).toContain('Banner');
    expect(w).toContain('Max. CPM');
    expect(w).toContain('75%');
    expect(cpmWarningsOf(rows, null, 'INR')).toEqual([]);
  });
});
