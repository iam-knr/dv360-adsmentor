import type { Metadata } from 'next';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { DvPageHeader } from '@/components/dv/DvPageHeader';
import { ClassPicker } from '@/components/instructor/ClassPicker';
import { SandboxesView } from '@/components/instructor/SandboxesView';
import { pageActor } from '@/lib/accounts/session-actor';
import { prisma } from '@/lib/db';
import { orNotFound } from '@/lib/instructor/page';
import { myClasses } from '@/lib/instructor/scope';
import { getSandboxRows } from '@/lib/instructor/student';

export const metadata: Metadata = { title: 'Sandboxes | DV360 Simulator by Adsmetor' };
export const dynamic = 'force-dynamic';
// A reset of a whole class runs the seed pipeline for every student inside the request.
export const maxDuration = 300;

export default async function SandboxesPage({ searchParams }: { searchParams: Promise<{ class?: string }> }) {
  const actor = await pageActor();
  const sp = await searchParams;
  const classes = await myClasses(prisma, actor);
  const pick = classes.find((c) => c.id === sp.class) ?? classes[0];
  if (!pick) {
    return (
      <Box>
        <DvPageHeader title="Sandboxes" />
        <Typography>You do not teach a class yet.</Typography>
      </Box>
    );
  }
  const data = await orNotFound(() => getSandboxRows(actor, pick.id));
  return (
    <Box>
      <DvPageHeader
        title="Sandboxes"
        actions={<ClassPicker classes={classes.map((c) => ({ id: c.id, name: c.name }))} value={pick.id} />}
      />
      <SandboxesView classId={pick.id} className={data.className} items={data.items} />
    </Box>
  );
}
