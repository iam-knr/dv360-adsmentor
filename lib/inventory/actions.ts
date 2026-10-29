'use server';

// Server actions of the inventory pages (module 13 4.1). Thin: resolve the session, call the service. Reads that fail
// with a ServiceFailure return a fallback; writes return the service `Result`.
import { getSessionUser } from '@/lib/auth/session';
import { ServiceFailure, type Result } from '@/lib/campaigns/service-kit';
import { assignInventoryToLineItems, listAssignableLineItems } from './assign';
import { bulkDealStatus, createDealGroup, deleteDealGroup, getDealLineItems, listOrdersDeals, removePackage, updateDeal, updateDealGroup, type DealGroupInput, type UpdateDealInput } from './deals';
import { acceptInstantDeal, requestInstantForecast } from './instant';
import { assignMarketplaceItem, bulkAssignMarketplace, discover, getMarketplaceItem } from './marketplace';
import {
  acceptNegotiation,
  counterNegotiation,
  declineNegotiation,
  getNegotiation,
  importNegotiation,
  listNegotiations,
  type NegotiationStatusKey,
} from './negotiations';
import type { DealAction } from './transitions';
import type {
  AssignInventoryItem,
  BulkResponse,
  DiscoverRequest,
  DiscoverResult,
  InstantDealForecastView,
  InstantDealPayload,
  LineItemChoice,
  MarketplaceItem,
  NegotiationRow,
  NegotiationView,
  DealLineItemRow,
  OrdersDeals,
  OrdersDealsQuery,
} from './types';

const NO_SESSION: Result<never> = {
  ok: false,
  code: 'FORBIDDEN',
  issues: [{ path: '*', severity: 'error', code: 'NO_SESSION', message: 'Sign in again.' }],
};

async function soft<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ServiceFailure) return fallback;
    throw e;
  }
}

export async function listOrdersDealsAction(aid: string, q: OrdersDealsQuery): Promise<OrdersDeals | null> {
  const user = await getSessionUser();
  return user ? soft(() => listOrdersDeals(user, aid, q), null) : null;
}

export async function dealLineItemsAction(aid: string, tid: string, pid: string): Promise<DealLineItemRow[]> {
  const user = await getSessionUser();
  return user ? soft(() => getDealLineItems(user, aid, tid, pid), []) : [];
}

export async function bulkDealStatusAction(aid: string, req: { ids: string[]; action: DealAction }): Promise<Result<BulkResponse>> {
  const user = await getSessionUser();
  return user ? bulkDealStatus(user, aid, req) : NO_SESSION;
}

export async function updateDealAction(aid: string, tid: string, input: UpdateDealInput): Promise<Result<{ version: number }>> {
  const user = await getSessionUser();
  return user ? updateDeal(user, aid, tid, input) : NO_SESSION;
}

export async function removePackageAction(aid: string, packageId: string): Promise<Result<void>> {
  const user = await getSessionUser();
  return user ? removePackage(user, aid, packageId) : NO_SESSION;
}

export async function createDealGroupAction(aid: string, input: DealGroupInput): Promise<Result<{ id: string }>> {
  const user = await getSessionUser();
  return user ? createDealGroup(user, aid, input) : NO_SESSION;
}

export async function updateDealGroupAction(aid: string, id: string, input: DealGroupInput): Promise<Result<void>> {
  const user = await getSessionUser();
  return user ? updateDealGroup(user, aid, id, input) : NO_SESSION;
}

export async function deleteDealGroupAction(aid: string, id: string): Promise<Result<void>> {
  const user = await getSessionUser();
  return user ? deleteDealGroup(user, aid, id) : NO_SESSION;
}

export async function requestInstantForecastAction(aid: string, payload: InstantDealPayload): Promise<Result<InstantDealForecastView>> {
  const user = await getSessionUser();
  return user ? requestInstantForecast(user, aid, payload) : NO_SESSION;
}

export async function acceptInstantDealAction(
  aid: string,
  payload: InstantDealPayload & { forecastToken: string | null },
): Promise<Result<{ dealId: string; orderId: string }>> {
  const user = await getSessionUser();
  return user ? acceptInstantDeal(user, aid, payload) : NO_SESSION;
}

export async function discoverAction(aid: string, req: DiscoverRequest): Promise<DiscoverResult | null> {
  const user = await getSessionUser();
  return user ? soft(() => discover(user, aid, req), null) : null;
}

export async function marketplaceItemAction(aid: string, id: string): Promise<MarketplaceItem | null> {
  const user = await getSessionUser();
  return user ? soft(() => getMarketplaceItem(user, aid, id), null) : null;
}

export async function assignMarketplaceItemAction(
  aid: string,
  id: string,
  req: { lineItemIds?: string[]; advertiserIds?: string[] },
): Promise<Result<{ packageId?: string; dealId?: string; assigned: number }>> {
  const user = await getSessionUser();
  return user ? assignMarketplaceItem(user, aid, id, req) : NO_SESSION;
}

export async function bulkAssignMarketplaceAction(
  aid: string,
  req: { productIds: string[]; lineItemIds: string[] },
): Promise<Result<BulkResponse>> {
  const user = await getSessionUser();
  return user ? bulkAssignMarketplace(user, aid, req) : NO_SESSION;
}

export async function assignableLineItemsAction(aid: string, format?: 'DISPLAY' | 'VIDEO' | 'AUDIO'): Promise<LineItemChoice[]> {
  const user = await getSessionUser();
  return user ? soft(() => listAssignableLineItems(user, aid, format), []) : [];
}

export async function assignInventoryAction(
  aid: string,
  req: { lineItemIds: string[]; items: AssignInventoryItem[]; replace?: boolean },
): Promise<Result<{ assigned: number; alreadyAssigned: number }>> {
  const user = await getSessionUser();
  return user ? assignInventoryToLineItems(user, aid, req) : NO_SESSION;
}

export async function listNegotiationsAction(
  aid: string,
  q: { status?: NegotiationStatusKey[] },
): Promise<{ rows: NegotiationRow[]; total: number; canWrite: boolean } | null> {
  const user = await getSessionUser();
  return user ? soft(() => listNegotiations(user, aid, q), null) : null;
}

export async function negotiationAction(aid: string, id: string): Promise<NegotiationView | null> {
  const user = await getSessionUser();
  return user ? soft(() => getNegotiation(user, aid, id), null) : null;
}

export async function importNegotiationAction(aid: string, rfpId: string): Promise<Result<{ negotiationId: string }>> {
  const user = await getSessionUser();
  return user ? importNegotiation(user, aid, { rfpId }) : NO_SESSION;
}

export async function counterNegotiationAction(
  aid: string,
  id: string,
  req: { rate: number | null; volume?: number | null; note?: string },
): Promise<Result<void>> {
  const user = await getSessionUser();
  return user ? counterNegotiation(user, aid, id, req) : NO_SESSION;
}

export async function acceptNegotiationAction(aid: string, id: string): Promise<Result<{ dealId: string }>> {
  const user = await getSessionUser();
  return user ? acceptNegotiation(user, aid, id) : NO_SESSION;
}

export async function declineNegotiationAction(aid: string, id: string, note?: string): Promise<Result<void>> {
  const user = await getSessionUser();
  return user ? declineNegotiation(user, aid, id, note ? { note } : {}) : NO_SESSION;
}
