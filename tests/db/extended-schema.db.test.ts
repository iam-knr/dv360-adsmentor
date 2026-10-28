// P3-05c. Static checks on prisma/schema/70..89 and migration 0002_extended against the data-model document.
// They read files only; they sit in tests/db because the db project owns everything about migrations.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { renderExtendedRlsSql, extendedSchemaText } from '../../prisma/sql/extended-rls';
import { parseEnums, parseModels, readCoreSchemaText, tenantModels } from '@/lib/db/schema-info';

const doc = readFileSync('docs/specs/data-model.md', 'utf8');
const migration = readFileSync('prisma/migrations/0002_extended/migration.sql', 'utf8');

const coreText = readCoreSchemaText();
const extText = extendedSchemaText();
const coreModels = new Set(parseModels(coreText).map((m) => m.name));
const extModels = parseModels(extText);
const extNames = new Set(extModels.map((m) => m.name));
const allModels = new Set([...coreModels, ...extNames]);
const enums = parseEnums(`${coreText}\n${extText}`);

/** Appendix C entry (as written in the document) -> the models that implement it. */
const APPENDIX_C: Record<string, string[]> = {
  SeedTemplate: ['SeedTemplate'],
  'Role/Permission/RolePermission': ['Role', 'Permission', 'RolePermission'],
  'Scenario family': [
    'Scenario',
    'ScenarioStep',
    'ScenarioSeedPatch',
    'ScenarioAttempt',
    'ScenarioCheckResult',
    'ScenarioEvent',
    'ScenarioAssignment',
  ],
  'Notification family': ['Notification', 'NotificationDismissal'],
  PartnerContact: ['PartnerContact'],
  PartnerFeatureFlag: ['PartnerFeatureFlag'],
  PartnerFeatureAdvertiser: ['PartnerFeatureAdvertiser'],
  BillingProfile: ['BillingProfile'],
  Invoice: ['Invoice'],
  InvoiceLine: ['InvoiceLine'],
  ThirdPartyRateCard: ['ThirdPartyRateCard'],
  AdvertiserAlertPreference: ['AdvertiserAlertPreference'],
  LinkedAccount: ['LinkedAccount'],
  PolicyCertificate: ['PolicyCertificate'],
  LineItemFloodlightActivity: ['LineItemFloodlightActivity'],
  'CreativeReview-adjacent tables (CreativeRestriction, CreativeUrl, CreativeAppeal)': [
    'CreativeRestriction',
    'CreativeUrl',
    'CreativeAppeal',
  ],
  'Audience detail tables': [
    'AudienceTagRule',
    'AudienceSeed',
    'CombinedAudienceTerm',
    'CustomListEntry',
    'CustomerMatchUpload',
  ],
  GoogleAudience: ['GoogleAudience'],
  'Channel family': ['Channel', 'ChannelEntry'],
  'KeywordList family': ['KeywordList', 'KeywordListEntry'],
  'LocationList family': ['LocationList', 'LocationListEntry'],
  'inventory family (InventoryOrder, InventorySourceDeal, DealAccess, InventoryPackage, DealGroup, DealGroupMember, LineItemInventory, Negotiation, NegotiationMessage, MarketplaceProduct)':
    [
      'InventoryOrder',
      'InventorySourceDeal',
      'DealAccess',
      'InventoryPackage',
      'DealGroup',
      'DealGroupMember',
      'LineItemInventory',
      'Negotiation',
      'NegotiationMessage',
      'MarketplaceProduct',
    ],
  'Floodlight family': [
    'FloodlightGroup',
    'FloodlightActivity',
    'FloodlightVariable',
    'FloodlightAttributionModel',
    'ConversionGroup',
    'ConversionGroupActivity',
  ],
  'Custom bidding family': [
    'CustomBiddingAlgorithm',
    'CustomBiddingRule',
    'CustomBiddingMultiplier',
    'CustomBiddingMultiplierValue',
    'CustomBiddingTestRun',
    'CustomBiddingScript',
  ],
  'Reporting family': [
    'ReportField',
    'ReportTemplate',
    'Report',
    'ReportRun',
    'ReportShare',
    'CrossMediaReachReport',
  ],
  'Plan family': ['Plan', 'PlanRow', 'PlanForecast'],
  'Experiment and Lift family': [
    'Experiment',
    'ExperimentArm',
    'ExperimentArmEntity',
    'ExperimentResult',
    'LiftStudy',
    'LiftStudyEntity',
    'LiftFlight',
    'LiftSearchTermGroup',
    'LiftResult',
  ],
  'BulkJob family': ['BulkJob', 'BulkJobItem'],
  SimConversionDaily: ['SimConversionDaily'],
  SimReachSnapshot: ['SimReachSnapshot'],
  SimPacingSnapshot: ['SimPacingSnapshot'],
  SimTickLog: ['SimTickLog'],
  Recommendation: ['Recommendation'],
  HistoryNote: ['HistoryNote'],
  SavedView: ['SavedView'],
  ChartCard: ['ChartCard'],
  FxRate: ['FxRate'],
  'Workspace/PinnedItem/RecentlyViewed': ['Workspace', 'PinnedItem', 'RecentlyViewed'],
};

