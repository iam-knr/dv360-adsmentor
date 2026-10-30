// Troubleshooter data (module 08 5.1): delivery diagnostic rows to the five funnel stages, reason tables, Sankey flows
// and the CSV (5.3). Pure, so the invariants of 5.1 are tested without a database.
import { reasonLabel } from '@/lib/engine/eligibility/reasons';
import type { LiveStatus } from '@/lib/engine/diagnostics/liveStatus';

export type StageKey = 'AVAILABLE' | 'ELIGIBLE' | 'BIDS' | 'RESPONSES' | 'WON';

export interface DiagRow {
  reasonCode: string;
  count: number;
}

export interface ReasonRow {
  code: string;
  label: string;
  count: number;
  /** Share of the stage total, 0..1. */
  pct: number;
  children?: ReasonRow[];
  fixHref?: string;
}

export interface TroubleshooterStage {
  key: StageKey;
  label:
    | 'Total available requests'
    | 'Eligible impressions'
    | 'Bids submitted'
    | 'Bid responses'
    | 'Impressions won';
  total: number;
  filtered?: {
    tableTitle:
      | 'Filtered impressions'
      | 'Filtered eligible impressions'
      | 'Filtered by the auction'
      | 'Externally filtered responses';
    pctOf: 'available' | 'eligible' | 'bids' | 'responses';
    rows: ReasonRow[];
    totalFiltered: number;
  };
}

export interface TroubleshooterBanner {
  code: LiveStatus;
  severity: 'ERROR' | 'WARNING' | 'INFO';
  text: string;
  action?: {
    label: string;
    target:
      | 'details'
      | 'targeting'
      | 'creatives'
      | 'budget'
      | 'pacing'
      | 'bid'
      | 'parent'
      | 'io'
      | 'inventory';
  };
}

export interface TroubleshooterKpis {
  availableRequests: number;
  bidResponses: number;
  impressionsWon: number;
  /** Won / bid responses, 0..1. */
  winRate: number;
}

export interface TroubleshooterBuilt {
  kpis: TroubleshooterKpis;
  stages: TroubleshooterStage[];
  flows: { from: StageKey; to: StageKey | 'FILTERED'; value: number }[];
}

const FIX: Record<string, string> = {
  T: 'targeting',
  C: 'creatives',
  B: 'budget',
  P: 'pacing',
  F: 'frequency',
  A: 'bid',
};

function totals(rows: readonly DiagRow[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.reasonCode, (m.get(r.reasonCode) ?? 0) + r.count);
  return m;
}

/** Group rows whose code starts with `prefix` into one reason with leaf children. */
function group(
  t: Map<string, number>,
  prefix: string,
  code: string,
  label: string,
  parent: number,
): ReasonRow | null {
  const leaves = [...t.entries()]
    .filter(([c, n]) => c.startsWith(prefix) && n > 0)
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  if (leaves.length === 0) return null;
  const count = leaves.reduce((a, [, n]) => a + n, 0);
  return {
    code,
    label,
    count,
    pct: parent > 0 ? count / parent : 0,
    children: leaves.map(([c, n]) => ({
      code: c,
      label: reasonLabel(c),
      count: n,
      pct: parent > 0 ? n / parent : 0,
    })),
    ...(FIX[prefix.charAt(0)] ? { fixHref: `details#${FIX[prefix.charAt(0)]}` } : {}),
  };
}

function leaf(
  t: Map<string, number>,
  code: string,
  label: string,
  parent: number,
): ReasonRow | null {
  const n = t.get(code) ?? 0;
  if (n <= 0) return null;
  return { code, label, count: n, pct: parent > 0 ? n / parent : 0 };
}

const compact = (rows: (ReasonRow | null)[]): ReasonRow[] =>
  rows.filter((r): r is ReasonRow => r !== null);
const sum = (rows: ReasonRow[]): number => rows.reduce((a, r) => a + r.count, 0);

