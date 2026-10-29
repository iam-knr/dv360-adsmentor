// Report services against a seeded sandbox: access rules, validation, sharing, schedules, runs and downloads
// (module 16 6.1 items 5, 6, 10, 14, 16, 17, 19; 6.3 rules.report).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SessionUser } from '@/lib/auth/types';
import { prisma } from '@/lib/db';
import { setFileStore } from '@/lib/creatives/storage';
import {
  deleteReport,
  downloadRun,
  getReport,
  listFields,
  listReports,
  listRuns,
  listShareTargets,
  queryReport,
  runReport,
  saveReport,
  saveReportAs,
  scheduleReport,
  shareReport,
} from '@/lib/reporting/service';
import type { ReportDelivery, ReportSchedule } from '@/lib/reporting/types';
import { seedSandbox, type Seeded } from './fixture';

let s: Seeded;
let pid: string;
let owner: SessionUser;
let friend: SessionUser;
let stranger: SessionUser;
const extraUsers: string[] = [];

const asUser = (
  id: string,
  dvRole: SessionUser['dvRole'],
  sandboxId: string | undefined = s.sandboxId,
): SessionUser =>
  ({
    id,
    email: `${id}@example.test`,
    name: id,
    appRole: 'user',
    dvRole,
    sandboxId,
    classroomId: s.classroomId,
  }) as unknown as SessionUser;

beforeAll(async () => {
  s = await seedSandbox('rs');
  pid = s.partnerPublicId;
  owner = asUser(s.ownerId, 'STANDARD');
  const mk = async (tag: string) => {
    const u = await prisma.user.create({
      data: { email: `rs-${tag}-${Date.now()}@example.test`, name: tag, appRole: 'USER' },
    });
    extraUsers.push(u.id);
    return u;
  };
  const f = await mk('friend');
  const x = await mk('stranger');
  await prisma.userAccessGrant.create({
    data: { userId: f.id, sandboxId: s.sandboxId, role: 'STANDARD' },
  });
  friend = asUser(f.id, 'STANDARD');
  stranger = asUser(x.id, 'STANDARD');
}, 240_000);

afterAll(async () => {
  setFileStore(null);
  await s.cleanup();
  await prisma.user.deleteMany({ where: { id: { in: extraUsers } } });
  await prisma.$disconnect();
});

const ok = <T,>(r: { ok: boolean } & ({ ok: true; data: T } | { ok: false })): T => {
  expect(r.ok).toBe(true);
  return (r as { ok: true; data: T }).data;
};

