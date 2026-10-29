'use server';

// Server actions of the planning pages (module 04). Thin: resolve the session, call the service.
import type { CrossMediaCountry } from '@prisma/client';
import { getSessionUser } from '@/lib/auth/session';
import { ServiceFailure, type Result } from '@/lib/campaigns/service-kit';
import {
  createCrossMediaReport,
  deleteCrossMediaReport,
  getCrossMediaOptions,
  renameCrossMediaReport,
  type CreateCrossMediaInput,
  type CrossMediaOptions,
  type CrossMediaScopeIn,
} from './cross-media-service';
import {
  convertPlan,
  copyPlan,
  createPlan,
  downloadPlanCsv,
  listPlanDeals,
  listPlans,
  removePlan,
  savePlanColumns,
  updatePlan,
  type ConvertResult,
  type CreatePlanInput,
  type PlanDealChoice,
  type PlanList,
  type UpdatePlanInput,
} from './service';
import type { PlanDto, PlanStatusKey } from './types';

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

export async function listPlansAction(
  aid: string,
  status: PlanStatusKey[],
): Promise<PlanList | null> {
  const user = await getSessionUser();
  return user ? soft(() => listPlans(user, aid, { status }), null) : null;
}

export async function createPlanAction(
  aid: string,
  input: CreatePlanInput = {},
): Promise<Result<{ id: string; publicId: string }>> {
  const user = await getSessionUser();
  return user ? createPlan(user, aid, input) : NO_SESSION;
}

export async function updatePlanAction(
  aid: string,
  input: UpdatePlanInput,
): Promise<Result<{ plan: PlanDto }>> {
  const user = await getSessionUser();
  return user ? updatePlan(user, aid, input) : NO_SESSION;
}

export async function copyPlanAction(
  aid: string,
  input: { id: string; name?: string; startDate: string; endDate: string },
): Promise<Result<{ id: string; publicId: string }>> {
  const user = await getSessionUser();
  return user ? copyPlan(user, aid, input) : NO_SESSION;
}

export async function removePlanAction(aid: string, id: string): Promise<Result<null>> {
  const user = await getSessionUser();
  return user ? removePlan(user, aid, id) : NO_SESSION;
}

export async function convertPlanAction(
  aid: string,
  input: { id: string; target: 'CAMPAIGN' | 'IO'; campaignId?: string },
): Promise<Result<ConvertResult>> {
  const user = await getSessionUser();
  return user ? convertPlan(user, aid, input) : NO_SESSION;
}

export async function savePlanColumnsAction(
  aid: string,
  order: string[],
): Promise<Result<{ order: string[] }>> {
  const user = await getSessionUser();
  return user ? savePlanColumns(user, aid, order) : NO_SESSION;
}

export async function downloadPlanCsvAction(
  aid: string,
  planId: string,
): Promise<{ fileName: string; body: string } | null> {
  const user = await getSessionUser();
  return user ? soft(() => downloadPlanCsv(user, aid, planId), null) : null;
}

export async function listPlanDealsAction(aid: string): Promise<PlanDealChoice[]> {
  const user = await getSessionUser();
  return user ? soft(() => listPlanDeals(user, aid), []) : [];
}

export async function crossMediaOptionsAction(
  scope: CrossMediaScopeIn,
  country: CrossMediaCountry,
): Promise<CrossMediaOptions | null> {
  const user = await getSessionUser();
  return user ? soft(() => getCrossMediaOptions(user, { country, scope }), null) : null;
}

export async function createCrossMediaReportAction(
  input: CreateCrossMediaInput,
): Promise<Result<{ id: string; publicId: string }>> {
  const user = await getSessionUser();
  return user ? createCrossMediaReport(user, input) : NO_SESSION;
}

export async function renameCrossMediaReportAction(
  scope: CrossMediaScopeIn,
  id: string,
  name: string,
): Promise<Result<null>> {
  const user = await getSessionUser();
  return user ? renameCrossMediaReport(user, scope, id, name) : NO_SESSION;
}

export async function deleteCrossMediaReportAction(
  scope: CrossMediaScopeIn,
  id: string,
): Promise<Result<null>> {
  const user = await getSessionUser();
  return user ? deleteCrossMediaReport(user, scope, id) : NO_SESSION;
}
