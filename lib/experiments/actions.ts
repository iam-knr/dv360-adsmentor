'use server';

// Server actions of the experiment pages (module 17). Thin: resolve the session, call the service.
import type { LiftSlice, LiftType } from '@prisma/client';
import { getSessionUser } from '@/lib/auth/session';
import { ServiceFailure, type Result } from '@/lib/campaigns/service-kit';
import {
  createAbTest,
  downloadAbCsv,
  endAbTest,
  getAbDifferences,
  getAbReport,
  listExperimentCandidates,
  updateAbTest,
  type AbReportQuery,
} from './ab-service';
import {
  addLiftFlight,
  createLiftStudy,
  endLiftStudy,
  getLiftReport,
  liftEligibility,
  listEligibleIos,
  updateLiftStudy,
  type EligibilityResult,
  type EligibleIo,
  type LiftReportQuery,
} from './lift-service';
import type { DiffRow } from './diff';
import type { AbReport, AbTestInput, AbTestView, CandidateRow, LiftReport, LiftStudyInput } from './types';

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

export async function createAbTestAction(
  aid: string,
  input: AbTestInput,
): Promise<Result<{ id: string; publicId: string; status: 'SCHEDULED' | 'ACTIVE'; liftStudyId?: string }>> {
  const user = await getSessionUser();
  return user ? createAbTest(user, aid, input) : NO_SESSION;
}

export async function updateAbTestAction(
  aid: string,
  testId: string,
  input: AbTestInput,
): Promise<Result<{ view: AbTestView }>> {
  const user = await getSessionUser();
  return user ? updateAbTest(user, aid, testId, input) : NO_SESSION;
}

export async function endAbTestAction(aid: string, testId: string): Promise<Result<{ status: 'COMPLETED' }>> {
  const user = await getSessionUser();
  return user ? endAbTest(user, aid, testId) : NO_SESSION;
}

export async function abReportAction(aid: string, testId: string, q: AbReportQuery): Promise<AbReport | null> {
  const user = await getSessionUser();
  return user ? soft(() => getAbReport(user, aid, testId, q), null) : null;
}

export async function abCsvAction(
  aid: string,
  testId: string,
  q: AbReportQuery,
): Promise<{ fileName: string; body: string } | null> {
  const user = await getSessionUser();
  return user ? soft(() => downloadAbCsv(user, aid, testId, q), null) : null;
}

export async function abDifferencesAction(
  aid: string,
  testId: string,
  variantArmId?: string,
): Promise<{ controlName: string; variantName: string; variants: { id: string; name: string }[]; rows: DiffRow[] } | null> {
  const user = await getSessionUser();
  return user ? soft(() => getAbDifferences(user, aid, testId, variantArmId), null) : null;
}

export async function candidatesAction(
  aid: string,
  q: { compare: 'INSERTION_ORDERS' | 'LINE_ITEMS'; q?: string; exceptTestId?: string },
): Promise<CandidateRow[]> {
  const user = await getSessionUser();
  return user ? soft(() => listExperimentCandidates(user, aid, q), []) : [];
}

export async function eligibleIosAction(
  aid: string,
  q: { group: 'YOUTUBE_PG' | 'OTHER'; onlyEligible: boolean; q?: string },
): Promise<EligibleIo[]> {
  const user = await getSessionUser();
  return user ? soft(() => listEligibleIos(user, aid, q), []) : [];
}

export async function liftEligibilityAction(
  aid: string,
  req: { ioIds: string[]; types: LiftType[]; strength: 'STANDARD' | 'ENHANCED' },
): Promise<EligibilityResult | null> {
  const user = await getSessionUser();
  return user ? soft(() => liftEligibility(user, aid, req), null) : null;
}

export async function createLiftStudyAction(
  aid: string,
  input: LiftStudyInput,
): Promise<Result<{ id: string; publicId: string }>> {
  const user = await getSessionUser();
  return user ? createLiftStudy(user, aid, input) : NO_SESSION;
}

export async function updateLiftStudyAction(
  aid: string,
  studyId: string,
  input: LiftStudyInput,
): Promise<Result<{ status: string }>> {
  const user = await getSessionUser();
  return user ? updateLiftStudy(user, aid, studyId, input) : NO_SESSION;
}

export async function endLiftStudyAction(aid: string, studyId: string, type: LiftType): Promise<Result<null>> {
  const user = await getSessionUser();
  return user ? endLiftStudy(user, aid, studyId, type) : NO_SESSION;
}

export async function addLiftFlightAction(
  aid: string,
  studyId: string,
  type: LiftType,
): Promise<Result<{ flightNo: number }>> {
  const user = await getSessionUser();
  return user ? addLiftFlight(user, aid, studyId, type) : NO_SESSION;
}

export async function liftReportAction(
  aid: string,
  studyId: string,
  q: LiftReportQuery & { slice?: LiftSlice },
): Promise<LiftReport | null> {
  const user = await getSessionUser();
  return user ? soft(() => getLiftReport(user, aid, studyId, q), null) : null;
}
