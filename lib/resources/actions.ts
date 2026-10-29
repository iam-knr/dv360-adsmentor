'use server';

// Server actions of the resource screens (module 15 4). Thin: resolve the session, call the service.
import { getSessionUser } from '@/lib/auth/session';
import type { WireIssue } from '@/lib/campaigns/wire';
import {
  archiveFloodlightConversion,
  createFloodlightConversion,
  updateFloodlightConversion,
  updateFloodlightGroup,
  validateFloodlightConversion,
} from './floodlight';
import {
  createChannel,
  createLocationList,
  createNegativeKeywordList,
  deleteChannel,
  deleteLocationList,
  deleteNegativeKeywordList,
  getChannel,
  getNegativeKeywordList,
  previewLocationEntries,
  updateChannel,
  updateLocationList,
  updateNegativeKeywordList,
  validateChannel,
  validateNegativeKeywordList,
  type DeleteOutcome,
  type ResourceScope,
} from './lists';
import { getBrandControls } from './brand-service';
import {
  deleteCustomBidding,
  getCustomBidding,
  runCustomBiddingTest,
  saveCustomBidding,
  saveCustomBiddingDraft,
  setCustomBiddingStatus,
  validateCustomBidding,
} from './custom-bidding';
import type { Result } from './kit';
import type {
  BrandControlsView,
  CbDeleteOutcome,
  CbDraftInput,
  CbStatusKey,
  CbTestWire,
  CbView,
  OwnerScopeKey,
  ChannelInput,
  ChannelView,
  FloodlightConversionInput,
  FloodlightGroupInput,
  KeywordListInput,
  KeywordListView,
  LocationListInput,
  ParseStats,
  ResolutionRow,
  WriteMeta,
} from './wire';

const NO_SESSION: Result<never> = {
  ok: false,
  code: 'FORBIDDEN',
  issues: [{ path: '*', severity: 'error', code: 'NO_SESSION', message: 'Sign in again.' }],
};

const toWire = (
  issues: { path: string; severity: WireIssue['severity']; ruleId: string; message: string }[],
): WireIssue[] =>
  issues.map((i) => ({ path: i.path, severity: i.severity, code: i.ruleId, message: i.message }));

// Channels -------------------------------------------------------------------------------------

export async function getChannelAction(id: string): Promise<ChannelView | null> {
  const user = await getSessionUser();
  return user ? getChannel(user, id).catch(() => null) : null;
}

export async function validateChannelAction(
  scope: ResourceScope,
  input: ChannelInput,
): Promise<WireIssue[]> {
  const user = await getSessionUser();
  return user ? toWire(await validateChannel(user, scope, input)) : [];
}

export async function createChannelAction(
  scope: ResourceScope,
  input: ChannelInput,
  meta?: WriteMeta,
): Promise<Result<{ id: string; stats: ParseStats }>> {
  const user = await getSessionUser();
  return user ? createChannel(user, scope, input, meta) : NO_SESSION;
}

export async function updateChannelAction(
  id: string,
  input: Partial<ChannelInput>,
  meta?: WriteMeta,
): Promise<Result<{ stats: ParseStats; version: number }>> {
  const user = await getSessionUser();
  return user ? updateChannel(user, id, input, meta) : NO_SESSION;
}

export async function deleteChannelAction(
  id: string,
  confirmed = false,
): Promise<Result<DeleteOutcome>> {
  const user = await getSessionUser();
  return user ? deleteChannel(user, id, confirmed) : NO_SESSION;
}

// Negative keyword lists ---------------------------------------------------------------------------

export async function getKeywordListAction(id: string): Promise<KeywordListView | null> {
  const user = await getSessionUser();
  return user ? getNegativeKeywordList(user, id).catch(() => null) : null;
}

export async function validateKeywordListAction(
  aid: string,
  input: KeywordListInput,
): Promise<WireIssue[]> {
  const user = await getSessionUser();
  return user ? toWire(await validateNegativeKeywordList(user, aid, input)) : [];
}

export async function createKeywordListAction(
  aid: string,
  input: KeywordListInput,
  meta?: WriteMeta,
): Promise<Result<{ id: string; count: number }>> {
  const user = await getSessionUser();
  return user ? createNegativeKeywordList(user, aid, input, meta) : NO_SESSION;
}

export async function updateKeywordListAction(
  id: string,
  input: Partial<KeywordListInput>,
  meta?: WriteMeta,
): Promise<Result<{ count: number; version: number }>> {
  const user = await getSessionUser();
  return user ? updateNegativeKeywordList(user, id, input, meta) : NO_SESSION;
}

export async function deleteKeywordListAction(
  id: string,
  confirmed = false,
): Promise<Result<DeleteOutcome>> {
  const user = await getSessionUser();
  return user ? deleteNegativeKeywordList(user, id, confirmed) : NO_SESSION;
}

// Location lists -------------------------------------------------------------------------------

