import type { Metadata } from 'next';
import Box from '@mui/material/Box';
import { DvPageHeader } from '@/components/dv/DvPageHeader';
import { CertificateRequests } from '@/components/instructor/CertificateRequests';
import { pageActor } from '@/lib/accounts/session-actor';
import { listCertificateRequests } from '@/lib/instructor/certificates';
import { formatWhen } from '@/lib/instructor/format';

export const metadata: Metadata = { title: 'Requests | DV360 Simulator by Adsmetor' };
export const dynamic = 'force-dynamic';

export default async function RequestsPage() {
  const actor = await pageActor();
  const rows = await listCertificateRequests(actor);
  return (
    <Box>
      <DvPageHeader title="Requests" />
      <CertificateRequests
        items={rows.map((r) => ({
          id: r.id,
          className: r.className,
          studentName: r.studentName,
          advertiserName: r.advertiserName,
          title: r.title,
          countryCode: r.countryCode,
          notes: r.notes ?? '',
          requested: formatWhen(r.requestedAt),
        }))}
      />
    </Box>
  );
}
