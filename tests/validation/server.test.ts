// server/context.ts and server/withValidation.ts (validation.md 6.6). The loader is a fake, so no database is needed.
import { describe, expect, it, vi } from 'vitest';
import { buildContext, type ContextLoader } from '@/lib/validation/server/context';
import { withValidation } from '@/lib/validation/server/withValidation';
import {
  fullLookups,
  makeCtx,
  NOW,
  validAdvertiser,
  validCampaign,
  validCampaignSnapshot,
  validIo,
  validIoSnapshot,
} from '@/lib/validation/testing/fixtures';
import type { CampaignInput } from '@/lib/validation/types';

function fakeLoader(): ContextLoader & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    now: () => NOW,
    partner: () => {
      calls.push('partner');
      return Promise.resolve({ enabledExchangeIds: ['ex-01'] });
    },
    advertiser: () => {
      calls.push('advertiser');
      return Promise.resolve(validAdvertiser());
    },
    campaign: () => {
      calls.push('campaign');
      return Promise.resolve(validCampaignSnapshot());
    },
    io: () => {
      calls.push('io');
      return Promise.resolve(validIoSnapshot());
    },
    original: (kind) => {
      calls.push(`original:${kind}`);
      return Promise.resolve(validIo());
    },
    children: () => {
      calls.push('children');
      return Promise.resolve({ lineItems: [] });
    },
    lookups: () => {
      calls.push('lookups');
      return Promise.resolve(fullLookups());
    },
  };
}

const actor = { userId: 'u1', role: 'STANDARD', limitedAccess: false } as const;

describe('buildContext', () => {
  it('builds a create context for a campaign without reading the stored entity', async () => {
    const loader = fakeLoader();
    const ctx = await buildContext(loader, 'campaign', { advertiserId: 'adv-1' }, actor);
    expect(ctx.mode).toBe('create');
    expect(ctx.original).toBeUndefined();
    expect(ctx.io).toBeUndefined();
    expect(ctx.campaign).toBeDefined();
    expect(ctx.now).toBe(NOW);
    expect(loader.calls).not.toContain('original:campaign');
  });

  it('reads the stored entity in edit mode', async () => {
    const loader = fakeLoader();
    const ctx = await buildContext(
      loader,
      'insertionOrder',
      { id: 'io-1', advertiserId: 'adv-1', campaignId: 'c-1' },
      actor,
    );
    expect(ctx.mode).toBe('edit');
    expect(ctx.original).toBeDefined();
    expect(ctx.children).toEqual({ lineItems: [] });
  });

  it('loads the IO for a line item and carries the source and switched-off rules', async () => {
    const loader = fakeLoader();
    const ctx = await buildContext(
      loader,
      'lineItem',
      { advertiserId: 'adv-1', ioId: 'io-1' },
      actor,
      {
        source: 'sdf',
        disabledRules: ['CMP-013'],
      },
    );
    expect(ctx.io).toBeDefined();
    expect(ctx.source).toBe('sdf');
    expect(ctx.disabledRules).toEqual(['CMP-013']);
    expect(ctx.actor).toEqual({ userId: 'u1', role: 'STANDARD', limitedAccess: false });
  });
});

describe('withValidation', () => {
  const context = () => Promise.resolve(makeCtx());

  it('stops at the first blocking issue and does not run the handler', async () => {
    const handler = vi.fn(() => Promise.resolve('saved'));
    const action = withValidation<CampaignInput, string>({ kind: 'campaign', context }, handler);
    const result = await action({ ...validCampaign(), name: '' });
    expect(result.ok).toBe(false);
    expect(result.issues.map((i) => i.ruleId)).toContain('CMP-001');
    expect(handler).not.toHaveBeenCalled();
  });

  it('runs the handler and returns warnings with the result', async () => {
    const handler = vi.fn((input: CampaignInput) => Promise.resolve(input.name));
    const action = withValidation<CampaignInput, string>({ kind: 'campaign', context }, handler);
    const result = await action({ ...validCampaign(), kpi: { type: 'CPA', value: 5 } });
    expect(result).toMatchObject({ ok: true, result: 'Fixture campaign' });
    expect(result.issues.map((i) => i.ruleId)).toContain('CMP-013');
    expect(result.issues.every((i) => !i.blocking)).toBe(true);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('validates a part of the input and adds the activation rules on request', async () => {
    const action = withValidation<{ io: ReturnType<typeof validIo>; activate: boolean }, string>(
      {
        kind: 'insertionOrder',
        context,
        entity: (i) => i.io,
        targetStatus: (i) => (i.activate ? 'ACTIVE' : 'DRAFT'),
      },
      () => Promise.resolve('ok'),
    );
    const ended = {
      ...validIo(),
      budget: {
        type: 'CURRENCY' as const,
        segments: [{ id: 's', amount: 5, startDate: '2026-10-01', endDate: '2026-10-05' }],
      },
    };
    expect((await action({ io: ended, activate: false })).ok).toBe(true);
    const blocked = await action({ io: ended, activate: true });
    expect(blocked.ok).toBe(false);
    expect(blocked.issues.map((i) => i.ruleId)).toContain('IO-092');
  });
});
