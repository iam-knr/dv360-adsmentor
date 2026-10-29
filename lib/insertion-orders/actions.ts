'use server';

// Server actions of the insertion order forms and lists (module 07 4). Thin: session, then service.
import { getSessionUser } from '@/lib/auth/session';
import type { Result } from '@/lib/campaigns/service-kit';
import type { WireIssue, WriteMeta } from '@/lib/campaigns/wire';
import {
  createInsertionOrder,
  patchIoBudget,
  setIoObjectiveToNone,
  setIoStatus,
  updateInsertionOrder,
  validateInsertionOrder,
} from './service';
import type { IoDetail, IoWire } from './wire';

const NO_SESSION: Result<never> = {
  ok: false,
  code: 'FORBIDDEN',
  issues: [{ path: '*', severity: 'error', code: 'NO_SESSION', message: 'Sign in again.' }],
};

export async function createIoAction(
  cid: string,
  wire: IoWire,
  meta?: WriteMeta,
): Promise<Result<{ id: string; publicId: string }>> {
  const user = await getSessionUser();
  return user ? createInsertionOrder(user, cid, wire, meta) : NO_SESSION;
}

export async function updateIoAction(
  ioId: string,
  wire: IoWire,
  meta?: WriteMeta,
): Promise<Result<IoDetail>> {
  const user = await getSessionUser();
  return user ? updateInsertionOrder(user, ioId, wire, meta) : NO_SESSION;
}

export async function validateIoAction(
  cid: string,
  wire: IoWire,
  ioId?: string,
): Promise<WireIssue[]> {
  const user = await getSessionUser();
  return user ? validateInsertionOrder(user, cid, wire, ioId) : [];
}

export async function setIoStatusAction(
  ioId: string,
  status: 'ACTIVE' | 'PAUSED',
): Promise<Result<unknown>> {
  const user = await getSessionUser();
  return user ? setIoStatus(user, ioId, status) : NO_SESSION;
}

export async function patchIoBudgetAction(
  ioId: string,
  segmentId: string,
  amount: number,
): Promise<Result<unknown>> {
  const user = await getSessionUser();
  return user ? patchIoBudget(user, ioId, segmentId, amount) : NO_SESSION;
}

export async function setIoObjectiveNoneAction(ioId: string): Promise<Result<unknown>> {
  const user = await getSessionUser();
  return user ? setIoObjectiveToNone(user, ioId) : NO_SESSION;
}
