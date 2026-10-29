// Helpers that keep the catalogue short (module 16 4.2 "generators.ts"): money triplets, ratios, fee families.
import type {
  Currency,
  DataType,
  DimSource,
  FieldStatus,
  OfflineType,
  ReportCategory,
  ReportFieldDef,
  SliceKind,
  SourceSpec,
} from './types';

export const slug = (label: string): string =>
  label
    .toLowerCase()
    .replace(/%/g, 'pct ')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

export const CURRENCIES: { cur: Currency; suffix: string; label: string }[] = [
  { cur: 'ADV', suffix: 'adv', label: 'Advertiser Currency' },
  { cur: 'PARTNER', suffix: 'partner', label: 'Partner Currency' },
  { cur: 'USD', suffix: 'usd', label: 'USD' },
];

type Opts = {
  key?: string;
  status?: FieldStatus;
  downloadOnly?: boolean;
  frequentlyUsed?: boolean;
  offline?: OfflineType[];
  offlineOnly?: boolean;
  sensitivity?: 'PARTNER_COST';
  dataType?: DataType;
  compat?: string[];
};

function make(
  category: ReportCategory,
  kind: 'DIMENSION' | 'METRIC',
  label: string,
  dataType: DataType,
  source: SourceSpec | DimSource,
  o: Opts & { currency?: Currency },
): ReportFieldDef {
  const f: ReportFieldDef = {
    key: o.key ?? slug(label),
    label,
    kind,
    category,
    dataType: o.dataType ?? dataType,
    source,
    status: o.status ?? 'LIVE',
  };
  if (o.currency) f.currency = o.currency;
  if (o.downloadOnly) f.downloadOnly = true;
  if (o.frequentlyUsed) f.frequentlyUsed = true;
  if (o.offline) f.offline = o.offline;
  if (o.offlineOnly) f.offlineOnly = true;
  if (o.sensitivity) f.sensitivity = o.sensitivity;
  if (o.compat) f.compat = o.compat;
  return f;
}

// ---- dimensions ------------------------------------------------------------------------------------------------------

export const entityDim = (
  cat: ReportCategory,
  label: string,
  path: string,
  dataType: DataType = 'STRING',
  o: Opts = {},
) => make(cat, 'DIMENSION', label, dataType, { t: 'ENTITY', path }, o);

export const sliceDim = (
  cat: ReportCategory,
  label: string,
  kind: SliceKind,
  part?: string,
  dataType: DataType = 'STRING',
  o: Opts = {},
) =>
  make(
    cat,
    'DIMENSION',
    label,
    dataType,
    part ? { t: 'SLICE', kind, part } : { t: 'SLICE', kind },
    o,
  );

export const derivedDim = (
  cat: ReportCategory,
  label: string,
  parent: SliceKind,
  allocation: string,
  dataType: DataType = 'STRING',
  o: Opts = {},
) => make(cat, 'DIMENSION', label, dataType, { t: 'DERIVED', parent, allocation }, o);

/** A dimension the simulator does not model: the column exists and prints " - " (status ZERO). */
export const zeroDim = (cat: ReportCategory, label: string, o: Opts = {}) =>
  make(cat, 'DIMENSION', label, 'STRING', { t: 'CONST', value: '' }, { ...o, status: 'ZERO' });

export const calendarDim = (
  cat: ReportCategory,
  label: string,
  part: 'dayOfWeek' | 'week' | 'month' | 'monthYear' | 'quarter' | 'year',
  o: Opts = {},
) => make(cat, 'DIMENSION', label, 'STRING', { t: 'CALENDAR', part }, o);

// ---- metrics ---------------------------------------------------------------------------------------------------------

export const counter = (cat: ReportCategory, label: string, col: string, o: Opts = {}) =>
  make(cat, 'METRIC', label, 'INT', { t: 'COUNTER', col }, o);

export const decimalCounter = (cat: ReportCategory, label: string, col: string, o: Opts = {}) =>
  make(cat, 'METRIC', label, 'DECIMAL', { t: 'COUNTER', col }, o);

