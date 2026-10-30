// Banner mapping of the Troubleshooter (module 08 5.1 table). Pure.
import type { LiveStatus } from '@/lib/engine/diagnostics/liveStatus';
import type { TroubleshooterBanner } from './build';

const T: Record<LiveStatus, Omit<TroubleshooterBanner, 'code'> | null> = {
  PAUSED: {
    severity: 'ERROR',
    text: 'The line item is paused.',
    action: { label: 'Go to line item settings', target: 'details' },
  },
  DRAFT: {
    severity: 'ERROR',
    text: "The line item is a draft and isn't serving.",
    action: { label: 'Go to line item settings', target: 'details' },
  },
  NOT_STARTED: {
    severity: 'INFO',
    text: "The line item hasn't started yet.",
    action: { label: 'Go to line item settings', target: 'details' },
  },
  ENDED: {
    severity: 'INFO',
    text: "The line item's flight has ended.",
    action: { label: 'Go to line item settings', target: 'details' },
  },
  PARENT_PAUSED: {
    severity: 'ERROR',
    text: 'A parent campaign or insertion order is paused.',
    action: { label: 'Go to insertion order', target: 'parent' },
  },
  NO_BUDGET_SEGMENT: {
    severity: 'ERROR',
    text: 'The insertion order has no active budget segment.',
    action: { label: 'Go to insertion order settings', target: 'io' },
  },
  NO_ACTIVE_DEAL: {
    severity: 'ERROR',
    text: 'None of the selected deals are active.',
    action: { label: 'Open inventory', target: 'inventory' },
  },
  ARCHIVED: { severity: 'ERROR', text: 'The line item is archived.' },
  ACTIVE_LIMITED_BY_TARGETING: {
    severity: 'WARNING',
    text: 'Your targeting is limiting delivery.',
    action: { label: 'Open targeting', target: 'targeting' },
  },
  ACTIVE_LIMITED_BY_CREATIVES: {
    severity: 'WARNING',
    text: 'Your creatives are limiting delivery.',
    action: { label: 'Open creatives', target: 'creatives' },
  },
  ACTIVE_LIMITED_BY_BUDGET: {
    severity: 'WARNING',
    text: 'The budget is limiting delivery.',
    action: { label: 'Open budget', target: 'budget' },
  },
  ACTIVE_LIMITED_BY_PACING: {
    severity: 'WARNING',
    text: 'Pacing is limiting delivery.',
    action: { label: 'Open pacing', target: 'pacing' },
  },
  ACTIVE_LIMITED_BY_BID: {
    severity: 'WARNING',
    text: 'Your bid is limiting delivery.',
    action: { label: 'Raise bid', target: 'bid' },
  },
  ACTIVE_DELIVERING: null,
};

/** Statuses that replace the funnel with the banner only (Draft, paused, archived, ended, parent paused ...). */
export const NO_FUNNEL: readonly LiveStatus[] = [
  'PAUSED',
  'DRAFT',
  'NOT_STARTED',
  'ENDED',
  'PARENT_PAUSED',
  'NO_BUDGET_SEGMENT',
  'ARCHIVED',
];

export function bannerFor(code: LiveStatus): TroubleshooterBanner | undefined {
  const b = T[code];
  return b ? { code, ...b } : undefined;
}
