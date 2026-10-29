'use server';

// Server actions of the campaign forms and list (module 06 4). Thin: resolve the session, call the service.
import { getSessionUser } from '@/lib/auth/session';
import {
  createCampaign,
  getCopySource,
  listCampaigns,
  setCampaignStatus,
  updateCampaign,
  validateCampaign,
} from './service';
import type { Result } from './service-kit';
import type {
  CampaignCopySource,
  CampaignDetail,
  CampaignWire,
  CopySetting,
  EntityStatusKey,
  WireIssue,
  WriteMeta,
} from './wire';

const NO_SESSION: Result<never> = {
  ok: false,
  code: 'FORBIDDEN',
  issues: [{ path: '*', severity: 'error', code: 'NO_SESSION', message: 'Sign in again.' }],
};

export async function createCampaignAction(
  aid: string,
  wire: CampaignWire,
  meta?: WriteMeta,
): Promise<Result<{ id: string; publicId: string }>> {
  const user = await getSessionUser();
  return user ? createCampaign(user, aid, wire, meta) : NO_SESSION;
}

export async function updateCampaignAction(
  cid: string,
  wire: CampaignWire,
  meta?: WriteMeta,
): Promise<Result<CampaignDetail>> {
  const user = await getSessionUser();
  return user ? updateCampaign(user, cid, wire, meta) : NO_SESSION;
}

export async function validateCampaignAction(
  aid: string,
  wire: CampaignWire,
  cid?: string,
): Promise<WireIssue[]> {
  const user = await getSessionUser();
  return user ? validateCampaign(user, aid, wire, cid) : [];
}

export async function setCampaignStatusAction(
  cid: string,
  status: EntityStatusKey,
): Promise<Result<unknown>> {
  const user = await getSessionUser();
  return user ? setCampaignStatus(user, cid, status as 'ACTIVE' | 'PAUSED') : NO_SESSION;
}

export async function copySourceAction(
  fromCid: string,
  settings: CopySetting[],
): Promise<CampaignCopySource | null> {
  const user = await getSessionUser();
  return user ? getCopySource(user, fromCid, settings) : null;
}

/** DLG-10 left pane: every campaign of the advertiser, any status (module 06 2.3). */
export async function copyCandidatesAction(
  aid: string,
): Promise<{ publicId: string; name: string }[]> {
  const user = await getSessionUser();
  if (!user) return [];
  const res = await listCampaigns(user, aid, { status: ['*'], pageSize: 200 });
  return res.rows.map((r) => ({ publicId: r.publicId, name: r.name }));
}
