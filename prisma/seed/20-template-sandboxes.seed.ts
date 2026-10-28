// One DEMO sandbox per seed template (starter-agency, healthy, troubleshooting-lab) in a fixture classroom owned by a
// disabled account. Instructors copy or inspect them; students never sign in to them. Idempotent: a READY sandbox at the
// current seed version is left alone.
import { prisma } from '../../lib/db/client';
import { TEMPLATE_KEYS } from '../../lib/seed/knobs';
import { provisionSandbox, seedValueFor } from '../../lib/seed/sandbox';

const FIXTURE_EMAIL = 'seed-fixtures@sim.adsmetor.invalid';
const FIXTURE_CODE = 'seed-templates';

export async function run(): Promise<void> {
  const owner = await prisma.user.upsert({
    where: { email: FIXTURE_EMAIL },
    update: {},
    create: {
      email: FIXTURE_EMAIL,
      name: 'Seed fixtures',
      appRole: 'ADMIN',
      status: 'DISABLED',
      passwordHash: null,
    },
  });
  const classroom = await prisma.classroom.upsert({
    where: { code: FIXTURE_CODE },
    update: {},
    create: {
      name: 'Seed templates',
      code: FIXTURE_CODE,
      ownerAdminId: owner.id,
      defaultSeedTemplate: 'starter-agency',
    },
  });
  for (const template of TEMPLATE_KEYS) {
    const result = await provisionSandbox(prisma, {
      classroomId: classroom.id,
      ownerUserId: null,
      name: `Template ${template}`,
      template,
      kind: 'DEMO',
      seedValue: seedValueFor(`template:${template}`),
      partnerName: `Sandbox ${template.toUpperCase()}`,
    });
    console.log(
      result.built
        ? `  ${template}: built in ${result.ms} ms, ${JSON.stringify(result.rows)}`
        : `  ${template}: up to date`,
    );
  }
}