/** Tables from the module deltas that have no Appendix C entry of their own. */
const DELTA_TABLES = [
  'WorkspaceShare',
  'UserPreference',
  'UserEmailPreference',
  'AdvisorSession',
  'AdvisorMessage',
  'HelpArticle',
  'ThirdPartyVendor',
  'AdvertiserVendorSelection',
  'PlanCountry',
  'TvCampaign',
  'SubLocation',
  'YoutubeVideo',
  'YoutubeAsset',
  'AdSequenceStep',
  'AppCatalog',
  'InboxMessage',
  'Upload',
  'InstructorNote',
  'SandboxSnapshot',
];

function appendixCEntries(): string[] {
  const body = /## Appendix C\.[\s\S]*$/.exec(doc)?.[0] ?? '';
  const para = body.split('\n').find((l) => l.includes('SeedTemplate, Role/Permission')) ?? '';
  const list = para.slice(para.indexOf('SeedTemplate')).replace(/\.\s*$/, '');
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of list) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

describe('Appendix C tables', () => {
  const entries = appendixCEntries();

  it('parses the Appendix C list', () => {
    expect(entries.length).toBe(Object.keys(APPENDIX_C).length);
    expect(entries.length).toBeGreaterThan(35);
  });

  it('maps every Appendix C entry to models', () => {
    expect(entries.filter((e) => !(e in APPENDIX_C))).toEqual([]);
  });

  it('has a Prisma model for every Appendix C table', () => {
    const missing = Object.values(APPENDIX_C)
      .flat()
      .filter((n) => !allModels.has(n));
    expect(missing).toEqual([]);
  });

  it('has a Prisma model for every table named by a module delta', () => {
    expect(DELTA_TABLES.filter((n) => !extNames.has(n))).toEqual([]);
  });

  it('defines no model twice and none that 05a already owns', () => {
    const names = extModels.map((m) => m.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names.filter((n) => coreModels.has(n))).toEqual([]);
  });
});

/** Section 4 rows that the schema keeps as something other than a Prisma enum, each with the reason. */
const NOT_AN_ENUM: Record<string, string> = {
  CampaignKpiRecommendation: 'static table, not a DB enum (document says so)',
  DealStatus: 'uses EntityStatus (document says so)',
  DiagFunnelStage: 'UI constant (RC-021)',
  DiagFunnelReason: 'UI constant (RC-021)',
  'AccessRole` etc.': 'not an enum row; AppRole and DvRole are checked by name',
  'DeviceType` / `Environment': 'two names in one row; both exist as enums',
};

/** Values the document lists that the schema stores differently, with the rule that decided it. */
const VALUE_EXCEPTIONS: Record<string, string[]> = {
  // none yet
};