export async function previewLocationsAction(
  aid: string,
  input: Pick<LocationListInput, 'type' | 'entries'>,
): Promise<ResolutionRow[]> {
  const user = await getSessionUser();
  return user ? previewLocationEntries(user, aid, input) : [];
}

export async function createLocationListAction(
  aid: string,
  input: LocationListInput,
  meta?: WriteMeta,
): Promise<
  Result<{ id: string; resolved: number; unresolved: { line: number; reason: string }[] }>
> {
  const user = await getSessionUser();
  return user ? createLocationList(user, aid, input, meta) : NO_SESSION;
}

export async function updateLocationListAction(
  id: string,
  input: Partial<LocationListInput>,
  meta?: WriteMeta,
): Promise<Result<{ resolved: number; version: number }>> {
  const user = await getSessionUser();
  return user ? updateLocationList(user, id, input, meta) : NO_SESSION;
}

export async function deleteLocationListAction(
  id: string,
  confirmed = false,
): Promise<Result<DeleteOutcome>> {
  const user = await getSessionUser();
  return user ? deleteLocationList(user, id, confirmed) : NO_SESSION;
}

// Floodlight -------------------------------------------------------------------------------------

export async function validateConversionAction(
  aid: string,
  input: FloodlightConversionInput,
): Promise<WireIssue[]> {
  const user = await getSessionUser();
  return user ? validateFloodlightConversion(user, aid, input) : [];
}

export async function createConversionAction(
  aid: string,
  input: FloodlightConversionInput,
  meta?: WriteMeta,
): Promise<Result<{ id: string; publicId: number }>> {
  const user = await getSessionUser();
  return user ? createFloodlightConversion(user, aid, input, meta) : NO_SESSION;
}

export async function updateConversionAction(
  eid: string,
  input: FloodlightConversionInput,
  meta?: WriteMeta,
): Promise<Result<{ version: number }>> {
  const user = await getSessionUser();
  return user ? updateFloodlightConversion(user, eid, input, meta) : NO_SESSION;
}

export async function archiveConversionAction(
  eid: string,
  confirmed = false,
): Promise<Result<{ archived: boolean; usedBy: number }>> {
  const user = await getSessionUser();
  return user ? archiveFloodlightConversion(user, eid, confirmed) : NO_SESSION;
}

export async function updateFloodlightGroupAction(
  aid: string,
  input: FloodlightGroupInput,
  meta?: WriteMeta,
): Promise<Result<{ version: number }>> {
  const user = await getSessionUser();
  return user ? updateFloodlightGroup(user, aid, input, meta) : NO_SESSION;
}

// Brand controls -------------------------------------------------------------------------------

export async function brandControlsAction(
  scope: { level: 'advertiser' | 'partner'; id: string },
  tab: 'display' | 'youtube',
  filter: 'active' | 'all',
): Promise<BrandControlsView | null> {
  const user = await getSessionUser();
  return user ? getBrandControls(user, scope, tab, filter).catch(() => null) : null;
}

// Custom bidding ---------------------------------------------------------------------------------

export async function getCustomBiddingAction(id: string): Promise<CbView | null> {
  const user = await getSessionUser();
  return user ? getCustomBidding(user, id).catch(() => null) : null;
}

export async function validateCustomBiddingAction(
  scope: ResourceScope,
  input: CbDraftInput,
): Promise<WireIssue[]> {
  const user = await getSessionUser();
  return user ? validateCustomBidding(user, scope, input).catch(() => []) : [];
}

export async function saveCustomBiddingDraftAction(
  scope: ResourceScope,
  input: CbDraftInput,
  meta?: WriteMeta,
): Promise<Result<{ id: string; version: number; reset: boolean; changed: boolean }>> {
  const user = await getSessionUser();
  return user ? saveCustomBiddingDraft(user, scope, input, meta) : NO_SESSION;
}

export async function runCustomBiddingTestAction(id: string): Promise<Result<CbTestWire>> {
  const user = await getSessionUser();
  return user ? runCustomBiddingTest(user, id) : NO_SESSION;
}

export async function saveCustomBiddingAction(
  id: string,
  req: { ownerScope: OwnerScopeKey; activate: boolean },
  meta?: WriteMeta,
): Promise<Result<{ id: string; status: CbStatusKey }>> {
  const user = await getSessionUser();
  return user ? saveCustomBidding(user, id, req, meta) : NO_SESSION;
}

export async function setCustomBiddingStatusAction(
  id: string,
  action: 'ACTIVATE' | 'SUSPEND',
): Promise<Result<{ status: CbStatusKey; usedBy: number }>> {
  const user = await getSessionUser();
  return user ? setCustomBiddingStatus(user, id, action) : NO_SESSION;
}

export async function deleteCustomBiddingAction(id: string): Promise<Result<CbDeleteOutcome>> {
  const user = await getSessionUser();
  return user ? deleteCustomBidding(user, id) : NO_SESSION;
}
