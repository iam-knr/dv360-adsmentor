'use server';

// Server actions of the campaign forms and list (module 06 4). Thin: resolve the session, call the service.
import { getSessionUser } from '@/lib/auth/session';
import {
  createCampaign,
  getCopySource,
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
