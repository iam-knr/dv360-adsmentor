// Module 05 readers, notes and notifications against a real database: AC-05-8, 12, 13, 18, 19, 21 to 23, 25, 26.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SessionUser } from '@/lib/auth/types';
import { prisma } from '@/lib/db';
import { getHistory, getHistoryCsv } from '@/lib/history/read';
import { addHistoryNote, deleteHistoryNote, listHistoryNotes } from '@/lib/history/notes';
import { addDaysIso } from '@/lib/metrics/date-range';
import { dayIn, startOfDayIn } from '@/lib/history/zone';
import { createWorld, dropWorld, type World } from '../db/helpers';

let w: World;
let other: World;
const IST = 'Asia/Calcutta';
const today = () => dayIn(IST, new Date());
const at = (day: string, hh: number, mm = 0) =>
  new Date(startOfDayIn(IST, day).getTime() + (hh * 60 + mm) * 60_000);

const userOf = (world: World, over: Partial<SessionUser> = {}): SessionUser => ({
  id: world.userId,
  email: `${world.tag}-user@example.test`,
  name: 'Sam Student',
  appRole: 'user',
  dvRole: 'STANDARD',
  classroomId: world.classroomId,
  sandboxId: world.sandboxId,
  ...over,
});

async function group(
  entity: { type: 'ADVERTISER' | 'CAMPAIGN' | 'INSERTION_ORDER' | 'LINE_ITEM' | 'AD_GROUP'; id: string },
  when: Date,
  o: { system?: string; hidden?: boolean; summary?: string; lines?: [string, string, string][] } = {},
) {
  return prisma.changeGroup.create({
    data: {
      sandboxId: w.sandboxId,
      classroomId: w.classroomId,
      advertiserId: w.advertiserId,
      campaignId: entity.type === 'ADVERTISER' ? null : w.campaignId,
      ioId: ['INSERTION_ORDER', 'LINE_ITEM', 'AD_GROUP'].includes(entity.type) ? w.ioId : null,
      lineItemId: ['LINE_ITEM', 'AD_GROUP'].includes(entity.type) ? w.lineItemId : null,
      entityType: entity.type,
      entityId: entity.id,
      actorType: o.system ? 'SYSTEM' : 'USER',
      userId: o.system ? null : w.userId,
      actorLabel: o.system ? null : 'sam@example.test',
      systemActor: o.system ?? null,
      isHidden: !!o.hidden,
      summary: o.summary ?? '1 change to insertion order',
      occurredAt: when,
      entries: {
        create: (o.lines ?? [['name', 'Name', 'New']]).map(([path, label, value], i) => ({
          sandboxId: w.sandboxId,
          kind: 'UPDATE' as const,
          fieldPath: path,
          label,
          oldValue: 'Old',
          newValue: value,
          sortOrder: i,
        })),
      },
    },
  });
}

beforeAll(async () => {
  w = await createWorld('hist');
  other = await createWorld('hist2');
  // a group at 02:00 IST two days ago: Mar 26 in IST, the previous day in UTC
  await group({ type: 'INSERTION_ORDER', id: w.ioId }, at(addDaysIso(today(), -2), 2));
  await group({ type: 'INSERTION_ORDER', id: w.ioId }, at(addDaysIso(today(), -2), 14, 30), {
    lines: [['segments[s1].amount', 'Budget', '7000.00']],
  });
  await group({ type: 'LINE_ITEM', id: w.lineItemId }, at(addDaysIso(today(), -3), 11), { summary: 'Status changed to Paused' });
  await group({ type: 'AD_GROUP', id: w.adGroupId }, at(addDaysIso(today(), -4), 11), { summary: '1 change to ad group' });
  await group({ type: 'INSERTION_ORDER', id: w.ioId }, at(addDaysIso(today(), -5), 9), { system: 'CREATIVE_APPROVAL_SYNC' });
  await group({ type: 'INSERTION_ORDER', id: w.ioId }, at(addDaysIso(today(), -5), 8), { system: 'SIM_SEED', hidden: true });
});
afterAll(async () => {
  await prisma.notificationDismissal.deleteMany({ where: { notification: { title: { startsWith: 'hist-' } } } });
  await prisma.notification.deleteMany({ where: { title: { startsWith: 'hist-' } } });
  await dropWorld(w);
  await dropWorld(other);
  await prisma.$disconnect();
});

const io = () => ({ entityType: 'INSERTION_ORDER' as const, entityId: w.ioId });

