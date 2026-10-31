'use server';

// Server actions of the settings pages (modules 02 and 03). Thin: session, then service. The services check `can()`.
import { revalidatePath } from 'next/cache';
import { getSessionUser } from '@/lib/auth/session';
import type { AlertKey, CertKind, LinkType } from './constants';
import {
  updateAdvertiser,
  scheduleAdvertiserDeletion,
  cancelAdvertiserDeletion,
  type UpdateAdvertiserInput,
} from './advertiser-details';
import { createAdvertiser, setAdvertiserStatus, type CreateAdvertiserWire } from './advertisers';
import { saveAlertPreferences } from './alert-prefs';
import { acceptConfigurationTerms, saveAdvertiserConfigurations } from './configurations';
import { linkAccount, removeLinkedAccount, requestCreatorVideoAccess } from './data-manager';
import {
  getExchangesPanel,
  acceptAppMediationFees,
  updatePartner,
  type ExchangeRow,
  type UpdatePartnerInput,
} from './partner';
import { requestPolicyCertificate, decidePolicyCertificate } from './policy';
import type { AlertPrefInput, UserAccessInput } from './rules';
import { saveTargetingDefaults } from './targeting-defaults';
import { createUser, deleteUser, saveEmailPreferences, updateUser } from './users';
import type { Result } from './kit';

const NO_SESSION: Result<never> = { ok: false, code: 'FORBIDDEN', issues: [] };

async function withUser<T>(
  fn: (user: NonNullable<Awaited<ReturnType<typeof getSessionUser>>>) => Promise<Result<T>>,
  paths: string[] = [],
): Promise<Result<T>> {
  const user = await getSessionUser();
  if (!user) return NO_SESSION;
  const res = await fn(user);
  if (res.ok) for (const p of paths) revalidatePath(p);
  return res;
}

export const updatePartnerAction = async (
  pid: string,
  input: UpdatePartnerInput,
  meta: { expectedVersion?: number; note?: string } = {},
) => withUser((u) => updatePartner(u, pid, input, meta), ['/p']);
export async function getExchangesPanelAction(pid: string): Promise<Result<ExchangeRow[]>> {
  const user = await getSessionUser();
  return user ? getExchangesPanel(user, pid) : NO_SESSION;
}
export const acceptAppMediationFeesAction = async (pid: string) =>
  withUser((u) => acceptAppMediationFees(u, pid), ['/p']);
export const saveConfigurationsAction = async (
  pid: string,
  flags: Parameters<typeof saveAdvertiserConfigurations>[2]['flags'],
  meta: { expectedVersion?: number; note?: string } = {},
) => withUser((u) => saveAdvertiserConfigurations(u, pid, { flags }, meta), ['/p']);
export const acceptConfigurationTermsAction = async (pid: string, key: string) =>
  withUser((u) => acceptConfigurationTerms(u, pid, key), ['/p']);

export const createAdvertiserAction = async (pid: string, input: CreateAdvertiserWire) =>
  withUser((u) => createAdvertiser(u, pid, input), ['/p']);
export const setAdvertiserStatusAction = async (aid: string, status: 'ACTIVE' | 'PAUSED') =>
  withUser((u) => setAdvertiserStatus(u, aid, status), ['/p']);
export const updateAdvertiserAction = async (
  aid: string,
  input: UpdateAdvertiserInput,
  meta: { expectedVersion?: number; note?: string } = {},
) => withUser((u) => updateAdvertiser(u, aid, input, meta), ['/p']);
export const scheduleDeletionAction = async (aid: string) =>
  withUser((u) => scheduleAdvertiserDeletion(u, aid), ['/p']);
export const cancelDeletionAction = async (aid: string) =>
  withUser((u) => cancelAdvertiserDeletion(u, aid), ['/p']);

export const saveAlertPreferencesAction = async (
  aid: string,
  prefs: Record<AlertKey, AlertPrefInput>,
  meta: { expectedVersion?: number } = {},
) => withUser((u) => saveAlertPreferences(u, aid, prefs, meta), ['/p']);

export const linkAccountAction = async (
  aid: string,
  input: { type: LinkType; displayName: string; externalId?: string },
) => withUser((u) => linkAccount(u, aid, input), ['/p']);
export const removeLinkedAccountAction = async (aid: string, id: string) =>
  withUser((u) => removeLinkedAccount(u, aid, id), ['/p']);
export const requestCreatorVideoAction = async (aid: string) =>
  withUser((u) => requestCreatorVideoAccess(u, aid), ['/p']);

export const requestCertificateAction = async (
  aid: string,
  input: { kind: CertKind; countryCode?: string; notes?: string },
) => withUser((u) => requestPolicyCertificate(u, aid, input), ['/p']);
export const decideCertificateAction = async (
  certId: string,
  decision: 'APPROVED' | 'REJECTED',
  reason?: string,
) => withUser((u) => decidePolicyCertificate(u, certId, decision, reason), ['/p']);

export const createUserAction = async (
  input: { name: string; email: string; access: UserAccessInput[] },
  note?: string,
) => withUser((u) => createUser(u, input, note), ['/users']);
export const updateUserAction = async (
  id: string,
  input: { name?: string; access: UserAccessInput[] },
  note?: string,
) => withUser((u) => updateUser(u, id, input, note), ['/users']);
export const deleteUserAction = async (id: string) =>
  withUser((u) => deleteUser(u, id), ['/users']);
export const saveEmailPreferencesAction = async (input: { alerts: boolean; news: boolean }) =>
  withUser((u) => saveEmailPreferences(u, input));

export const saveTargetingDefaultsAction = async (
  pid: string,
  input: Parameters<typeof saveTargetingDefaults>[2],
  meta: { expectedVersion?: number; note?: string } = {},
) => withUser((u) => saveTargetingDefaults(u, pid, input, meta), ['/p']);
