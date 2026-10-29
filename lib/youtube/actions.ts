'use server';

// Server actions of the ad group and ad panels (module 09 4.1). Thin: session, then service.
import { getSessionUser } from '@/lib/auth/session';
import type { Issue } from '@/lib/validation/types';
import {
  bulkSetAdGroupStatus,
  createAd,
  createAdGroup,
  deleteAd,
  deleteAdGroup,
  getAdDetail,
  getAdDraft,
  getAdGroupDetail,
  getAdGroupDraft,
  lookupVideos,
  setAdGroupStatus,
  setAdStatus,
  updateAd,
  updateAdGroup,
  uploadAdAsset,
  validateAd,
  validateAdGroup,
} from './service';
import type {
  AdDetail,
  AdFormValue,
  AdGroupDetail,
  AdGroupFormValue,
  Result,
  YoutubeVideoHit,
  YtStatus,
} from './types';

const NO_SESSION: Result<never> = { ok: false, code: 'FORBIDDEN', issues: [] };

export async function getAdGroupDetailAction(id: string): Promise<AdGroupDetail | null> {
  const user = await getSessionUser();
  return user ? getAdGroupDetail(user, id) : null;
}

export async function getAdGroupDraftAction(
  liId: string,
): Promise<Omit<AdGroupDetail, 'id' | 'publicId' | 'version' | 'ads'> | null> {
  const user = await getSessionUser();
  return user ? getAdGroupDraft(user, liId) : null;
}

export async function validateAdGroupAction(
  liId: string,
  value: AdGroupFormValue,
  adGroupId?: string,
): Promise<Issue[]> {
  const user = await getSessionUser();
  return user ? validateAdGroup(user, liId, value, adGroupId) : [];
}

export async function createAdGroupAction(
  liId: string,
  value: AdGroupFormValue,
): Promise<Result<{ id: string; publicId: string }>> {
  const user = await getSessionUser();
  return user ? createAdGroup(user, liId, value) : NO_SESSION;
}

export async function updateAdGroupAction(
  id: string,
  value: AdGroupFormValue,
  expectedVersion?: number,
): Promise<Result<{ version: number }>> {
  const user = await getSessionUser();
  return user
    ? updateAdGroup(user, id, value, expectedVersion !== undefined ? { expectedVersion } : {})
    : NO_SESSION;
}

export async function setAdGroupStatusAction(
  id: string,
  status: YtStatus,
): Promise<Result<{ status: YtStatus; version: number }>> {
  const user = await getSessionUser();
  return user ? setAdGroupStatus(user, id, status) : NO_SESSION;
}

export async function bulkAdGroupStatusAction(
  ids: string[],
  status: YtStatus,
): Promise<Result<{ changed: number }>> {
  const user = await getSessionUser();
  return user ? bulkSetAdGroupStatus(user, ids, status) : NO_SESSION;
}

export async function deleteAdGroupAction(id: string): Promise<Result<null>> {
  const user = await getSessionUser();
  return user ? deleteAdGroup(user, id) : NO_SESSION;
}

export async function getAdDetailAction(id: string): Promise<AdDetail | null> {
  const user = await getSessionUser();
  return user ? getAdDetail(user, id) : null;
}

export async function getAdDraftAction(adGroupId: string): Promise<AdDetail | null> {
  const user = await getSessionUser();
  return user ? getAdDraft(user, adGroupId) : null;
}

export async function validateAdAction(
  adGroupId: string,
  value: AdFormValue,
  adId?: string,
): Promise<Issue[]> {
  const user = await getSessionUser();
  return user ? validateAd(user, adGroupId, value, adId) : [];
}

export async function createAdAction(
  adGroupId: string,
  value: AdFormValue,
): Promise<Result<{ id: string; publicId: string }>> {
  const user = await getSessionUser();
  return user ? createAd(user, adGroupId, value) : NO_SESSION;
}

export async function updateAdAction(
  id: string,
  value: AdFormValue,
  expectedVersion?: number,
): Promise<Result<{ version: number }>> {
  const user = await getSessionUser();
  return user
    ? updateAd(user, id, value, expectedVersion !== undefined ? { expectedVersion } : {})
    : NO_SESSION;
}

export async function setAdStatusAction(
  id: string,
  status: YtStatus,
): Promise<Result<{ status: YtStatus; version: number }>> {
  const user = await getSessionUser();
  return user ? setAdStatus(user, id, status) : NO_SESSION;
}

export async function deleteAdAction(id: string): Promise<Result<null>> {
  const user = await getSessionUser();
  return user ? deleteAd(user, id) : NO_SESSION;
}

export async function lookupVideosAction(q: string): Promise<YoutubeVideoHit[]> {
  const user = await getSessionUser();
  return user ? lookupVideos(user, q) : [];
}

export async function uploadAdAssetAction(
  form: FormData,
): Promise<Result<{ id: string; url: string }>> {
  const user = await getSessionUser();
  if (!user) return NO_SESSION;
  const file = form.get('file');
  const role = form.get('role');
  const adGroupId = form.get('adGroupId');
  if (
    !(file instanceof File) ||
    (role !== 'LOGO' && role !== 'COMPANION' && role !== 'IMAGE') ||
    typeof adGroupId !== 'string'
  )
    return { ok: false, issues: [] };
  return uploadAdAsset(user, {
    adGroupId,
    role,
    fileName: file.name,
    mimeType: file.type,
    bytes: new Uint8Array(await file.arrayBuffer()),
  });
}
