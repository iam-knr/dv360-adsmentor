// LI-AUD rules: Audio line items (validation.md 2.10). LI-AUD-003 and -010 are aliases of LI-102 and LI-060.
import type { AnyRule, LineItemInput, Rule } from '../types';
import { def as baseDef } from './line-item';

function def(rule: Omit<Rule<LineItemInput>, 'kind'>): Rule<LineItemInput> {
  return baseDef({
    ...rule,
    appliesTo: (l, ctx) => l.type === 'AUDIO' && (rule.appliesTo?.(l, ctx) ?? true),
  });
}

export const LI_AUD_001 = def({
  id: 'LI-AUD-001',
  severity: 'info',
  triggers: ['cross'],
  reads: ['inventory.exchanges'],
  message:
    'Google Ad Manager and Spotify Ad Exchange support public inventory for audio line items.',
  check: () => ({ path: 'inventory.exchanges' }),
});

export const LI_AUD_002 = def({
  id: 'LI-AUD-002',
  severity: 'info',
  triggers: ['cross'],
  reads: ['targeting.dimensions'],
  message:
    'Most audio ads serve in mobile app environments, which limits the available targeting options.',
  check: () => ({ path: 'targeting' }),
});

/** Audio line items default to a fixed bid. Documentation row. */
export const LI_AUD_004 = def({
  id: 'LI-AUD-004',
  severity: 'info',
  triggers: ['cross'],
  reads: ['bid.mode'],
  message: null,
  check: () => null,
});

export const liAudioRules: readonly AnyRule[] = [LI_AUD_001, LI_AUD_002, LI_AUD_004];
