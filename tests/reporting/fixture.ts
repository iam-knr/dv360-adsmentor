// A seeded starter-agency sandbox for the reporting db tests (history stub, 90 days).
import { prisma, withSandbox, type Tx } from '@/lib/db';
import { seedReferenceData } from '@/lib/seed/reference-db';
import { provisionSandbox } from '@/lib/seed/sandbox';
import { clearSandboxData } from '@/lib/seed/write';
import type { ReportDefinition } from '@/lib/reporting/types';

export const TODAY = '2026-10-28';

export interface Seeded {
  sandboxId: string;
  classroomId: string;
  ownerId: string;
  partnerId: string;
  partnerPublicId: string;
  inSandbox: <T>(fn: (tx: Tx) => Promise<T>) => Promise<T>;
  def: (over?: Partial<ReportDefinition>) => ReportDefinition;
  cleanup: () => Promise<void>;
}

export async function seedSandbox(tag: string, today = TODAY): Promise<Seeded> {
  await seedReferenceData(prisma);
  const owner = await prisma.user.create({
    data: { email: `${tag}-${Date.now()}@example.test`, name: `${tag} admin`, appRole: 'ADMIN' },
  });
  const classroom = await prisma.classroom.create({
    data: { name: `${tag} class`, code: `${tag}-${Date.now()}`, ownerAdminId: owner.id },
  });
  const r = await provisionSandbox(prisma, {
    classroomId: classroom.id,
    ownerUserId: null,
    name: `${tag} seeded`,
    template: 'starter-agency',
    kind: 'DEMO',
    seedValue: 909,
    partnerName: `${tag} partner`,
    today,
  });
  const partner = await prisma.partner.findFirstOrThrow({ where: { sandboxId: r.sandboxId } });
  const inSandbox = <T>(fn: (tx: Tx) => Promise<T>) =>
    withSandbox(r.sandboxId, fn, { timeout: 120_000 });
  return {
    sandboxId: r.sandboxId,
    classroomId: classroom.id,
    ownerId: owner.id,
    partnerId: partner.id,
    partnerPublicId: String(partner.publicId),
    inSandbox,
    def: (over = {}) => ({
      kind: 'INSTANT',
      name: 'Test report',
      timeZone: 'ADVERTISER',
      dateRange: 'LAST_30_DAYS',
      filters: [{ field: 'partner', op: 'IN', values: [String(partner.publicId)] }],
      dimensions: ['advertiser'],
      metrics: ['impressions'],
      viz: { type: 'TABLE' },
      ...over,
    }),
    cleanup: async () => {
      await prisma.$transaction((tx) => clearSandboxData(tx, r.sandboxId), { timeout: 60_000 });
      await prisma.sandbox.deleteMany({ where: { classroomId: classroom.id } });
      await prisma.classroom.deleteMany({ where: { id: classroom.id } });
      await prisma.user.deleteMany({ where: { id: owner.id } });
    },
  };
}