export function buildTroubleshooter(rows: readonly DiagRow[]): TroubleshooterBuilt {
  const t = totals(rows);
  const A = t.get('M.AVAILABLE') ?? 0;
  const E = t.get('M.ELIGIBLE') ?? 0;
  const S = t.get('M.BIDS_SUBMITTED') ?? 0;
  const R = t.get('M.BID_RESPONSES') ?? 0;
  const W = t.get('M.WON') ?? 0;

  const availRows = compact([
    group(t, 'T.', 'T', 'Targeting', A),
    group(t, 'C.', 'C', 'Creative(s)', A),
  ]);
  const eligRows = compact([
    group(t, 'F.', 'F', 'Frequency', E),
    group(t, 'B.', 'B', 'Budget', E),
    group(t, 'P.', 'P', 'Pacing', E),
  ]);
  const own = leaf(t, 'A.LOST_INTERNAL:OWN_LINE_ITEM', 'Your other line items', S);
  const lostInternal = group(t, 'A.LOST_INTERNAL', 'A.LOST_INTERNAL', 'Auction lost (internal)', S);
  if (lostInternal) {
    lostInternal.children = own ? [own] : undefined;
    delete lostInternal.fixHref;
    if (!lostInternal.children) delete lostInternal.children;
  }
  const auctionRows = compact([
    leaf(t, 'A.BELOW_MIN_BID', 'Below the minimum bid', S),
    lostInternal,
  ]);
  const extRows = compact([
    leaf(t, 'E.BID_TOO_LOW', 'Bid too low', R),
    leaf(t, 'E.CREATIVE', 'Creatives', R),
    leaf(t, 'E.OTHER', 'Others', R),
    leaf(t, 'E.LOST_NOT_REPORTED', 'Externally lost (not reported)', R),
  ]);

  const stages: TroubleshooterStage[] = [
    {
      key: 'AVAILABLE',
      label: 'Total available requests',
      total: A,
      filtered: {
        tableTitle: 'Filtered impressions',
        pctOf: 'available',
        rows: availRows,
        totalFiltered: sum(availRows),
      },
    },
    {
      key: 'ELIGIBLE',
      label: 'Eligible impressions',
      total: E,
      filtered: {
        tableTitle: 'Filtered eligible impressions',
        pctOf: 'eligible',
        rows: eligRows,
        totalFiltered: sum(eligRows),
      },
    },
    {
      key: 'BIDS',
      label: 'Bids submitted',
      total: S,
      filtered: {
        tableTitle: 'Filtered by the auction',
        pctOf: 'bids',
        rows: auctionRows,
        totalFiltered: sum(auctionRows),
      },
    },
    {
      key: 'RESPONSES',
      label: 'Bid responses',
      total: R,
      filtered: {
        tableTitle: 'Externally filtered responses',
        pctOf: 'responses',
        rows: extRows,
        totalFiltered: sum(extRows),
      },
    },
    { key: 'WON', label: 'Impressions won', total: W },
  ];

  const order: StageKey[] = ['AVAILABLE', 'ELIGIBLE', 'BIDS', 'RESPONSES', 'WON'];
  const flows: TroubleshooterBuilt['flows'] = [];
  for (let i = 0; i < 4; i++) {
    const from = stages[i] as TroubleshooterStage;
    const next = stages[i + 1] as TroubleshooterStage;
    const to = order[i + 1] as StageKey;
    flows.push({ from: from.key, to, value: next.total });
    const lost = from.filtered?.totalFiltered ?? 0;
    if (lost > 0) flows.push({ from: from.key, to: 'FILTERED', value: lost });
  }

  return {
    kpis: { availableRequests: A, bidResponses: R, impressionsWon: W, winRate: R > 0 ? W / R : 0 },
    stages,
    flows,
  };
}

const csvCell = (v: string | number): string => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
};

/** CSV of 5.3: header, milestone rows, one row per reason and sub-reason. */
export function troubleshooterCsv(
  built: TroubleshooterBuilt,
  meta: { inventory: string; from: string; to: string },
): string {
  const lines = ['Stage,Reason,Sub-reason,Count,Percent of parent,Inventory,Date from,Date to'];
  const tail = [meta.inventory, meta.from, meta.to].map(csvCell).join(',');
  const pct = (p: number) => (p * 100).toFixed(2);
  for (const st of built.stages) {
    lines.push(`${[st.label, st.label, '', st.total, ''].map(csvCell).join(',')},${tail}`);
    for (const r of st.filtered?.rows ?? []) {
      lines.push(`${[st.label, r.label, '', r.count, pct(r.pct)].map(csvCell).join(',')},${tail}`);
      for (const c of r.children ?? [])
        lines.push(
          `${[st.label, r.label, c.label, c.count, pct(c.pct)].map(csvCell).join(',')},${tail}`,
        );
    }
  }
  return `${lines.join('\n')}\n`;
}