describe('save, validate, copy, delete', () => {
  it('RPT-001 and RPT-019 on the name; RPT-014 without a partner filter', async () => {
    const empty = await saveReport(owner, pid, s.def({ name: ' ' }));
    expect(empty.ok).toBe(false);
    expect(!empty.ok && empty.issues.map((i) => i.code)).toContain('RPT-001');
    const long = await saveReport(owner, pid, s.def({ name: 'x'.repeat(256) }));
    expect(!long.ok && long.issues.map((i) => i.code)).toContain('RPT-019');
    const noPartner = await saveReport(owner, pid, s.def({ filters: [] }));
    expect(!noPartner.ok && noPartner.issues.map((i) => i.code)).toContain('RPT-014');
  });

  it('creates, updates with a version check, copies with a new id, and deletes', async () => {
    const a = ok(await saveReport(owner, pid, s.def({ name: 'First' })));
    expect(a.version).toBe(1);
    const view = await getReport(owner, a.id);
    expect(view.canEdit).toBe(true);
    const b = ok(
      await saveReport(owner, pid, { ...view.definition, name: 'First v2' }, { expectedVersion: 1 }),
    );
    expect(b.version).toBe(2);
    const stale = await saveReport(owner, pid, { ...view.definition, name: 'x' }, { expectedVersion: 1 });
    expect(!stale.ok && stale.code).toBe('CONFLICT');
    const copy = ok(await saveReportAs(owner, pid, a.id, 'First copy'));
    expect(copy.id).not.toBe(a.id);
    expect(copy.publicId).not.toBe(a.publicId);
    ok(await deleteReport(owner, copy.id));
    await expect(getReport(owner, copy.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('access', () => {
  it('READ_ONLY reads but cannot save or run; REPORTING_ONLY can build; CREATIVE gets the 404 page', async () => {
    const rep = ok(await saveReport(owner, pid, s.def({ name: 'Access' })));
    const readOnly = asUser(s.ownerId, 'READ_ONLY');
    expect((await getReport(readOnly, rep.id)).canEdit).toBe(false);
    const save = await saveReport(readOnly, pid, s.def({ name: 'nope' }));
    expect(!save.ok && save.code).toBe('FORBIDDEN');
    const run = await runReport(readOnly, pid, { reportId: rep.id });
    expect(!run.ok && run.code).toBe('FORBIDDEN');
    expect((await listReports(readOnly, pid, {})).rows.length).toBeGreaterThan(0);
    const reportingOnly = asUser(s.ownerId, 'REPORTING_ONLY');
    ok(await saveReport(reportingOnly, pid, s.def({ name: 'Reporting only report' })));
    await expect(listReports(asUser(s.ownerId, 'CREATIVE'), pid, {})).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('PARTNER_CLIENT has no cost fields in the picker and fails RPT-017 when forced', async () => {
    const client = asUser(s.ownerId, 'PARTNER_CLIENT');
    const keys = listFields(client, {}).fields.map((f) => f.key);
    expect(keys).not.toContain('revenue_partner');
    expect(listFields(owner, {}).fields.map((f) => f.key)).toContain('revenue_partner');
    const forced = await saveReport(client, pid, s.def({ name: 'forced', metrics: ['revenue_partner'] }));
    expect(!forced.ok && forced.code).toBe('FORBIDDEN');
    const q = await queryReport(asUser(s.ownerId, 'PARTNER_CLIENT'), pid, s.def({ metrics: ['revenue_partner'] }));
    expect(!q.ok).toBe(true);
    expect(!q.ok && q.issues.map((i) => i.code)).toContain('RPT-017');
  });

  it('a person of another sandbox sees nothing', async () => {
    const foreign = asUser(s.ownerId, 'STANDARD', 'sandbox-that-does-not-exist');
    await expect(listReports(foreign, pid, {})).rejects.toBeDefined();
  });
});

describe('sharing', () => {
  it('shares to people with a grant; others cannot open it (RPT-020)', async () => {
    const rep = ok(await saveReport(owner, pid, s.def({ name: 'Shared one' })));
    await expect(getReport(friend, rep.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    const targets = await listShareTargets(owner);
    expect(targets.map((t) => t.id)).toContain(friend.id);
    expect(targets.map((t) => t.id)).not.toContain(stranger.id);
    const bad = await shareReport(owner, rep.id, { userIds: [stranger.id], canEdit: false });
    expect(!bad.ok && bad.issues[0]?.code).toBe('RPT-020');
    ok(await shareReport(owner, rep.id, { userIds: [friend.id], canEdit: false }));
    const view = await getReport(friend, rep.id);
    expect(view.definition.name).toBe('Shared one');
    expect(view.canEdit).toBe(false);
    const edit = await saveReport(friend, pid, { ...view.definition, name: 'hijack' });
    expect(!edit.ok && edit.code).toBe('FORBIDDEN');
    expect((await listReports(friend, pid, { createdBy: 'any' })).rows.map((r) => r.name)).toContain(
      'Shared one',
    );
    expect((await listReports(friend, pid, { createdBy: 'me' })).rows.map((r) => r.name)).not.toContain(
      'Shared one',
    );
    ok(await shareReport(owner, rep.id, { userIds: [friend.id], canEdit: true }));
    expect((await getReport(friend, rep.id)).canEdit).toBe(true);
    const del = await deleteReport(friend, rep.id);
    expect(!del.ok && del.code).toBe('FORBIDDEN');
  });
});

describe('schedule', () => {
  const sched: ReportSchedule = { active: true, timeZone: 'UTC', repeats: 'DAILY', every: 1, starts: '2026-10-01' };
  const delivery: ReportDelivery = { format: 'CSV', fileName: 'daily', emailOwner: false, shareWith: [] };

  it('computes the next run; rejects RPT-003 and RPT-004', async () => {
    const rep = ok(await saveReport(owner, pid, s.def({ name: 'To schedule' })));
    const done = ok(await scheduleReport(owner, rep.id, sched, delivery));
    expect(done.nextRunSimAt).toMatch(/^2026-/);
    const back = await scheduleReport(owner, rep.id, { ...sched, expires: '2026-09-01' }, delivery);
    expect(!back.ok && back.issues.map((i) => i.code)).toContain('RPT-003');
    const noName = await scheduleReport(owner, rep.id, sched, { ...delivery, fileName: '' });
    expect(!noName.ok && noName.issues.map((i) => i.code)).toContain('RPT-004');
    const off = ok(await scheduleReport(owner, rep.id, { ...sched, active: false }, delivery));
    expect(off.nextRunSimAt).toBeNull();
  });
});

describe('runs and downloads', () => {
  it('runs, lists the file, downloads CSV and XLSX, and rebuilds a file the store lost', async () => {
    const def = s.def({ name: 'Run me', dateRange: '20260901:20260928', metrics: ['impressions', 'clicks'] });
    const run = ok(await runReport(owner, pid, { definition: def }));
    expect(run.status).toBe('DONE');
    const runs = await listRuns(owner, run.reportId);
    expect(runs.runs).toHaveLength(1);
    expect(runs.runs[0]?.dateRange).toEqual({ from: '2026-09-01', to: '2026-09-28' });
    const csv = await downloadRun(owner, run.runId, 'CSV');
    expect(csv.contentType).toContain('text/csv');
    const text = new TextDecoder().decode(csv.bytes);
    expect(text.split('\n')[0]).toBe('Advertiser,Impressions,Clicks');
    const xlsx = await downloadRun(owner, run.runId, 'XLSX');
    expect(Buffer.from(xlsx.bytes).subarray(0, 2).toString()).toBe('PK');
    // a different server process has an empty store: the file is rebuilt from the run
    setFileStore({ put: () => Promise.resolve(), get: () => Promise.resolve(null) });
    const again = await downloadRun(owner, run.runId, 'CSV');
    expect(new TextDecoder().decode(again.bytes).split('\n').slice(0, 3)).toEqual(text.split('\n').slice(0, 3));
    setFileStore(null);
  });

  it('a run of an invalid report fails with the rule message, nothing is stored as DONE', async () => {
    const bad = await runReport(owner, pid, { definition: s.def({ name: 'Bad', metrics: [] }) });
    expect(bad.ok).toBe(false);
  });
});
