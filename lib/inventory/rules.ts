// INV rules (validation.md 2.20 and module 13 4.5, INV-030..042 per RC-053). Pure: each function takes the values
// and returns Issues in the shape of lib/validation (ruleId, severity, path, message, blocking).
import { MSG } from '@/lib/validation/messages';
import type { Issue, Severity } from '@/lib/validation/types';
import { INV_MSG, packageCantAssign } from './messages';
import { formatFitsLineItem, LINE_ITEM_TYPE_LABEL } from './format-compat';
import type { InventoryFormat, LineItemType } from '@prisma/client';

function issue(ruleId: string, path: string, message: string, severity: Severity = 'error'): Issue {
  return { ruleId, severity, path, message, blocking: severity === 'error' };
}

export interface InstantDealInput {
  sellerId: string | null;
  name: string;
  /** Dimension → chosen values. A dimension left on "All values" is absent or empty. */
  targeting: Record<string, string[]>;
  advertiserIds: string[];
  /** A forecast was requested for this exact payload. */
  forecastToken: string | null;
  /** Seller is YouTube and the advertiser has not accepted the YouTube guaranteed instant deals terms. */
  youtubeTermsMissing?: boolean;
}

export function instantDealIssues(v: InstantDealInput): Issue[] {
  const out: Issue[] = [];
  if (!v.sellerId) out.push(issue('INV-001', 'sellerId', MSG.SELECTION_REQUIRED));
  const name = v.name.trim();
  if (!name) out.push(issue('INV-002', 'name', MSG.ENTER_VALUE));
  else if ([...name].length > 200) out.push(issue('INV-002', 'name', INV_MSG.NAME_TOO_LONG));
  const settings = Object.values(v.targeting).filter((vals) => vals.length > 0).length;
  if (settings === 0) out.push(issue('INV-004', 'targeting', MSG.INV_MIN_TARGETING));
  if (v.advertiserIds.length === 0)
    out.push(issue('INV-005', 'advertiserIds', INV_MSG.SELECT_ADVERTISER));
  if (!v.forecastToken) out.push(issue('INV-006', 'forecast', INV_MSG.FORECAST_FIRST));
  if (v.youtubeTermsMissing) out.push(issue('INV-007', 'sellerId', INV_MSG.YT_TERMS));
  return out;
}

export function dealDatesIssues(startAt: Date, endAt: Date): Issue[] {
  return endAt.getTime() < startAt.getTime() ? [issue('INV-020', 'endAt', INV_MSG.DATES)] : [];
}

export function dealGroupIssues(v: {
  name: string;
  type: string | null;
  memberCount: number;
}): Issue[] {
  const out: Issue[] = [];
  if (!v.name.trim()) out.push(issue('INV-015', 'name', MSG.ENTER_VALUE));
  if (v.type !== 'DEAL_GROUP' && v.type !== 'PREFERRED_DEAL_GROUP')
    out.push(issue('INV-042', 'type', MSG.SELECTION_REQUIRED));
  if (v.memberCount === 0) out.push(issue('INV-016', 'members', INV_MSG.GROUP_EMPTY, 'warning'));
  return out;
}

export function importNegotiationIssues(v: {
  rfpId: string;
  found: boolean;
  alreadyImported: boolean;
}): Issue[] {
  if (!v.rfpId.trim()) return [issue('INV-018', 'rfpId', MSG.ENTER_VALUE)];
  if (!v.found) return [issue('INV-018', 'rfpId', INV_MSG.RFP_UNKNOWN)];
  if (v.alreadyImported) return [issue('INV-032', 'rfpId', INV_MSG.RFP_IMPORTED)];
  return [];
}

export function counterIssues(v: {
  rate: number | null;
  volume: number | null | undefined;
  round: number;
  maxRounds: number;
}): Issue[] {
  if (v.round >= v.maxRounds) return [issue('INV-034', 'rate', INV_MSG.FINAL_OFFER)];
  const out: Issue[] = [];
  if (v.rate === null || !Number.isFinite(v.rate) || v.rate <= 0)
    out.push(issue('INV-030', 'rate', INV_MSG.ENTER_POSITIVE));
  if (v.volume !== undefined && v.volume !== null && (!Number.isInteger(v.volume) || v.volume < 1))
    out.push(issue('INV-031', 'volume', INV_MSG.ENTER_POSITIVE));
  return out;
}

export function acceptNegotiationIssues(v: {
  status: string;
  awaiting: string;
  resultingDealId: string | null;
}): Issue[] {
  const open = v.status === 'PROPOSED' || v.status === 'COUNTERED';
  return open && v.awaiting === 'BUYER' && !v.resultingDealId
    ? []
    : [issue('INV-033', 'status', INV_MSG.CANT_ACCEPT)];
}

export function assignIssues(v: {
  lineItemCount: number;
  advertiserCount: number;
  alreadyAssigned: boolean;
}): Issue[] {
  if (v.lineItemCount === 0 && v.advertiserCount === 0)
    return [issue('INV-040', 'target', MSG.SELECTION_REQUIRED)];
  if (v.alreadyAssigned) return [issue('INV-041', 'target', INV_MSG.ALREADY_ASSIGNED, 'warning')];
  return [];
}

/** INV-017: a package format against one target line item type. */
export function formatIssue(format: InventoryFormat, type: LineItemType): Issue[] {
  return formatFitsLineItem(format, type)
    ? []
    : [issue('INV-017', 'lineItem', packageCantAssign(LINE_ITEM_TYPE_LABEL[type]))];
}

/** INV-019: a non-guaranteed deal and a line item bid below the deal rate. */
export function bidBelowRateIssues(dealRate: number, bid: number | null): Issue[] {
  return bid !== null && bid < dealRate
    ? [issue('INV-019', 'bid', INV_MSG.BID_BELOW_RATE, 'warning')]
    : [];
}

/** INV-012: a guaranteed deal with no line item sits in Action required. */
export function pgUnassignedIssues(commitment: string, assignedLineItems: number): Issue[] {
  return commitment === 'GUARANTEED' && assignedLineItems === 0
    ? [issue('INV-012', 'deal', INV_MSG.NOT_ASSIGNED, 'warning')]
    : [];
}

/** INV-011: PG Direct is locked once the deal has started. */
export function pgDirectLockedIssues(
  startAt: Date,
  simNow: Date,
  changed: boolean,
): Issue[] {
  return changed && startAt.getTime() <= simNow.getTime()
    ? [issue('INV-011', 'pgDirect', INV_MSG.PG_DIRECT_LOCKED)]
    : [];
}
