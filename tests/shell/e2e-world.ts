// Fixtures for tests/e2e/shell.spec.ts: a signed-in student whose sandbox holds one partner, advertiser, campaign,
// IO, line item and audience, built with the plain client (table owner, not subject to RLS). Synthetic data only.
import type { DvRole, PrismaClient } from '@prisma/client';
import { createAccount, createClassroom, createStudent, type WindowKind } from '../auth/fixtures';

export interface ShellWorld {
  email: string;
  password: string;
  userIds: string[];
  classroomId: string;
  sandboxId: string;
  rows: { advertiserId: string };
  /** Public ids for the URL placeholders of lib/routes/route-table.ts. */
  ids: { pid: string; aid: string; cid: string; ioId: string; liId: string; x: string };
  names: { partner: string; advertiser: string; campaign: string };
}

export async function createShellWorld(
  db: PrismaClient,
  opts: { tag: string; role?: DvRole; windows?: WindowKind; paused?: boolean },
): Promise<ShellWorld> {
  const admin = await createAccount(db, { tag: `${opts.tag}-admin`, role: 'ADMIN' });
  const classroom = await createClassroom(db, {
    tag: opts.tag,
    ownerAdminId: admin.user.id,
    windows: opts.windows ?? 'open',
  });
  const student = await createStudent(db, {
    tag: `${opts.tag}-stu`,
    classroomId: classroom.id,
    ownerAdminId: admin.user.id,
    name: 'Sam Student',
  });
  const sandboxId = student.sandbox.id;
  const names = {
    partner: 'Shell Test Agency',
    advertiser: 'Monsoon Footwear Store',
    campaign: 'Festive Sale',
  };
  const partner = await db.partner.create({ data: { sandboxId, name: names.partner } });
  const advertiser = await db.advertiser.create({
    data: {
      sandboxId,
      partnerId: partner.id,
      name: names.advertiser,
      websiteUrl: 'https://example.test',
      currencyCode: 'INR',
      timeZone: 'Asia/Kolkata',
      status: opts.paused ? 'PAUSED' : 'ACTIVE',
    },
  });
  const campaign = await db.campaign.create({
    data: {
      sandboxId,
      advertiserId: advertiser.id,
      name: names.campaign,
      plannedStart: new Date('2026-01-01T00:00:00Z'),
    },
  });
  const io = await db.insertionOrder.create({
    data: {
      sandboxId,
      campaignId: campaign.id,
      advertiserId: advertiser.id,
      name: 'Festive IO',
      objective: 'CLICKS',
    },
  });
  const li = await db.lineItem.create({
    data: {
      sandboxId,
      ioId: io.id,
      campaignId: campaign.id,
      advertiserId: advertiser.id,
      name: 'Festive display LI',
      type: 'DISPLAY',
    },
  });
  const audience = await db.audience.create({
    data: { sandboxId, advertiserId: advertiser.id, name: 'Lookalike buyers', type: 'LOOKALIKE' },
  });
  if (opts.role && opts.role !== 'STANDARD') {
    await db.userAccessGrant.create({
      data: { userId: student.user.id, sandboxId, partnerId: partner.id, role: opts.role },
    });
  }
  return {
    email: student.user.email,
    password: student.password,
    userIds: [admin.user.id, student.user.id],
    classroomId: classroom.id,
    sandboxId,
    rows: { advertiserId: advertiser.id },
    ids: {
      pid: partner.publicId.toString(),
      aid: advertiser.publicId.toString(),
      cid: campaign.publicId.toString(),
      ioId: io.publicId.toString(),
      liId: li.publicId.toString(),
      x: audience.publicId.toString(),
    },
    names,
  };
}

/** Fill the placeholders of a route-table path. `{kind}` is `instant` for reports and `lookalike` for audiences. */
export function fillPath(path: string, ids: ShellWorld['ids']): string {
  const kind = path.includes('/reporting/') ? 'instant' : 'lookalike';
  return path
    .replace('{pid}', ids.pid)
    .replace('{aid}', ids.aid)
    .replace('{cid}', ids.cid)
    .replace('{ioId}', ids.ioId)
    .replace('{liId}', ids.liId)
    .replace('{kind}', kind)
    .replace('{x}', ids.x);
}
