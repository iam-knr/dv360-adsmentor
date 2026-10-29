// AUD rules: audiences (validation.md 2.19, module 14 4.2). AUD-023..025 and AUD-110..114 are the module's proposals,
// adopted by RC-053. Lock rules (AUD-110) compare the stored values the service passes in `changed`.
import { LIMITS } from '../constants/limits';
import { MSG } from '../messages';
import { isBlank, isUrl, isWhole, toNum } from '../primitives';
import type { AnyRule, Num, Rule } from '../types';

export type AudienceKindKey =
  | 'TAG_BASED'
  | 'CUSTOMER_MATCH'
  | 'YOUTUBE_USERS'
  | 'LOOKALIKE'
  | 'COMBINED'
  | 'CUSTOM_AFFINITY'
  | 'CUSTOM_INTENT_DISPLAY_VIDEO'
  | 'CUSTOM_INTENT_YOUTUBE'
  | 'PARTNER';

export interface AudienceRuleInput {
  type: AudienceKindKey;
  name: string;
  // tag-based
  floodlightActivityId?: string | null;
  /** Remarketing flag of the chosen activity. */
  activityRemarketing?: boolean;
  tagRules?: { variableKey: string; operator: string; value: string }[];
  // shared
  membershipDays?: Num;
  // customer match
  dataSource?: 'CONNECT' | 'UPLOAD' | 'LATER' | null;
  file?: {
    present: boolean;
    error?: 'NO_FILE' | 'NOT_CSV' | 'NO_IDENTIFIER' | 'TOO_MANY_ROWS';
  } | null;
  consentAck?: boolean;
  /** Matched users of an existing list that a line item targets (AUD-022). */
  matchedUsersInUse?: number | null;
  // combined
  includeGroups?: string[][];
  excludeIds?: string[];
  /** Audience ids that would make the list include itself, directly or through a nested list (AUD-111). */
  cyclic?: boolean;
  allIncludedArchived?: boolean;
  // lookalike
  seeds?: { id: string; users: number }[];
  reachPct?: Num;
  countries?: string[];
  // custom lists
  interests?: string[];
  urls?: string[];
  apps?: string[];
  keywords?: string[];
  // YouTube users
  linkedChannels?: number;
  // edit
  /** Field names that differ from the stored audience and are locked after creation (AUD-110). */
  lockedChanges?: string[];
  // archive
  targetingLineItems?: number;
  // analysis
  analysisSeedUsers?: number;
  insightsOptimized?: boolean;
}

const aud = (rule: Omit<Rule<AudienceRuleInput>, 'kind'>): AnyRule =>
  ({ kind: 'audience', ...rule }) as unknown as AnyRule;

/** Kind-specific fields are locked after creation (AUD-110), so their rules read only when creating. */
const creating = (ctx: { mode: string }) => ctx.mode === 'create';

const isCustom = (t: AudienceKindKey) =>
  t === 'CUSTOM_AFFINITY' || t === 'CUSTOM_INTENT_DISPLAY_VIDEO' || t === 'CUSTOM_INTENT_YOUTUBE';
const isIntent = (t: AudienceKindKey) =>
  t === 'CUSTOM_INTENT_DISPLAY_VIDEO' || t === 'CUSTOM_INTENT_YOUTUBE';
const hasDuration = (t: AudienceKindKey) =>
  t === 'TAG_BASED' || t === 'CUSTOMER_MATCH' || t === 'YOUTUBE_USERS';

