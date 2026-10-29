import type { Metadata } from 'next';
import Box from '@mui/material/Box';
import { DvPageHeader } from '@/components/dv/DvPageHeader';
import { listAudit } from '@/lib/accounts/service';
import { pageActor } from '@/lib/accounts/session-actor';
import { formatDateTime } from '@/lib/auth/messages';

export const metadata: Metadata = { title: 'Audit log | DV360 Simulator by Adsmetor' };

export default async function AuditPage() {
  const actor = await pageActor();
  const rows = await listAudit(actor);
  return (
    <Box>
      <DvPageHeader title="Audit log" />
      <Box
        component="table"
        sx={{
          borderCollapse: 'collapse',
          width: '100%',
          '& td, & th': { textAlign: 'left', p: 2, borderBottom: 1, borderColor: 'divider' },
        }}
      >
        <thead>
          <tr>
            <th>When</th>
            <th>Action</th>
            <th>Result</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{formatDateTime(r.createdAt)}</td>
              <td>{r.action}</td>
              <td>{r.result === 'DENIED' ? 'Denied' : 'OK'}</td>
              <td>{r.payload ? JSON.stringify(r.payload) : ''}</td>
            </tr>
          ))}
        </tbody>
      </Box>
    </Box>
  );
}
