// Retention (RC-024): hourly rows are kept for the last 14 sim days; daily rows stay for the life of the sandbox.
import type { Tx } from '@/lib/db';

export const HOURLY_RETENTION_DAYS = 14;
const CHUNK = 50_000;

/** Deletes hourly rows older than the retention window before `simNowMs`. Returns the number of rows removed. */
export async function trimHourly(tx: Tx, sandboxId: string, simNowMs: number): Promise<number> {
  const cutoff = new Date(simNowMs - HOURLY_RETENTION_DAYS * 86_400_000);
  let total = 0;
  for (;;) {
    const n = await tx.$executeRaw`
      DELETE FROM "SimHourlyMetric"
      WHERE "id" IN (
        SELECT "id" FROM "SimHourlyMetric"
        WHERE "sandboxId" = ${sandboxId} AND "simHour" < ${cutoff}::timestamp
        LIMIT ${CHUNK})`;
    total += n;
    if (n < CHUNK) return total;
  }
}
