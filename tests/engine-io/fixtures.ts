// Shared setup for the engine runtime db tests: a classroom with seeded starter-agency sandboxes.
import { prisma } from '@/lib/db';
import { seedReferenceData } from '@/lib/seed/reference-db';
import { provisionSandbox } from '@/lib/seed/sandbox';
import { clearSandboxData } from '@/lib/seed/write';

export const TODAY = '2026-10-28';

export interface Env {
  classroomId: string;
  ownerId: string;
  sandboxIds: string[];
}

let counter = 0;

/** Seeds reference data and `count` starter-agency sandboxes with different seed values. */
export async function createEnv(count: number, tag: string): Promise<Env> {
  await seedReferenceData(prisma);
  const stamp = `${Date.now().toString(36)}${(counter++).toString(36)}`;
  const owner = await prisma.user.create({
    data: {
      email: `eng-io-${tag}-${stamp}@example.test`,
      name: `Engine io ${tag}`,
      appRole: 'ADMIN',
    },
  });
  const classroom = await prisma.classroom.create({
    data: {
      name: `Engine io ${tag} ${stamp}`,
      code: `EIO-${stamp}`.toUpperCase(),
      ownerAdminId: owner.id,
    },
  });
  const sandboxIds: string[] = [];
  for (let i = 0; i < count; i++) {
    const r = await provisionSandbox(prisma, {
      classroomId: classroom.id,
      ownerUserId: null,
      name: `Engine io ${tag} ${i}`,
      template: 'starter-agency',
      kind: 'DEMO',
      seedValue: 9100 + i,
      partnerName: `Sandbox EIO-${i}`,
      today: TODAY,
    });
    sandboxIds.push(r.sandboxId);
  }
  return { classroomId: classroom.id, ownerId: owner.id, sandboxIds };
}

export async function dropEnv(env: Env): Promise<void> {
  for (const id of env.sandboxIds) {
    await prisma.$transaction((tx) => clearSandboxData(tx, id), { timeout: 120_000 });
    await prisma.$executeRawUnsafe(`DELETE FROM "SimState" WHERE "sandboxId" = $1`, id);
    await prisma.$executeRawUnsafe(`DELETE FROM "SimJob" WHERE "sandboxId" = $1`, id);
    await prisma.$executeRawUnsafe(`DELETE FROM "SimTickLog" WHERE "sandboxId" = $1`, id);
    await prisma.sandbox.delete({ where: { id } }).catch(() => undefined);
  }
  await prisma.classroom.delete({ where: { id: env.classroomId } }).catch(() => undefined);
  await prisma.user.delete({ where: { id: env.ownerId } }).catch(() => undefined);
}

/** Row counts and a checksum over every table the engine writes for a sandbox. */
export async function fingerprint(sandboxId: string): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const tables: [string, string][] = [
    ['SimHourlyMetric', `"lineItemId", "simHour"`],
    ['SimDailyMetric', `"lineItemId", "simDate", "sliceKind", "sliceKey"`],
    ['DeliveryDiagnostic', `"lineItemId", "date", "exchangeId", "reasonCode"`],
    ['SimPacingSnapshot', `"budgetSegmentId", "simDate"`],
    ['SimReachSnapshot', `"scopeId", "simDate", "windowDays"`],
    ['Alert', `"diagnosticCode", "lineItemId", "ioId", "firstSeenAt"`],
    ['SimState', `"scope", "entityId"`],
  ];
  for (const [table, order] of tables) {
    const rows = await prisma.$queryRawUnsafe<{ n: number; h: string }[]>(
      `SELECT count(*)::int AS n, coalesce(md5(string_agg((to_jsonb(t) - 'id' - 'updatedAt')::text, '|' ORDER BY ${order})), '') AS h
       FROM "${table}" t WHERE "sandboxId" = $1`,
      sandboxId,
    );
    out[table] = `${rows[0]?.n}:${rows[0]?.h}`;
  }
  return out;
}

/** The tick index the seed leaves the clock at (history days x 24). */
export async function startTick(sandboxId: string): Promise<number> {
  const c = await prisma.simClock.findUniqueOrThrow({ where: { sandboxId } });
  return Number(c.tickIndex);
}

/**
 * Puts a sandbox back to the state it had right after seeding: engine rows from the sim day `TODAY` on are deleted, the
 * state and the ledger are cleared and the clock returns to `tickIndex`. Seeded history (earlier dates) is untouched.
 */
export async function rewind(sandboxId: string, tickIndex: number, today = TODAY): Promise<void> {
  const q = (sql: string) => prisma.$executeRawUnsafe(sql, sandboxId, today);
  await q(`DELETE FROM "SimHourlyMetric" WHERE "sandboxId" = $1 AND "simHour" >= $2::date`);
  await q(`DELETE FROM "SimDailyMetric" WHERE "sandboxId" = $1 AND "simDate" >= $2::date`);
  await q(`DELETE FROM "DeliveryDiagnostic" WHERE "sandboxId" = $1 AND "date" >= $2::date`);
  await q(`DELETE FROM "SimPacingSnapshot" WHERE "sandboxId" = $1 AND "simDate" >= $2::date`);
  await q(`DELETE FROM "SimReachSnapshot" WHERE "sandboxId" = $1 AND "simDate" >= $2::date`);
  await q(`DELETE FROM "Alert" WHERE "sandboxId" = $1 AND "firstSeenAt" > $2::date`);
  await prisma.$executeRawUnsafe(`DELETE FROM "SimState" WHERE "sandboxId" = $1`, sandboxId);
  await prisma.$executeRawUnsafe(`DELETE FROM "SimTickLog" WHERE "sandboxId" = $1`, sandboxId);
  await prisma.simClock.update({
    where: { sandboxId },
    data: {
      tickIndex: BigInt(tickIndex),
      state: 'PAUSED',
      remainderMs: 0,
      lastAdvanceRealAt: null,
    },
  });
}
