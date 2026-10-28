// LI-APP rules: Mobile app install and Ads in mobile apps (validation.md 2.11). LI-APP-004 and -007 are aliases.
import { MSG } from '../messages';
import { isBlank } from '../primitives';
import type { AnyRule, LineItemInput, Rule } from '../types';
import { def as baseDef, typeLabel } from './line-item';
import { originalOf } from './shared';

type AppType = 'MOBILE_APP_INSTALL' | 'ADS_IN_MOBILE_APPS';

function def(
  types: readonly AppType[],
  rule: Omit<Rule<LineItemInput>, 'kind'>,
): Rule<LineItemInput> {
  return baseDef({
    ...rule,
    appliesTo: (l, ctx) =>
      !!l.type &&
      (types as readonly string[]).includes(l.type) &&
      (rule.appliesTo?.(l, ctx) ?? true),
  });
}

const both: readonly AppType[] = ['MOBILE_APP_INSTALL', 'ADS_IN_MOBILE_APPS'];
const install: readonly AppType[] = ['MOBILE_APP_INSTALL'];
const inApps: readonly AppType[] = ['ADS_IN_MOBILE_APPS'];

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((x) => b.includes(x));
}

export const LI_APP_001 = def(install, {
  id: 'LI-APP-001',
  severity: 'error',
  triggers: ['save'],
  reads: ['app.platform'],
  message: 'Choose a platform.',
  check: (l) => (l.app?.platform ? null : { path: 'app.platform' }),
});

export const LI_APP_002 = def(install, {
  id: 'LI-APP-002',
  severity: 'error',
  triggers: ['save'],
  reads: ['app.storeId'],
  message: 'Select an app.',
  check: (l) => (isBlank(l.app?.storeId) ? { path: 'app.storeId' } : null),
});

export const LI_APP_003 = def(both, {
  id: 'LI-APP-003',
  severity: 'error',
  triggers: ['save'],
  reads: ['adType'],
  message: MSG.SELECTION_REQUIRED,
  check: (l) => (l.adType === 'DISPLAY' || l.adType === 'VIDEO' ? null : { path: 'adType' }),
});

export const LI_APP_005 = def(inApps, {
  id: 'LI-APP-005',
  severity: 'error',
  triggers: ['save'],
  reads: ['targeting.environment'],
  message: MSG.TARGETING_LOCKED_TYPE,
  check: (l) =>
    sameSet(l.targeting.environment?.include ?? [], ['APP'])
      ? null
      : { path: 'targeting.environment', params: { Type: typeLabel(l) } },
});

export const LI_APP_006 = def(inApps, {
  id: 'LI-APP-006',
  severity: 'error',
  triggers: ['save'],
  reads: ['targeting.device'],
  message: MSG.TARGETING_LOCKED_TYPE,
  check: (l) =>
    sameSet(l.targeting.device?.include ?? [], ['SMARTPHONE', 'TABLET'])
      ? null
      : { path: 'targeting.device', params: { Type: typeLabel(l) } },
});

export const LI_APP_008 = def(both, {
  id: 'LI-APP-008',
  severity: 'error',
  triggers: ['save'],
  reads: ['app'],
  message: MSG.LOCKED_AFTER_CREATE,
  appliesTo: (_l, ctx) => ctx.mode === 'edit',
  check: (l, ctx) => {
    const stored = originalOf<LineItemInput>(ctx)?.app;
    if (!stored) return null;
    const changed = stored.platform !== l.app?.platform || stored.storeId !== l.app?.storeId;
    return changed ? { path: 'app' } : null;
  },
});

export const LI_APP_009 = def(install, {
  id: 'LI-APP-009',
  severity: 'warning',
  triggers: ['activate'],
  reads: ['bid.optimizedTowards'],
  message: 'Link an app attribution partner to measure installs.',
  appliesTo: (_l, ctx) => !ctx.advertiser.appAttributionLinked,
  check: () => ({ path: 'bid.optimizedTowards' }),
});

export const liAppRules: readonly AnyRule[] = [
  LI_APP_001,
  LI_APP_002,
  LI_APP_003,
  LI_APP_005,
  LI_APP_006,
  LI_APP_008,
  LI_APP_009,
];
