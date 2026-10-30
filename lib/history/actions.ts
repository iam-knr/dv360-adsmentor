'use server';

// Server actions of the History page and the bell (module 05 4.6, 4.7). Thin: resolve the session, call the service.
import { getSessionUser } from '@/lib/auth/session';
import { asResult, type Result } from '@/lib/campaigns/service-kit';
import {
  addHistoryNote,
  deleteHistoryNote,
  listHistoryNotes,
  type NoteInput,
} from './notes';
import { dismissNotification, listNotifications } from './notifications';
import type { HistoryNoteRow, NotificationDto } from './types';

const NO_SESSION: Result<never> = {
  ok: false,
  code: 'FORBIDDEN',
  issues: [{ path: '*', severity: 'error', code: 'NO_SESSION', message: 'Sign in again.' }],
};

export async function listHistoryNotesAction(input: NoteInput): Promise<Result<HistoryNoteRow[]>> {
  const user = await getSessionUser();
  return user ? asResult(async () => ({ data: await listHistoryNotes(user, input) })) : NO_SESSION;
}

export async function addHistoryNoteAction(
  input: NoteInput & { text: string },
): Promise<Result<{ id: string }>> {
  const user = await getSessionUser();
  return user ? asResult(async () => ({ data: await addHistoryNote(user, input) })) : NO_SESSION;
}

export async function deleteHistoryNoteAction(id: string): Promise<Result<null>> {
  const user = await getSessionUser();
  return user ? asResult(async () => ({ data: await deleteHistoryNote(user, id) })) : NO_SESSION;
}

export async function listNotificationsAction(): Promise<NotificationDto[]> {
  const user = await getSessionUser();
  return user ? listNotifications(user).catch(() => []) : [];
}

export async function dismissNotificationAction(id: string): Promise<Result<null>> {
  const user = await getSessionUser();
  return user ? asResult(async () => ({ data: await dismissNotification(user, id) })) : NO_SESSION;
}