export const zeroMetric = (
  cat: ReportCategory,
  label: string,
  dataType: DataType = 'INT',
  o: Opts = {},
) => make(cat, 'METRIC', label, dataType, { t: 'CONST', value: 0 }, { ...o, status: 'ZERO' });

export const ratio = (
  cat: ReportCategory,
  label: string,
  num: string,
  den: string,
  scale: 1 | 100 | 1000 = 1,
  o: Opts = {},
) =>
  make(
    cat,
    'METRIC',
    label,
    scale === 100 ? 'PERCENT' : 'DECIMAL',
    { t: 'RATIO', num, den, scale },
    o,
  );

export const sumOf = (cat: ReportCategory, label: string, of: string[], o: Opts = {}) =>
  make(cat, 'METRIC', label, 'INT', { t: 'SUM_OF', of }, o);

export const snapshot = (
  cat: ReportCategory,
  label: string,
  scope: 'LI' | 'IO' | 'SEGMENT',
  col: string,
  dataType: DataType,
  o: Opts = {},
) => make(cat, 'METRIC', label, dataType, { t: 'SNAPSHOT', scope, col }, o);

export const reach = (
  cat: ReportCategory,
  label: string,
  col: 'impressionReach' | 'avgFrequency' | 'viewableReach' | 'clickReach' | 'coViewedReach',
  o: Opts & { factor?: number } = {},
) => {
  const { factor, ...rest } = o;
  return make(
    cat,
    'METRIC',
    label,
    col === 'avgFrequency' ? 'DECIMAL' : 'INT',
    factor === undefined ? { t: 'REACH', col } : { t: 'REACH', col, factor },
    rest,
  );
};

type MoneyBuild = (cur: Currency, suffix: string) => SourceSpec;

/**
 * One money metric written once, emitted three times: "{label} (Advertiser Currency)", "(Partner Currency)", "(USD)".
 * Keys end in _adv, _partner, _usd. Partner-currency variants are PARTNER_COST (hidden from PARTNER_CLIENT).
 */
export function currencyTriplet(
  cat: ReportCategory,
  label: string,
  build: MoneyBuild,
  o: Opts = {},
): ReportFieldDef[] {
  const base = o.key ?? slug(label);
  return CURRENCIES.map(({ cur, suffix, label: cl }) => {
    const partnerCost = cur === 'PARTNER' || o.sensitivity === 'PARTNER_COST';
    const oo: Opts & { currency: Currency } = {
      ...o,
      key: `${base}_${suffix}`,
      currency: cur,
      dataType: 'MONEY',
    };
    if (partnerCost) oo.sensitivity = 'PARTNER_COST';
    if (cur !== 'ADV') delete oo.frequentlyUsed;
    return make(cat, 'METRIC', `${label} (${cl})`, 'MONEY', build(cur, suffix), oo);
  });
}

/** Money counter: sum of `col` converted at read time. */
export const moneyCounter = (
  cat: ReportCategory,
  label: string,
  col: string,
  o: Opts = {},
): ReportFieldDef[] =>
  currencyTriplet(cat, label, (currency) => ({ t: 'COUNTER_FX', col, currency }), o);

/** Money zero stub (column exists, always 0). */
export const moneyZero = (cat: ReportCategory, label: string, o: Opts = {}): ReportFieldDef[] =>
  currencyTriplet(cat, label, () => ({ t: 'CONST', value: 0 }), { ...o, status: 'ZERO' });

/** Money ratio over a base money family (`baseKey` without suffix) and a count field key. */
export const moneyRatio = (
  cat: ReportCategory,
  label: string,
  baseKey: string,
  denKey: string,
  scale: 1 | 100 | 1000,
  o: Opts = {},
): ReportFieldDef[] =>
  currencyTriplet(
    cat,
    label,
    (_c, suffix) => ({ t: 'RATIO', num: `${baseKey}_${suffix}`, den: denKey, scale }),
    o,
  );

/** The five video quartile positions. */
export const QUARTILES = [
  'Start',
  'First Quartile',
  'Midpoint',
  'Third Quartile',
  'Completion',
] as const;

export function onlyOne<T>(xs: T[], what: string): T {
  if (xs.length !== 1) throw new Error(`expected exactly one ${what}`);
  return xs[0] as T;
}
