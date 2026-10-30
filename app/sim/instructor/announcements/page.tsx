import type { Metadata } from 'next';
import Box from '@mui/material/Box';
import { DvPageHeader } from '@/components/dv/DvPageHeader';
import { AnnouncementsView } from '@/components/instructor/AnnouncementsView';
import { pageActor } from '@/lib/accounts/session-actor';
import { prisma } from '@/lib/db';
import { listAnnouncements } from '@/lib/instructor/announcements';
import { formatWhen } from '@/lib/instructor/format';
import { myClasses } from '@/lib/instructor/scope';

export const metadata: Metadata = { title: 'Announcements | DV360 Simulator by Adsmetor' };
export const dynamic = 'force-dynamic';

export default async function AnnouncementsPage() {
  const actor = await pageActor();
  const [classes, rows] = await Promise.all([myClasses(prisma, actor), listAnnouncements(actor)]);
  const classIdByName = new Map(classes.map((c) => [c.name, c.id]));
  return (
    <Box>
      <DvPageHeader title="Announcements" />
      <AnnouncementsView
        classes={classes.map((c) => ({ id: c.id, name: c.name }))}
        canPlatformWide={actor.role === 'SUPER_ADMIN'}
        items={rows.map((r) => ({
          id: r.id,
          title: r.title,
          body: r.body,
          className: r.className,
          classId: classIdByName.get(r.className) ?? null,
          when: formatWhen(r.publishedAt),
          expired: r.expired,
        }))}
      />
    </Box>
  );
}
