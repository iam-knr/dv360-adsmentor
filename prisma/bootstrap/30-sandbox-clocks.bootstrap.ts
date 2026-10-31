// Resumes the student sandboxes that have been PAUSED since provisioning (docs/gaps/sim-clock-runs.md). Runs on every
// deploy, so it is idempotent: the first run resumes, a marker in AppMeta records that, and a Super admin pause (its own
// marker) is never undone. Skipped outside production unless SANDBOX_RESUME_EXISTING=1, so local demo and e2e sandboxes
// keep a stable clock.
import { prisma } from '@/lib/db';
import { isProductionEnvironment } from '@/lib/seed/guard';
import { resumeExistingSandboxes } from '@/lib/sandbox/clock-run';

export async function run(): Promise<void> {
  const on = isProductionEnvironment(process.env) || process.env.SANDBOX_RESUME_EXISTING === '1';
  if (!on) {
    console.log('  sandbox clocks: skipped (not production; SANDBOX_RESUME_EXISTING=1 to run)');
    return;
  }
  await resumeExistingSandboxes(prisma, { log: console.log });
}
