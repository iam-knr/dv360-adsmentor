import type { Metadata } from 'next';
import Box from '@mui/material/Box';
import { DvPageHeader } from '@/components/dv/DvPageHeader';
import { ClassControls } from '@/components/instructor/ClassControls';
import { WindowsView, type WindowItem } from '@/components/instructor/WindowsView';
import { pageActor } from '@/lib/accounts/session-actor';
import { localDateOf, localTimeOf } from '@/lib/instructor/recurrence';
import { orNotFound } from '@/lib/instructor/page';
import { listWindows } from '@/lib/instructor/windows';

export const metadata: Metadata = { title: 'Access windows | DV360 Simulator by Adsmetor' };
export const dynamic = 'force-dynamic';

export default async function AccessPage({ params }: { params: Promise<{ classId: string }> }) {
  const actor = await pageActor();
  const { classId } = await params;
  const now = new Date();
  const data = await orNotFound(() => listWindows(actor, classId, now));
  const items: WindowItem[] = data.windows.map((w) => ({
    id: w.id,
    label: w.label,
    opensAt: w.opensAt.toISOString(),
    closesAt: w.closesAt.toISOString(),
    status: w.status,
    seriesId: w.seriesId,
    note: w.note,
    live: w.live,
    date: localDateOf(w.opensAt, data.timeZone),
    startTime: localTimeOf(w.opensAt, data.timeZone),
    endTime: localTimeOf(w.closesAt, data.timeZone),
  }));
  return (
    <Box>
      <DvPageHeader title={`Access windows: ${data.className}`} actions={<ClassControls classId={classId} open={data.windows.some((w) => w.live)} />} />
      <WindowsView classId={classId} timeZone={data.timeZone} windows={items} today={localDateOf(now, data.timeZone)} />
    </Box>
  );
}
