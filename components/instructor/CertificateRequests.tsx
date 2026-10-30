'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { DvBanner } from '@/components/dv/DvBanner';
import { DvEmptyState } from '@/components/dv/DvEmptyState';
import { DvGrid, type DvColumn } from '@/components/dv/DvGrid';
import { DvModal } from '@/components/dv/DvModal';
import { DvTextField } from '@/components/dv/DvTextField';
import { decideCertificateAction } from '@/lib/instructor/actions';

export interface CertificateItem {
  id: string;
  className: string;
  studentName: string;
  advertiserName: string;
  title: string;
  countryCode: string;
  notes: string;
  requested: string;
}

/** Policy certificate requests of the students (module 03 T09). Approve, or reject with a reason. */
export function CertificateRequests({ items }: { items: CertificateItem[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | undefined>();
  const row = items.find((i) => selection.has(i.id)) ?? null;

  const decide = (decision: 'APPROVED' | 'REJECTED') =>
    start(async () => {
      if (!row) return;
      setError(undefined);
      const r = await decideCertificateAction(row.id, decision, reason);
      if (!r.ok) return setError(r.error);
      setRejecting(false);
      setReason('');
      setSelection(new Set());
      router.refresh();
    });

  const columns: DvColumn<CertificateItem>[] = [
    { id: 'studentName', header: 'Student', width: 180, sticky: true },
    { id: 'className', header: 'Class', width: 160 },
    { id: 'advertiserName', header: 'Advertiser', width: 200 },
    { id: 'title', header: 'Certificate', width: 220 },
    { id: 'countryCode', header: 'Country', width: 90 },
    { id: 'notes', header: 'Notes', width: 220 },
    { id: 'requested', header: 'Requested', width: 160 },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 2, mb: 3, alignItems: 'center' }}>
        <Button variant="contained" disabled={!row || pending} onClick={() => decide('APPROVED')}>
          Approve
        </Button>
        <Button variant="outlined" disabled={!row || pending} onClick={() => setRejecting(true)}>
          Reject
        </Button>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Certificates are informational in the simulator. The student sees your decision in Policy center.
        </Typography>
      </Box>
      {error && !rejecting ? <DvBanner kind="error">{error}</DvBanner> : null}
      <DvGrid
        ariaLabel="Certificate requests"
        rows={items}
        columns={columns}
        getRowId={(r) => r.id}
        selection={selection}
        onSelectionChange={(s) => setSelection(new Set([...s].slice(-1)))}
        page={1}
        pageSize={Math.max(items.length, 20)}
        total={items.length}
        onPageChange={() => undefined}
        emptyState={<DvEmptyState variant="inline" message="No requests waiting." />}
      />
      <DvModal
        open={rejecting}
        title="Reject request?"
        onClose={() => setRejecting(false)}
        error={error}
        primary={{ label: 'Reject', tone: 'danger', loading: pending, onClick: () => decide('REJECTED') }}
        secondary={{ label: 'Cancel', onClick: () => setRejecting(false) }}
      >
        <Box sx={{ pt: 2 }}>
          <DvTextField label="Reason (shown to the student)" value={reason} onChange={setReason} maxLength={500} />
        </Box>
      </DvModal>
    </Box>
  );
}
