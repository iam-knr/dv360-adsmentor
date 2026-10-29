'use server';

// Server actions of the audience screens (module 14 4). Thin: resolve the session, call the service.
import { getSessionUser } from '@/lib/auth/session';
import type { WireIssue } from '@/lib/campaigns/wire';
import type { Result } from '@/lib/resources/kit';
import {
  addCustomerMatchData,
  analyzeGeoDistribution,
  archiveAudience,
  bulkAudienceAction,
  browseGoogleAudiences,
  createAudience,
  estimateAudience,
  getAudienceInsights,
  getAudienceLookups,
  listAudiences,
  listInsightLineItems,
  searchAudiencePicker,
  updateAudience,
  validateAudienceDraft,
  type ArchiveOutcome,
  type AudienceChanges,
  type AudienceListQuery,
  type PickerQuery,
} from './service';
import type {
  AudienceInput,
  AudienceInsights,
  AudienceListResult,
  AudienceLookups,
  AudienceStatusKey,
  CombinedDraft,
  GeoDistribution,
  PickerRow,
  SizeCell,
  WriteMeta,
} from './wire';

const NO_SESSION: Result<never> = {
  ok: false,
  code: 'FORBIDDEN',
  issues: [{ path: '*', severity: 'error', code: 'NO_SESSION', message: 'Sign in again.' }],
};

export async function listAudiencesAction(aid: string, q: AudienceListQuery): Promise<AudienceListResult> {
  const user = await getSessionUser();
  return user ? listAudiences(user, aid, q) : { rows: [], total: 0 };
}

export async function getLookupsAction(aid: string): Promise<AudienceLookups | null> {
  const user = await getSessionUser();
  return user ? getAudienceLookups(user, aid).catch(() => null) : null;
}

export async function validateAudienceAction(aid: string, input: AudienceInput): Promise<WireIssue[]> {
  const user = await getSessionUser();
  if (!user) return [];
  const issues = await validateAudienceDraft(user, aid, input).catch(() => []);
  return issues.map((i) => ({ path: i.path, severity: i.severity, code: i.ruleId, message: i.message }));
}

export async function createAudienceAction(
  aid: string,
  input: AudienceInput,
  meta?: WriteMeta,
): Promise<
  Result<{
    id: string;
    availableAt: string | null;
    status: AudienceStatusKey;
    match?: { rows: number; matched: number; matchRatePct: number };
  }>
> {
  const user = await getSessionUser();
  return user ? createAudience(user, aid, input, meta) : NO_SESSION;
}

export async function updateAudienceAction(
  id: string,
  changes: AudienceChanges,
  meta?: WriteMeta,
): Promise<Result<{ version: number }>> {
  const user = await getSessionUser();
  return user ? updateAudience(user, id, changes, meta) : NO_SESSION;
}

export async function archiveAudienceAction(id: string, confirmed: boolean): Promise<Result<ArchiveOutcome>> {
  const user = await getSessionUser();
  return user ? archiveAudience(user, id, confirmed) : NO_SESSION;
}

export async function bulkAudienceActionAction(req: {
  ids: string[];
  action: 'ARCHIVE' | 'UNARCHIVE';
}): Promise<Result<{ done: number; failed: number }>> {
  const user = await getSessionUser();
  return user ? bulkAudienceAction(user, req) : NO_SESSION;
}

export async function addCustomerMatchDataAction(
  id: string,
  input: Parameters<typeof addCustomerMatchData>[2],
): Promise<Result<{ rows: number; matched: number; matchRatePct: number }>> {
  const user = await getSessionUser();
  return user ? addCustomerMatchData(user, id, input) : NO_SESSION;
}

export async function searchPickerAction(aid: string, q: PickerQuery): Promise<PickerRow[]> {
  const user = await getSessionUser();
  return user ? searchAudiencePicker(user, aid, q).catch(() => []) : [];
}

export async function browseGoogleAction(q: { kind?: string; q?: string; path?: string[] }): Promise<PickerRow[]> {
  const user = await getSessionUser();
  return user ? browseGoogleAudiences(q) : [];
}

export async function estimateAudienceAction(
  aid: string,
  draft: Parameters<typeof estimateAudience>[2],
): Promise<
  { sizes: Record<'display' | 'youtube' | 'mobileApp' | 'ctv', SizeCell>; expression?: string } | { unavailable: true }
> {
  const user = await getSessionUser();
  return user ? estimateAudience(user, aid, draft).catch(() => ({ unavailable: true as const })) : { unavailable: true };
}

export async function analyzeGeoAction(aid: string, seedId: string): Promise<Result<GeoDistribution>> {
  const user = await getSessionUser();
  return user ? analyzeGeoDistribution(user, aid, seedId) : NO_SESSION;
}

export async function listInsightLineItemsAction(aid: string) {
  const user = await getSessionUser();
  return user ? listInsightLineItems(user, aid).catch(() => []) : [];
}

export async function getInsightsAction(aid: string, liId: string): Promise<Result<AudienceInsights>> {
  const user = await getSessionUser();
  return user ? getAudienceInsights(user, aid, liId) : NO_SESSION;
}

export type { CombinedDraft };
