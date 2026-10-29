// AG rules: YouTube ad group (validation.md 2.13). AG-008 is the delete confirmation (DLG-08), handled by the dialog.
import {
  DIMENSION_LABEL,
  matrixDimensionOf,
  TARGETING_AVAILABILITY,
} from '../constants/targeting-availability';
import { LIMITS } from '../constants/limits';
import { MSG } from '../messages';
import { codePointLength, isBlank, isEmptyNum, positive } from '../primitives';
import type { AdGroupInput, AnyRule, Rule, Violation } from '../types';

function def(rule: Omit<Rule<AdGroupInput>, 'kind'>): Rule<AdGroupInput> {
  return { kind: 'adGroup', ...rule };
}

export const AG_001 = def({
  id: 'AG-001',
  severity: 'error',
  triggers: ['blur', 'save'],
  reads: ['name'],
  message: MSG.ENTER_VALUE,
  check: (g) => (isBlank(g.name) ? { path: 'name' } : null),
});

export const AG_002 = def({
  id: 'AG-002',
  severity: 'error',
  triggers: ['save'],
  reads: ['name'],
  message: MSG.MAX_CHARS,
  check: (g) =>
    codePointLength(g.name) > LIMITS.NAME_MAX_255
      ? { path: 'name', params: { max: LIMITS.NAME_MAX_255 } }
      : null,
});

export const AG_003 = def({
  id: 'AG-003',
  severity: 'error',
  triggers: ['blur', 'save'],
  reads: ['bid'],
  message: MSG.ENTER_VALUE,
  check: (g) => (isEmptyNum(g.bid) ? { path: 'bid' } : null),
});

export const AG_004 = def({
  id: 'AG-004',
  severity: 'error',
  triggers: ['blur', 'save'],
  reads: ['bid'],
  message: MSG.ENTER_POSITIVE,
  check: (g) => (!isEmptyNum(g.bid) && !positive(g.bid) ? { path: 'bid' } : null),
});

export const AG_005 = def({
  id: 'AG-005',
  severity: 'warning',
  triggers: ['cross'],
  reads: ['status', 'adCount'],
  message: MSG.AG_NO_ADS,
  appliesTo: (g) => g.status === 'ACTIVE' && (g.adCount ?? 0) === 0,
  check: () => ({ path: 'ads' }),
});

export const AG_006 = def({
  id: 'AG-006',
  severity: 'error',
  triggers: ['save'],
  reads: ['dimensions'],
  message: MSG.YT_AD_GROUP_DIM,
  check: (g) => {
    const out: Violation[] = [];
    (g.dimensions ?? []).forEach((key, i) => {
      const dim = matrixDimensionOf(key);
      if (dim && TARGETING_AVAILABILITY[dim].YTAG === 'N')
        out.push({ path: `dimensions[${i}]`, params: { Dimension: DIMENSION_LABEL[dim] } });
    });
    return out;
  },
});

export const AG_007 = def({
  id: 'AG-007',
  severity: 'info',
  triggers: ['cross'],
  reads: ['ads'],
  message:
    'Get more reach by including at least: 1 horizontal video ad, 10-60 sec. (Skippable in-stream and in-feed); 1 horizontal video ad, 6 sec. (Bumper); 1 vertical video ad, 5 sec. (Shorts)',
  check: () => ({ path: 'ads' }),
});

export const adGroupRules: readonly AnyRule[] = [AG_001, AG_002, AG_003, AG_004, AG_005, AG_006, AG_007];
