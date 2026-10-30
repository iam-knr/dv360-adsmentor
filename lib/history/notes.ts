import 'server-only';
// History notes (module 05 4.6): a short annotation per day and entity, shared with everyone who can open the page.
// Not written to the change log (they are annotations, not changes; DM 6.1).
import type { SessionUser } from '@/lib/auth/types';
import { ServiceFailure, notFound } from '@/lib/campaigns/service-kit';
import type { Tx } from '@/lib/db';
import { addDaysIso, simDateIn } from '@/lib/metrics/date-range';
import { loadEntity, readCtx, writeCtx } from './guard';
import {
  GEN_004,
  HIS_001,
  HIS_002,
  HIS_003,
  HIS_004,
  NOTES_PER_DAY,
  NOTE_MAX_AGE_DAYS,
  NOTE_MAX_LENGTH,
} from './note-rules';
import { HISTORY_ENTITY_TYPES, type HistoryEntityType, type HistoryNoteRow } from './types';
import { dayIn, timeIn } from './zone';


const reject = (path: string, code: string, message: string) =>
  new ServiceFailure('INVALID', [{ path, severity: 'error', code, message }]);

export interface NoteInput {
  entityType: HistoryEntityType;
  entityId: string;
  /** YYYY-MM-DD in the advertiser time zone. */
  date: string;
}

const isHistoryType = (t: string): t is HistoryEntityType =>
  (HISTORY_ENTITY_TYPES as readonly string[]).includes(t);

async function advertiserZone(tx: Tx, advertiserId: string): Promise<string> {
  const a = await tx.advertiser.findFirst({ where: { id: advertiserId }, select: { timeZone: true } });
  if (!a) throw notFound();
  return a.timeZone;
}

const dayDate = (iso: string) => new Date(`${iso}T00:00:00Z`);
const validDay = (iso: string) => /^\d{4}-\d{2}-\d{2}$/.test(iso) && dayDate(iso).toISOString().slice(0, 10) === iso;

export async function listHistoryNotes(user: SessionUser, input: NoteInput): Promise<HistoryNoteRow[]> {
  if (!isHistoryType(input.entityType) || !validDay(input.date)) throw notFound();
  return readCtx(user, async (tx, ctx) => {
    const entity = await loadEntity(tx, input.entityType, input.entityId);
    const zone = await advertiserZone(tx, entity.advertiserId);
    const rows = await tx.historyNote.findMany({
      where: {
        sandboxId: ctx.sandboxId,
        entityType: entity.type,
        entityId: entity.id,
        noteDate: dayDate(input.date),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    const me = (user.actor ?? user).id;
    return rows.map((n) => ({
      id: n.id,
      date: input.date,
      author: n.authorLabel,
      time: `${dayIn(zone, n.createdAt)} ${timeIn(zone, n.createdAt)}`,
      text: n.text,
      mine: n.authorId === me,
    }));
  });
}

export async function addHistoryNote(
  user: SessionUser,
  input: NoteInput & { text: string },
): Promise<{ id: string }> {
  if (!isHistoryType(input.entityType) || !validDay(input.date)) throw notFound();
  const text = input.text.trim();
  if (!text) throw reject('text', 'HIS-001', HIS_001);
  if (text.length > NOTE_MAX_LENGTH) throw reject('text', 'GEN-004', GEN_004);
  return writeCtx(user, async (tx, ctx) => {
    const entity = await loadEntity(tx, input.entityType, input.entityId);
    const zone = await advertiserZone(tx, entity.advertiserId);
    const today = [simDateIn(ctx.simNow, zone), dayIn(zone, new Date())].sort().pop()!;
    if (input.date > today || input.date < addDaysIso(today, -NOTE_MAX_AGE_DAYS)) {
      throw reject('date', 'HIS-002', HIS_002);
    }
    const noteDate = dayDate(input.date);
    const count = await tx.historyNote.count({
      where: { sandboxId: ctx.sandboxId, entityType: entity.type, entityId: entity.id, noteDate },
    });
    if (count >= NOTES_PER_DAY) throw reject('text', 'HIS-004', HIS_004);
    const author = user.actor ?? user;
    const row = await tx.historyNote.create({
      data: {
        sandboxId: ctx.sandboxId,
        advertiserId: entity.advertiserId,
        entityType: entity.type,
        entityId: entity.id,
        noteDate,
        authorId: author.id,
        authorLabel: author.email,
        text,
      },
      select: { id: true },
    });
    return row;
  });
}

/** Only the author or an admin deletes (HIS-003). */
export async function deleteHistoryNote(user: SessionUser, id: string): Promise<null> {
  return writeCtx(user, async (tx, ctx) => {
    const note = await tx.historyNote.findFirst({
      where: { id, sandboxId: ctx.sandboxId },
      select: { id: true, authorId: true },
    });
    if (!note) throw notFound();
    const actor = user.actor ?? user;
    if (note.authorId !== actor.id && actor.appRole === 'user') {
      throw new ServiceFailure('FORBIDDEN', [
        { path: '*', severity: 'error', code: 'HIS-003', message: HIS_003 },
      ]);
    }
    await tx.historyNote.delete({ where: { id: note.id } });
    return null;
  });
}
