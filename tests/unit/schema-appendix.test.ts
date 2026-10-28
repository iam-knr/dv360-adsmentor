// DONE WHEN (build-plan 4.3): the schema has a model or enum for every entry of data-model Appendix A,
// checked by a test that parses the document. Differences are listed here, each with the rule that caused it.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseEnums, parseModels, readSchemaText } from '@/lib/db/schema-info';

const doc = readFileSync('docs/specs/data-model.md', 'utf8');
const appendix = /## Appendix A[\s\S]*?```prisma\n([\s\S]*?)\n```/.exec(doc)?.[1] ?? '';
const docModels = parseModels(appendix);
const docEnums = parseEnums(appendix);
const schemaText = readSchemaText();
const models = new Map(parseModels(schemaText).map((m) => [m.name, m]));
const enums = parseEnums(schemaText);

// Appendix A columns that the schema renames or drops on purpose.
const FIELD_CHANGES: Record<string, string[]> = {
  SimClock: [
    'simNow',
    'epochStart',
    'realSecondsPerSimDay',
    'paused',
    'lastTickRealAt',
    'tickCount',
  ], // RC-028, ENG 1.2
  CampaignBudget: ['unit'], // module 06 delta 06-2: Campaign.budgetUnit
  SimHourlyMetric: [
    'sliceKey',
    'exchangeId',
    'deviceType',
    'environment',
    'regionCode',
    'creativeId',
    'dealId', // RC-022: totals only
    'videoQ2',
    'trueViewViews',
    'postClickConversions',
    'postViewConversions',
    'conversionValue',
    'customValue',
    'feeCost', // RC-023
  ],
  SimDailyMetric: [
    'videoQ2',
    'trueViewViews',
    'postClickConversions',
    'postViewConversions',
    'conversionValue',
    'customValue',
    'feeCost',
  ], // RC-023
  DeliveryDiagnostic: ['simHour', 'inventoryKey', 'reason', 'dimension'], // RC-021: ENG 3.5 shape
};
const ENUM_VALUE_CHANGES: Record<string, string[]> = {
  DiagStage: [
    'TOTAL_AVAILABLE_REQUESTS',
    'FILTERED_IMPRESSIONS',
    'ELIGIBLE_IMPRESSIONS',
    'FILTERED_ELIGIBLE_IMPRESSIONS',
    'BIDS_SUBMITTED',
    'FILTERED_BY_AUCTION',
    'BID_RESPONSES',
    'EXTERNALLY_FILTERED_RESPONSES',
    'IMPRESSIONS_WON',
  ], // RC-021: stored stages are the ENG 3.5 list; the DM names are UI constants
};
const DROPPED_ENUMS = ['DiagReason']; // RC-021
const ADDED_MODELS = ['AppMeta', 'AuditLog']; // P3-01 base table; module 18 delta 18-10 with module 19 delta 19-5
const ADDED_ENUMS = [
  'SeedMode',
  'CatchUp',
  'AccessWindowClosedBy',
  'SandboxKind',
  'ProvisionState',
  'FrozenReason',
  'SimClockState',
  'AuditResult',
];

describe('data-model Appendix A is in the schema', () => {
  it('parses the appendix', () => {
    expect(docModels.length).toBe(35);
    expect(docEnums.size).toBe(67);
  });

  it('has a model for every Appendix A model', () => {
    expect(docModels.filter((m) => !models.has(m.name)).map((m) => m.name)).toEqual([]);
  });

  it('has an enum for every Appendix A enum, except the ones RC-021 turned into UI constants', () => {
    const missing = [...docEnums.keys()].filter((e) => !enums.has(e));
    expect(missing.sort()).toEqual([...DROPPED_ENUMS].sort());
  });

  it('keeps every Appendix A column except the documented changes', () => {
    const missing: Record<string, string[]> = {};
    for (const dm of docModels) {
      const have = new Set(models.get(dm.name)?.fields.map((f) => f.name));
      const gone = dm.fields.map((f) => f.name).filter((n) => !have.has(n));
      if (gone.length) missing[dm.name] = gone;
    }
    expect(missing).toEqual(FIELD_CHANGES);
  });

  it('keeps every Appendix A enum value except the documented changes', () => {
    const missing: Record<string, string[]> = {};
    for (const [name, values] of docEnums) {
      const have = enums.get(name);
      if (!have) continue;
      const gone = values.filter((v) => !have.includes(v));
      if (gone.length) missing[name] = gone;
    }
    expect(missing).toEqual(ENUM_VALUE_CHANGES);
  });

  it('adds only the documented models and enums', () => {
    const docNames = new Set(docModels.map((m) => m.name));
    expect([...models.keys()].filter((n) => !docNames.has(n)).sort()).toEqual(
      [...ADDED_MODELS].sort(),
    );
    expect([...enums.keys()].filter((n) => !docEnums.has(n)).sort()).toEqual(
      [...ADDED_ENUMS].sort(),
    );
  });

  it('applies the conflict-log schema changes', () => {
    const has = (model: string, field: string) =>
      models.get(model)?.fields.some((f) => f.name === field);
    // RC-020: version on every editable entity that exists in the core schema
    for (const m of [
      'Partner',
      'Advertiser',
      'Campaign',
      'InsertionOrder',
      'LineItem',
      'AdGroup',
      'Ad',
      'Creative',
      'Audience',
    ]) {
      expect(has(m, 'version'), `${m}.version`).toBe(true);
    }
    expect(enums.get('LineItemType')).toContain('YT_ON_CTV'); // RC-003
    expect(has('Alert', 'diagnosticCode')).toBe(true); // RC-013
    expect(has('SimDailyMetric', 'sliceKind')).toBe(true); // RC-022
    for (const f of ['reasonCode', 'adGroupId', 'date'])
      expect(has('DeliveryDiagnostic', f)).toBe(true); // RC-021
    for (const f of [
      'state',
      'minutesPerSimDay',
      'remainderMs',
      'runOutsideSession',
      'marketSeed',
    ]) {
      expect(has('SimClock', f), `SimClock.${f}`).toBe(true); // RC-028
    }
    for (const f of ['repeatRule', 'seriesId', 'note']) expect(has('AccessWindow', f)).toBe(true); // RC-016
    expect(enums.get('ChangeSource')).toContain('PARTNER_FANOUT'); // RC-031
    for (const f of ['fanOutFromGroupId', 'schemaVersion', 'isHidden'])
      expect(has('ChangeGroup', f)).toBe(true); // DELTA-05-2
    expect(has('ChangeEntry', 'parentPath')).toBe(true); // DELTA-05-3
  });

  it('has the module 19 account columns', () => {
    const user = models.get('User')!;
    for (const f of [
      'appRole',
      'status',
      'mustChangePassword',
      'failedLoginCount',
      'lockedUntil',
      'sessionVersion',
      'activeSessionId',
      'passwordChangedAt',
      'createdById',
      'ownerAdminId',
      'cohortId',
      'accessStartsAt',
      'accessEndsAt',
      'notes',
      'disabledAt',
      'disabledById',
      'archivedAt',
    ]) {
      expect(
        user.fields.some((x) => x.name === f),
        `User.${f}`,
      ).toBe(true);
    }
    expect(enums.get('AppRole')).toEqual(['USER', 'ADMIN', 'SUPER_ADMIN']);
    expect(
      models.has('AccountPolicy') && models.has('AuthThrottle') && models.has('AuditLog'),
    ).toBe(true);
    expect(enums.get('FrozenReason')).toEqual(['WINDOW', 'ACCOUNT']);
  });
});
