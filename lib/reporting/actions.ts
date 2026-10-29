'use server';

// Server actions of the reporting pages (module 16 4.1). Thin: resolve the session, call the service.
import { getSessionUser } from '@/lib/auth/session';
import type { Result } from '@/lib/campaigns/service-kit';
import {
  deleteReport,
  generate,
  listFields,
  listShareTargets,
  queryReport,
  runReport,
  saveReport,
  saveReportAs,
  scheduleReport,
  shareReport,
  type FieldList,
  type SaveMeta,
  type ShareTarget,
} from './service';
import type { GenerateResult } from './generate';
import { markInboxRead } from './inbox';
import type {
  QueryResult,
  ReportDefinition,
  ReportDelivery,
  ReportSchedule,
} from './types';

const NO_SESSION: Result<never> = {
  ok: false,
  code: 'FORBIDDEN',
  issues: [{ path: '*', severity: 'error', code: 'NO_SESSION', message: 'Sign in again.' }],
};

export async function saveReportAction(pid: string, def: ReportDefinition, meta?: SaveMeta) {
  const user = await getSessionUser();
  return user ? saveReport(user, pid, def, meta) : NO_SESSION;
}

export async function saveReportAsAction(pid: string, id: string, name: string) {
  const user = await getSessionUser();
  return user ? saveReportAs(user, pid, id, name) : NO_SESSION;
}

export async function deleteReportAction(id: string) {
  const user = await getSessionUser();
  return user ? deleteReport(user, id) : NO_SESSION;
}

export async function scheduleReportAction(
  id: string,
  schedule: ReportSchedule,
  delivery: ReportDelivery,
) {
  const user = await getSessionUser();
  return user ? scheduleReport(user, id, schedule, delivery) : NO_SESSION;
}

export async function shareReportAction(id: string, req: { userIds: string[]; canEdit: boolean }) {
  const user = await getSessionUser();
  return user ? shareReport(user, id, req) : NO_SESSION;
}

export async function runReportAction(
  pid: string,
  req: { reportId?: string; definition?: ReportDefinition },
) {
  const user = await getSessionUser();
  return user ? runReport(user, pid, req) : NO_SESSION;
}

export async function queryReportAction(
  pid: string,
  def: ReportDefinition,
): Promise<Result<QueryResult>> {
  const user = await getSessionUser();
  return user ? queryReport(user, pid, def) : NO_SESSION;
}

export async function listFieldsAction(
  offline: 'FLOODLIGHT' | 'INVENTORY_AVAILABILITY' | undefined,
  selected: string[],
): Promise<FieldList | null> {
  const user = await getSessionUser();
  return user ? listFields(user, { ...(offline ? { offline } : {}), selected }) : null;
}

export async function listShareTargetsAction(): Promise<ShareTarget[]> {
  const user = await getSessionUser();
  return user ? listShareTargets(user).catch(() => []) : [];
}

export async function generateReportAction(
  pid: string,
  prompt: string,
): Promise<GenerateResult | null> {
  const user = await getSessionUser();
  return user ? generate(user, pid, prompt).catch(() => null) : null;
}

export async function markInboxReadAction(): Promise<void> {
  const user = await getSessionUser();
  if (user) await markInboxRead(user).catch(() => undefined);
}
