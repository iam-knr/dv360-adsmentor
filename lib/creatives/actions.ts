'use server';

// Server actions of the creative pages (module 12 4.3). Thin: resolve the session, call the service.
import { getSessionUser } from '@/lib/auth/session';
import type { CreativeInput } from '@/lib/validation/types';
import { ServiceFailure, type Result } from '@/lib/campaigns/service-kit';
import type { WireIssue } from '@/lib/campaigns/wire';
import { assignCreativesToLineItems, getEligibleCreatives, type EligibleTab } from './assign';
import { bulkAddCreatives } from './bulk';
import type { BulkCreativeKind } from './bulk-csv';
import { appealCreative } from './review-service';
import {
  activeLineItemUse,
  bulkCreativeAction,
  createCreative,
  getCreativePreview,
  testTag,
  updateCreative,
  validateCreative,
  type CreativePreview,
} from './service';
import type { BulkResponse, CreativeRow, WriteMeta } from './types';

const NO_SESSION: Result<never> = {
  ok: false,
  code: 'FORBIDDEN',
  issues: [{ path: '*', severity: 'error', code: 'NO_SESSION', message: 'Sign in again.' }],
};

/** Reads throw `ServiceFailure`; the client wants a value. */
async function soft<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ServiceFailure) return fallback;
    throw e;
  }
}

export async function createCreativeAction(
  aid: string,
  input: CreativeInput,
  meta?: WriteMeta,
): Promise<Result<{ id: string; publicId: string }>> {
  const user = await getSessionUser();
  return user ? createCreative(user, aid, input, meta) : NO_SESSION;
}

export async function updateCreativeAction(
  aid: string,
  cid: string,
  input: CreativeInput,
  meta?: WriteMeta,
): Promise<Result<{ version: number; reviewRestarted: boolean }>> {
  const user = await getSessionUser();
  return user ? updateCreative(user, aid, cid, input, meta) : NO_SESSION;
}

export async function validateCreativeAction(
  aid: string,
  input: CreativeInput,
  cid?: string,
  trigger: 'save' | 'blur' = 'save',
  changedPath?: string,
): Promise<WireIssue[]> {
  const user = await getSessionUser();
  return user ? soft(() => validateCreative(user, aid, input, cid, trigger, changedPath), []) : [];
}

export async function bulkCreativeStatusAction(
  aid: string,
  req: { ids: string[]; action: 'ACTIVATE' | 'PAUSE' | 'ARCHIVE' | 'UNARCHIVE' },
): Promise<Result<BulkResponse>> {
  const user = await getSessionUser();
  return user ? bulkCreativeAction(user, aid, req) : NO_SESSION;
}

export async function activeLineItemUseAction(aid: string, ids: string[]): Promise<number> {
  const user = await getSessionUser();
  return user ? soft(() => activeLineItemUse(user, aid, ids), 0) : 0;
}

export async function assignCreativesAction(
  aid: string,
  req: { creativeIds: string[]; lineItemIds: string[]; mode: 'ADD' | 'REMOVE' },
): Promise<Result<BulkResponse>> {
  const user = await getSessionUser();
  return user ? assignCreativesToLineItems(user, aid, req) : NO_SESSION;
}

export async function appealCreativeAction(
  aid: string,
  cid: string,
  req: { exchangeIds?: string[]; reason?: string },
): Promise<Result<{ appealIds: string[] }>> {
  const user = await getSessionUser();
  return user ? appealCreative(user, aid, cid, req) : NO_SESSION;
}

export async function bulkAddCreativesAction(
  aid: string,
  req: { kind: BulkCreativeKind; csvUploadId: string; assetsZipUploadId?: string },
): Promise<Result<BulkResponse & { resultFile: string | null }>> {
  const user = await getSessionUser();
  return user ? bulkAddCreatives(user, aid, req) : NO_SESSION;
}

export async function testTagAction(tag: string): Promise<{ html: string }> {
  const user = await getSessionUser();
  return user ? testTag(tag) : { html: '' };
}

export async function previewAction(aid: string, cid: string): Promise<CreativePreview | null> {
  const user = await getSessionUser();
  return user ? soft(() => getCreativePreview(user, aid, cid), null) : null;
}

export async function eligibleCreativesAction(
  liId: string,
  q: { tab: EligibleTab; q?: string },
): Promise<(CreativeRow & { eligible: boolean; why?: string })[]> {
  const user = await getSessionUser();
  return user ? soft(() => getEligibleCreatives(user, liId, q), []) : [];
}