export const audienceRules: readonly AnyRule[] = [
  aud({
    id: 'AUD-001',
    severity: 'error',
    triggers: ['blur', 'save'],
    reads: ['name'],
    message: MSG.ENTER_VALUE,
    check: (a) => (isBlank(a.name) ? { path: 'name' } : null),
  }),
  aud({
    id: 'AUD-002',
    severity: 'error',
    triggers: ['save'],
    reads: ['name'],
    message: MSG.MAX_CHARS,
    check: (a) =>
      a.name.length > LIMITS.NAME_MAX_255 ? { path: 'name', params: { max: LIMITS.NAME_MAX_255 } } : null,
  }),
  aud({
    id: 'AUD-010',
    severity: 'error',
    triggers: ['save'],
    reads: ['floodlightActivityId'],
    message: 'Select a Floodlight activity.',
    appliesTo: (a, ctx) => creating(ctx) && (a.type === 'TAG_BASED'),
    check: (a) => (isBlank(a.floodlightActivityId) ? { path: 'floodlightActivityId' } : null),
  }),
  aud({
    id: 'AUD-011',
    severity: 'error',
    triggers: ['save'],
    reads: ['tagRules'],
    message: MSG.ENTER_VALUE,
    appliesTo: (a, ctx) => creating(ctx) && (a.type === 'TAG_BASED'),
    check: (a) =>
      (a.tagRules ?? []).flatMap((r, i) =>
        isBlank(r.variableKey) || isBlank(r.operator) || isBlank(r.value)
          ? [{ path: `tagRules[${i}].value` }]
          : [],
      ),
  }),
  aud({
    id: 'AUD-012',
    severity: 'error',
    triggers: ['blur', 'save'],
    reads: ['floodlightActivityId'],
    message: 'Turn on remarketing for this Floodlight activity first.',
    appliesTo: (a, ctx) => creating(ctx) && (a.type === 'TAG_BASED' && !isBlank(a.floodlightActivityId)),
    check: (a) => (a.activityRemarketing ? null : { path: 'floodlightActivityId' }),
  }),
  aud({
    id: 'AUD-020',
    severity: 'error',
    triggers: ['save'],
    reads: ['dataSource'],
    message: MSG.SELECTION_REQUIRED,
    appliesTo: (a, ctx) => creating(ctx) && (a.type === 'CUSTOMER_MATCH'),
    check: (a) => (a.dataSource ? null : { path: 'dataSource' }),
  }),
  aud({
    id: 'AUD-021',
    severity: 'error',
    triggers: ['save'],
    reads: ['file'],
    message: 'Upload a CSV file with at least one identifier column.',
    appliesTo: (a, ctx) => creating(ctx) && (a.type === 'CUSTOMER_MATCH' && a.dataSource === 'UPLOAD'),
    check: (a) =>
      !a.file?.present || a.file.error === 'NO_FILE' || a.file.error === 'NOT_CSV' || a.file.error === 'NO_IDENTIFIER'
        ? { path: 'file' }
        : null,
  }),
  aud({
    id: 'AUD-022',
    severity: 'warning',
    triggers: ['cross'],
    reads: ['matchedUsersInUse'],
    message: 'This list has fewer than 1,000 matched users and may not deliver.',
    appliesTo: (a) => a.type === 'CUSTOMER_MATCH' && a.matchedUsersInUse !== undefined && a.matchedUsersInUse !== null,
    check: (a) => ((a.matchedUsersInUse ?? 0) < 1000 ? { path: 'file' } : null),
  }),
  aud({
    id: 'AUD-023',
    severity: 'error',
    triggers: ['save'],
    reads: ['consentAck'],
    message: 'Confirm that you have permission to use this data.',
    appliesTo: (a, ctx) => creating(ctx) && (a.type === 'CUSTOMER_MATCH' && a.dataSource === 'UPLOAD'),
    check: (a) => (a.consentAck ? null : { path: 'consentAck' }),
  }),
  aud({
    id: 'AUD-024',
    severity: 'error',
    triggers: ['blur', 'save'],
    reads: ['membershipDays'],
    message: 'Enter a number between 1 and 540.',
    appliesTo: (a) => hasDuration(a.type) && a.membershipDays !== undefined,
    check: (a) => {
      const n = toNum(a.membershipDays);
      return n === null || !isWhole(a.membershipDays) || n < 1 || n > 540 ? { path: 'membershipDays' } : null;
    },
  }),
  aud({
    id: 'AUD-025',
    severity: 'error',
    triggers: ['save'],
    reads: ['file'],
    message: 'Upload a file with 100,000 rows or fewer.',
    appliesTo: (a, ctx) => creating(ctx) && (a.type === 'CUSTOMER_MATCH' && a.dataSource === 'UPLOAD'),
    check: (a) => (a.file?.error === 'TOO_MANY_ROWS' ? { path: 'file' } : null),
  }),
  aud({
    id: 'AUD-030',
    severity: 'error',
    triggers: ['save'],
    reads: ['includeGroups'],
    message: 'Add at least one audience to include.',
    appliesTo: (a, ctx) => creating(ctx) && (a.type === 'COMBINED'),
    check: (a) => ((a.includeGroups ?? []).some((g) => g.length > 0) ? null : { path: 'includeGroups' }),
  }),
  aud({
    id: 'AUD-031',
    severity: 'error',
    triggers: ['save', 'cross'],
    reads: ['includeGroups', 'excludeIds'],
    message: "An item can't be both included and excluded.",
    appliesTo: (a, ctx) => creating(ctx) && (a.type === 'COMBINED'),
    check: (a) => {
      const inc = new Set((a.includeGroups ?? []).flat());
      return (a.excludeIds ?? []).some((id) => inc.has(id)) ? { path: 'excludeIds' } : null;
    },
  }),
  aud({
    id: 'AUD-040',
    severity: 'error',
    triggers: ['save'],
    reads: ['seeds'],
    message: 'Select between 1 and 10 first-party lists.',
    appliesTo: (a, ctx) => creating(ctx) && (a.type === 'LOOKALIKE'),
    check: (a) => {
      const n = (a.seeds ?? []).length;
      return n < 1 || n > 10 ? { path: 'seeds' } : null;
    },
  }),
  aud({
    id: 'AUD-041',
    severity: 'error',
    triggers: ['save', 'blur'],
    reads: ['seeds'],
    message: MSG.LOOKALIKE_MIN,
    appliesTo: (a, ctx) => creating(ctx) && (a.type === 'LOOKALIKE'),
    check: (a) =>
      (a.seeds ?? []).flatMap((s, i) => (s.users < 1000 ? [{ path: `seeds[${i}]` }] : [])),
  }),
  aud({
    id: 'AUD-042',
    severity: 'error',
    triggers: ['save'],
    reads: ['reachPct'],
    message: 'Choose a reach between 2.5% and 10%.',
    appliesTo: (a, ctx) => creating(ctx) && (a.type === 'LOOKALIKE'),
    check: (a) => {
      const n = toNum(a.reachPct);
      return n === null || ![2.5, 5, 7.5, 10].includes(n) ? { path: 'reachPct' } : null;
    },
  }),
  aud({
    id: 'AUD-043',
    severity: 'error',
    triggers: ['save'],
    reads: ['countries'],
    message: 'Choose at least one country or region.',
    appliesTo: (a, ctx) => creating(ctx) && (a.type === 'LOOKALIKE'),
    check: (a) => ((a.countries ?? []).length === 0 ? { path: 'countries' } : null),
  }),
  aud({
    id: 'AUD-044',
    severity: 'error',
    triggers: [],
    reads: ['name', 'seeds', 'countries'],
    message: null,
    appliesTo: (a) => a.type === 'LOOKALIKE',
    // The Save button is disabled until AUD-001, 040, 041 and 043 pass; the form reads those rules.
    check: () => null,
  }),
  aud({
    id: 'AUD-050',
    severity: 'error',
    triggers: ['save'],
    reads: ['interests', 'urls', 'apps'],
    message: 'Add at least one interest, URL or app.',
    appliesTo: (a, ctx) => creating(ctx) && (a.type === 'CUSTOM_AFFINITY'),
    check: (a) =>
      (a.interests ?? []).length + (a.urls ?? []).length + (a.apps ?? []).length === 0
        ? { path: 'interests' }
        : null,
  }),
  aud({
    id: 'AUD-051',
    severity: 'info',
    triggers: [],
    reads: ['interests', 'urls', 'apps'],
    message: MSG.AUD_FORECAST_NA,
    appliesTo: (a) => isCustom(a.type),
    // Shown in the Impressions Estimator panel while the list has no entries; AUD-050 and AUD-080 block the save.
    check: () => null,
  }),
  aud({
    id: 'AUD-052',
    severity: 'error',
    triggers: ['blur', 'save'],
    reads: ['urls'],
    message: MSG.VALID_URL,
    appliesTo: (a, ctx) => creating(ctx) && (isCustom(a.type)),
    check: (a) =>
      (a.urls ?? []).flatMap((u, i) => (isUrl(u.includes('://') ? u : `https://${u}`) ? [] : [{ path: `urls[${i}]` }])),
  }),
  aud({
    id: 'AUD-060',
    severity: 'info',
    triggers: [],
    reads: ['name'],
    message: MSG.AUD_DELAY,
    check: () => null,
  }),
  aud({
    id: 'AUD-070',
    severity: 'info',
    triggers: [],
    reads: ['name'],
    message: null,
    check: () => null,
  }),
  aud({
    id: 'AUD-080',
    severity: 'error',
    triggers: ['save'],
    reads: ['keywords', 'urls'],
    message: 'Add at least one keyword or URL.',
    appliesTo: (a, ctx) => creating(ctx) && (isIntent(a.type)),
    check: (a) => ((a.keywords ?? []).length + (a.urls ?? []).length === 0 ? { path: 'keywords' } : null),
  }),
  aud({
    id: 'AUD-090',
    severity: 'error',
    triggers: ['save'],
    reads: ['linkedChannels'],
    message: 'Link a YouTube channel before creating this audience.',
    appliesTo: (a, ctx) => creating(ctx) && (a.type === 'YOUTUBE_USERS'),
    check: (a) => ((a.linkedChannels ?? 0) === 0 ? { path: 'linkedAccountId' } : null),
  }),
  aud({
    id: 'AUD-091',
    severity: 'error',
    triggers: [],
    reads: ['name'],
    message: null,
    // New Audience is disabled without write access; the list page reads the viewer's access.
    check: () => null,
  }),
  aud({
    id: 'AUD-100',
    severity: 'warning',
    triggers: ['save'],
    reads: ['targetingLineItems'],
    message: '{n} active line items target this audience.',
    appliesTo: (a) => (a.targetingLineItems ?? 0) > 0,
    check: (a) => ({ path: '*', params: { n: a.targetingLineItems ?? 0 } }),
  }),
  aud({
    id: 'AUD-110',
    severity: 'error',
    triggers: ['save'],
    reads: ['lockedChanges'],
    message: MSG.LOCKED_AFTER_CREATE,
    appliesTo: (a, ctx) => ctx.mode === 'edit',
    check: (a) => (a.lockedChanges ?? []).map((f) => ({ path: f })),
  }),
  aud({
    id: 'AUD-111',
    severity: 'error',
    triggers: ['save'],
    reads: ['includeGroups'],
    message: "An audience can't include itself.",
    appliesTo: (a, ctx) => creating(ctx) && (a.type === 'COMBINED'),
    check: (a) => (a.cyclic ? { path: 'includeGroups' } : null),
  }),
  aud({
    id: 'AUD-112',
    severity: 'warning',
    triggers: ['save'],
    reads: ['includeGroups'],
    message: 'All included audiences are archived.',
    appliesTo: (a, ctx) => creating(ctx) && (a.type === 'COMBINED'),
    check: (a) => (a.allIncludedArchived ? { path: 'includeGroups' } : null),
  }),
  aud({
    id: 'AUD-113',
    severity: 'error',
    triggers: ['save'],
    reads: ['analysisSeedUsers'],
    message: MSG.LOOKALIKE_MIN,
    appliesTo: (a) => a.analysisSeedUsers !== undefined,
    check: (a) => ((a.analysisSeedUsers ?? 0) < 1000 ? { path: 'seedAudienceId' } : null),
  }),
  aud({
    id: 'AUD-114',
    severity: 'error',
    triggers: ['save'],
    reads: ['insightsOptimized'],
    message: 'Select only line items that have Optimized Targeting enabled.',
    appliesTo: (a) => a.insightsOptimized !== undefined,
    check: (a) => (a.insightsOptimized ? null : { path: 'lineItemId' }),
  }),
];
