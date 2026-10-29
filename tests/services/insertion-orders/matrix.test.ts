// V-07-19: the matrix served to the client equals MX-02; V-07-21 (pure part): the automation patch.
import { describe, expect, it } from 'vitest';
import { ioObjectiveMatrix } from '@/lib/insertion-orders/matrix';
import { automationPatch, needsPropagation } from '@/lib/insertion-orders/propagation';

describe('io-objective-matrix (V-07-19, AC-07-02)', () => {
  it('matches the snapshot for the three IO types', () => {
    expect({
      STANDARD: ioObjectiveMatrix('STANDARD'),
      CTV_OTT: ioObjectiveMatrix('CTV_OTT'),
      DOOH: ioObjectiveMatrix('DOOH'),
    }).toMatchSnapshot();
  });
  it('CTV disables Clicks; DOOH enables only "without objective"', () => {
    const ctv = ioObjectiveMatrix('CTV_OTT').objectives;
    expect(ctv.filter((o) => !o.enabled).map((o) => o.key)).toEqual(['CLICKS']);
    expect(ctv.find((o) => o.key === 'CLICKS')?.disabledReason).toBe(
      "Clicks isn't available for Connected TV and OTT insertion orders.",
    );
    const dooh = ioObjectiveMatrix('DOOH').objectives;
    expect(dooh.filter((o) => o.enabled).map((o) => o.key)).toEqual(['NONE']);
    expect(dooh.find((o) => o.key === 'NONE')?.lineItemTypes).toEqual([
      'DOOH_DISPLAY',
      'DOOH_VIDEO',
    ]);
  });
  it('Standard Clicks lists CPC, CTR, Value / Cost', () => {
    const clicks = ioObjectiveMatrix('STANDARD').objectives.find((o) => o.key === 'CLICKS')!;
    expect(clicks.kpis).toEqual(['CPC', 'CTR', 'VALUE_COST']);
    expect(clicks.lineItemTypes).toContain('DEMAND_GEN');
  });
});

describe('automation propagation (V-07-21)', () => {
  const li = {
    id: 'li',
    pacingPeriod: 'DAILY',
    pacingType: 'EVEN',
    bidKind: 'FIXED',
    bidGoal: null,
  } as const;
  it('forces Flight + ASAP and copies the strategy', () => {
    expect(automationPatch(li, 'MAX_CLICKS')).toEqual({
      pacingPeriod: 'FLIGHT',
      pacingType: 'ASAP',
      bidKind: 'AUTOMATED',
      bidGoal: 'MAX_CLICKS',
    });
  });
  it('returns null when the line item already matches', () => {
    expect(
      automationPatch(
        {
          id: 'x',
          pacingPeriod: 'FLIGHT',
          pacingType: 'ASAP',
          bidKind: 'AUTOMATED',
          bidGoal: 'MAX_REACH',
        },
        'MAX_REACH',
      ),
    ).toBeNull();
  });
  it('runs only on a switch to automation or a new strategy', () => {
    expect(
      needsPropagation(
        { mode: 'LI_CONTROLLED', optimizedTowards: null },
        { mode: 'IO_AUTOMATED', optimizedTowards: 'MAX_REACH' },
      ),
    ).toBe(true);
    expect(
      needsPropagation(
        { mode: 'IO_AUTOMATED', optimizedTowards: 'MAX_REACH' },
        { mode: 'IO_AUTOMATED', optimizedTowards: 'MAX_REACH' },
      ),
    ).toBe(false);
    expect(
      needsPropagation(
        { mode: 'IO_AUTOMATED', optimizedTowards: 'MAX_REACH' },
        { mode: 'LI_CONTROLLED' },
      ),
    ).toBe(false);
  });
});