describe('getHistory', () => {
  it('lists user days newest first with the entity label, time and zone (AC-05-10, 11)', async () => {
    const data = await getHistory(userOf(w), io());
    expect(data.timeZone).toBe(IST);
    expect(data.days.map((d) => d.date)).toEqual([
      addDaysIso(today(), -2),
      addDaysIso(today(), -3),
      addDaysIso(today(), -4),
    ]);
    const first = data.days[0]!;
    expect(first.count).toBe(2);
    expect(first.entityLabel).toBe('insertion order');
    expect(first.changes.map((c) => c.time)).toEqual(['14:30:00', '02:00:00']);
    expect(first.changes[0]!.tzLabel).toBe('IST');
    expect(first.changes[0]!.user).toBe('sam@example.test');
    expect(first.changes[0]!.lines).toEqual(['Budget changed from "Old" to "7000.00"']);
    // a day of mixed entity types has no entity label (header "n changes")
    expect(data.days[1]!.entityLabel).toBe('line item');
    expect(data.days[2]!.entityLabel).toBe('ad group');
  });

  it('includes all descendants through the chain ids (AC-05-23)', async () => {
    const asIo = await getHistory(userOf(w), io());
    expect(asIo.days.flatMap((d) => d.changes.map((c) => c.summary))).toContain('Status changed to Paused');
    const asLi = await getHistory(userOf(w), { entityType: 'LINE_ITEM', entityId: w.lineItemId });
    expect(asLi.days.flatMap((d) => d.changes.map((c) => c.summary))).toContain('1 change to ad group');
    const asAdv = await getHistory(userOf(w), { entityType: 'ADVERTISER', entityId: w.advertiserId });
    expect(asAdv.days.reduce((n, d) => n + d.count, 0)).toBe(4);
    const asCmp = await getHistory(userOf(w), { entityType: 'CAMPAIGN', entityId: w.campaignId });
    expect(asCmp.days.reduce((n, d) => n + d.count, 0)).toBe(4);
  });

  it('hides system rows until asked, and SIM_SEED rows always (AC-05-12)', async () => {
    const off = await getHistory(userOf(w), io());
    expect(off.days.flatMap((d) => d.changes).some((c) => c.system)).toBe(false);
    const on = await getHistory(userOf(w), { ...io(), includeSystem: true });
    const systems = on.days.flatMap((d) => d.changes).filter((c) => c.system);
    expect(systems.map((c) => c.user)).toEqual(['CREATIVE_APPROVAL_SYNC']);
  });

  it('buckets days in the viewer zone when tz is local (AC-05-13)', async () => {
    const data = await getHistory(userOf(w), { ...io(), tz: 'local', zone: 'UTC' });
    expect(data.timeZone).toBe('UTC');
    const day = addDaysIso(today(), -2);
    // 02:00 IST is the evening of the previous UTC day
    const dates = data.days.map((d) => d.date);
    expect(dates).toContain(addDaysIso(day, -1));
    expect(data.days.find((d) => d.date === addDaysIso(day, -1))!.changes[0]!.time).toBe('20:30:00');
    expect(data.days.find((d) => d.date === addDaysIso(day, -1))!.changes[0]!.tzLabel).toBe('UTC');
  });

  it('ignores an unknown zone and falls back to the advertiser zone', async () => {
    const data = await getHistory(userOf(w), { ...io(), tz: 'local', zone: 'Mars/Olympus' });
    expect(data.timeZone).toBe(IST);
  });

  it('honours an explicit range and returns an empty page for an empty range (AC-05-15)', async () => {
    const d = `${addDaysIso(today(), -30).replaceAll('-', '')}:${addDaysIso(today(), -20).replaceAll('-', '')}`;
    const data = await getHistory(userOf(w), { ...io(), d });
    expect(data.days).toEqual([]);
    expect(data.range.from).toBe(addDaysIso(today(), -30));
  });

  it('rejects a malformed range', async () => {
    await expect(getHistory(userOf(w), { ...io(), d: 'sometime' })).rejects.toMatchObject({ code: 'INVALID' });
  });

  it('pages by day: 30 days, then a cursor', async () => {
    for (let i = 10; i < 45; i++) {
      await group({ type: 'LINE_ITEM', id: w.lineItemId }, at(addDaysIso(today(), -i), 10), { summary: 'paging' });
    }
    const first = await getHistory(userOf(w), { entityType: 'LINE_ITEM', entityId: w.lineItemId });
    expect(first.days).toHaveLength(30);
    expect(first.nextCursor).toBe(first.days[29]!.date);
    const second = await getHistory(userOf(w), { entityType: 'LINE_ITEM', entityId: w.lineItemId, cursor: first.nextCursor });
    expect(second.days[0]!.date < first.nextCursor!).toBe(true);
    const seen = new Set([...first.days, ...second.days].map((d) => d.date));
    expect(seen.size).toBe(first.days.length + second.days.length);
    expect(second.nextCursor).toBeUndefined();
    await prisma.changeGroup.deleteMany({ where: { sandboxId: w.sandboxId, summary: 'paging' } });
  });

  it('is not readable from another sandbox or below view access (AC-05-26)', async () => {
    await expect(getHistory(userOf(other), io())).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      getHistory(userOf(w, { dvRole: 'REPORTING_ONLY' }), io()),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    // a read-only role still reads
    await expect(getHistory(userOf(w, { dvRole: 'READ_ONLY' }), io())).resolves.toMatchObject({ canAddNotes: false });
    await expect(getHistory(userOf(w), { entityType: 'INSERTION_ORDER', entityId: 'not-an-id' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('draws the Spend chart from daily totals of the subtree', async () => {
    const day = (n: number) => new Date(`${addDaysIso(today(), -n)}T00:00:00Z`);
    for (const [n, cost] of [[1, 120], [2, 80]] as const) {
      await prisma.simDailyMetric.create({
        data: { sandboxId: w.sandboxId, classroomId: w.classroomId, lineItemId: w.lineItemId, simDate: day(n), revenue: cost, mediaCost: cost },
      });
    }
    const data = await getHistory(userOf(w), io());
    expect(data.spend).toEqual([
      { date: addDaysIso(today(), -2), amount: 80 },
      { date: addDaysIso(today(), -1), amount: 120 },
    ]);
    expect(data.spendGrain).toBe('Daily');
    expect(data.currency).toBe('INR');
  });
});

describe('getHistoryCsv (AC-05-19)', () => {
  it('has one row per entry with the 11 columns, respecting the system toggle', async () => {
    const csv = await getHistoryCsv(userOf(w), io());
    const lines = csv.replace(/^﻿/, '').trimEnd().split('\r\n');
    expect(lines[0]).toBe('Time,Time zone,Entity type,Entity ID,Entity name,User,Source,Field,Old value,New value,Note');
    expect(lines).toHaveLength(1 + 2 + 1 + 1); // 2 IO groups, the LI group and the ad group group
    expect(lines.some((l) => l.includes('CREATIVE_APPROVAL_SYNC'))).toBe(false);
    expect(lines[1]).toContain(',IST,insertion order,');
    const withSystem = await getHistoryCsv(userOf(w), { ...io(), includeSystem: true });
    expect(withSystem).toContain('CREATIVE_APPROVAL_SYNC');
    expect(withSystem).not.toContain('SIM_SEED');
  });
});

describe('notes (AC-05-17, 18, 26)', () => {
  const day = () => addDaysIso(today(), -2);
  it('adds, lists and counts a note, and shows the count on the day card', async () => {
    const r = await addHistoryNote(userOf(w), { ...io(), date: day(), text: '  Raised the budget  ' });
    const list = await listHistoryNotes(userOf(w), { ...io(), date: day() });
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: r.id, text: 'Raised the budget', mine: true, author: `${w.tag}-user@example.test` });
    const page = await getHistory(userOf(w), io());
    expect(page.days.find((d) => d.date === day())!.notesCount).toBe(1);
  });

  it('validates text, date and the daily limit', async () => {
    const add = (text: string, date = day()) => addHistoryNote(userOf(w), { ...io(), date, text });
    await expect(add('   ')).rejects.toMatchObject({ issues: [{ code: 'HIS-001', message: 'Enter a value' }] });
    await expect(add('x'.repeat(1001))).rejects.toMatchObject({ issues: [{ code: 'GEN-004' }] });
    await expect(add('x'.repeat(1000))).resolves.toBeTruthy();
    await expect(add('later', addDaysIso(today(), 1))).rejects.toMatchObject({ issues: [{ code: 'HIS-002' }] });
    await expect(add('old', addDaysIso(today(), -800))).rejects.toMatchObject({ issues: [{ code: 'HIS-002' }] });
    const full = addDaysIso(today(), -6);
    for (let i = 0; i < 50; i++) await add(`n${i}`, full);
    await expect(add('one more', full)).rejects.toMatchObject({ issues: [{ code: 'HIS-004' }] });
  });

  it('lets read-only roles list but not add or delete (Q3)', async () => {
    const ro = userOf(w, { dvRole: 'READ_ONLY' });
    await expect(listHistoryNotes(ro, { ...io(), date: day() })).resolves.toHaveLength(2);
    await expect(addHistoryNote(ro, { ...io(), date: day(), text: 'hi' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('lets only the author or an admin delete (HIS-003)', async () => {
    const mine = (await listHistoryNotes(userOf(w), { ...io(), date: day() }))[0]!;
    const peer = userOf(w, { id: 'someone-else', email: 'peer@example.test' });
    await expect(deleteHistoryNote(peer, mine.id)).rejects.toMatchObject({ issues: [{ code: 'HIS-003' }] });
    const admin = userOf(w, { id: 'inst', email: 'inst@example.test', appRole: 'admin' });
    await expect(deleteHistoryNote(admin, mine.id)).resolves.toBeNull();
    const rest = await listHistoryNotes(userOf(w), { ...io(), date: day() });
    expect(rest.some((n) => n.id === mine.id)).toBe(false);
    const own = (await addHistoryNote(userOf(w), { ...io(), date: day(), text: 'to delete' })).id;
    await expect(deleteHistoryNote(userOf(w), own)).resolves.toBeNull();
  });

  it('does not leak notes across sandboxes', async () => {
    await expect(listHistoryNotes(userOf(other), { ...io(), date: day() })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