function section4Rows(): { names: string[]; cell: string }[] {
  const start = doc.indexOf('## 4. Enumerations');
  const end = doc.indexOf('## 5. Entities');
  const rows: { names: string[]; cell: string }[] = [];
  for (const line of doc.slice(start, end).split('\n')) {
    const m = /^\|\s*`([^|]+?)`(?:\s*\(([^)]*)\))?\s*\|(.*)\|\s*$/.exec(line);
    if (!m) continue;
    const name = m[1] as string;
    if (!/^[A-Z][A-Za-z0-9]*[a-z][A-Za-z0-9]*$/.test(name) && !(name in NOT_AN_ENUM)) continue; // matrix rows, not enum rows
    rows.push({ names: [name], cell: m[3] as string });
  }
  return rows;
}

describe('data-model section 4 enums', () => {
  const rows = section4Rows();

  it('parses the enum tables', () => {
    expect(rows.length).toBeGreaterThan(100);
  });

  it('has an enum for every documented one, except the listed UI constants', () => {
    const missing = rows
      .map((r) => r.names[0] as string)
      .filter((n) => !enums.has(n) && !(n in NOT_AN_ENUM));
    expect(missing).toEqual([]);
  });

  it('keeps every documented value', () => {
    const gone: Record<string, string[]> = {};
    let checked = 0;
    for (const r of rows) {
      const name = r.names[0] as string;
      const have = enums.get(name);
      if (!have) continue;
      // values are the backticked ALL_CAPS words at the start of the cell or after a comma or semicolon
      const wanted = [...r.cell.matchAll(/(?:^|[,;(:])\s*`([A-Z][A-Z0-9_]*)`/g)].map(
        (x) => x[1] as string,
      );
      checked += wanted.length;
      const missing = wanted.filter(
        (v) => !have.includes(v) && !VALUE_EXCEPTIONS[name]?.includes(v),
      );
      if (missing.length) gone[name] = [...new Set(missing)];
    }
    expect(checked).toBeGreaterThan(400); // the parser really reads the value cells
    expect(gone).toEqual({});
  });
});

describe('migration 0002_extended', () => {
  it('is additive: only new types, tables, indexes and constraints', () => {
    const forbidden = [
      /DROP\s+/i,
      /\bTRUNCATE\b/i,
      /DELETE\s+FROM/i,
      /UPDATE\s+"/i,
      /ALTER\s+TYPE/i,
      /ALTER\s+TABLE\s+"\w+"\s+(DROP|ALTER|RENAME|ADD COLUMN)/i,
      /RENAME\s+/i,
    ];
    for (const re of forbidden) expect(migration, String(re)).not.toMatch(re);
  });

  it('only alters its own tables', () => {
    const own = new Set(extNames);
    const touched = [...migration.matchAll(/ALTER TABLE "(\w+)"/g)].map((m) => m[1] as string);
    expect(touched.filter((t) => !own.has(t))).toEqual([]);
  });

  it('creates exactly the models of prisma/schema/70..89', () => {
    const created = [...migration.matchAll(/CREATE TABLE "(\w+)"/g)].map((m) => m[1]).sort();
    expect(created).toEqual([...extNames].sort());
  });

  it('creates exactly the enums that prisma/schema/70..89 defines', () => {
    const created = [...migration.matchAll(/CREATE TYPE "(\w+)"/g)].map((m) => m[1]).sort();
    const defined = [...parseEnums(extText).keys()].sort();
    expect(created).toEqual(defined);
  });

  it('contains every prisma/sql file of this session verbatim', () => {
    for (const f of [
      '70-extended-constraints.sql',
      '80-extended-rls.sql',
      '90-extended-grants.sql',
    ]) {
      expect(migration, f).toContain(readFileSync(`prisma/sql/${f}`, 'utf8'));
    }
  });

  it('puts every new tenant table under RLS (80-extended-rls.sql is current)', () => {
    expect(readFileSync('prisma/sql/80-extended-rls.sql', 'utf8')).toBe(renderExtendedRlsSql());
  });

  it('inserts no rows and contains no secrets', () => {
    expect(migration).not.toMatch(/INSERT\s+INTO/i);
    expect(migration).not.toMatch(/password\s*=|secret|@gmail\.|@adsmentor\./i);
  });

  it('adds sandboxId to every non-global new table', () => {
    const tenant = new Set(tenantModels(extModels).map((m) => m.name));
    expect(tenant.size).toBeGreaterThan(70);
  });
});
