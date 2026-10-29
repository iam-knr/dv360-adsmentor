'use server';

// Server actions of the line item form and lists (module 08 4). Thin: session, then service.
import type { Issue, LiType } from '@/lib/validation/types';
import { getSessionUser } from '@/lib/auth/session';
import { searchApps } from './apps';
import type { LiFormValue } from './form';
import {
  assignCreatives,
  createLineItem,
  getCopyCandidates,
  getCopySource,
  setLineItemStatus,
  updateLineItem,
  validateLineItem,
} from './service';
import type { AppSearchRow, CopyCandidate, LiCopySource, LiStatus, Result } from './types';

const NO_SESSION: Result<never> = {
  ok: false,
  code: 'FORBIDDEN',
  issues: [],
};

export async function createLineItemAction(
  ioId: string,
  value: LiFormValue,
  note?: string,
): Promise<Result<{ id: string; publicId: string }>> {
  const user = await getSessionUser();
  return user ? createLineItem(user, ioId, value, { ...(note ? { note } : {}) }) : NO_SESSION;
}

export async function updateLineItemAction(
  liId: string,
  value: LiFormValue,
  meta: { expectedVersion?: number; note?: string } = {},
): Promise<Result<{ version: number }>> {
  const user = await getSessionUser();
  return user ? updateLineItem(user, liId, value, meta) : NO_SESSION;
}

export async function validateLineItemAction(
  ioId: string,
  value: LiFormValue,
  liId?: string,
): Promise<Issue[]> {
  const user = await getSessionUser();
  return user ? validateLineItem(user, ioId, value, liId) : [];
}

export async function setLineItemStatusAction(
  id: string,
  status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED',
): Promise<Result<{ status: LiStatus; version: number }>> {
  const user = await getSessionUser();
  return user ? setLineItemStatus(user, { id, status }) : NO_SESSION;
}

export async function assignCreativesAction(
  liId: string,
  change: { add?: string[]; remove?: string[] },
): Promise<Result<{ assigned: string[] }>> {
  const user = await getSessionUser();
  return user ? assignCreatives(user, liId, change) : NO_SESSION;
}

export async function getCopyCandidatesAction(
  advertiserId: string,
  type: LiType,
  excludeId?: string,
): Promise<CopyCandidate[]> {
  const user = await getSessionUser();
  return user ? getCopyCandidates(user, advertiserId, type, excludeId) : [];
}

export async function getCopySourceAction(liId: string): Promise<Result<LiCopySource>> {
  const user = await getSessionUser();
  return user ? getCopySource(user, liId) : NO_SESSION;
}

/** App search of the Mobile app install pre-step (L19). */
export async function searchAppsAction(
  platform: 'ALL' | 'IOS' | 'ANDROID',
  q: string,
): Promise<AppSearchRow[]> {
  const user = await getSessionUser();
  return user ? searchApps(platform, q) : [];
}
