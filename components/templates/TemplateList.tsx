'use client';

// Targeting templates list (module 10 2.7): Name, Type, Description, Last modified, Status; filter Active / Archived /
// All, search, New, row menu with Archive and Unarchive. Empty state with New targeting template.
import { formatMediumDate } from '@/lib/date-format';
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import {
  DvEmptyState,
  DvGrid,
  DvPageHeader,
  DvSelect,
  DvTextField,
  type DvColumn,
} from '@/components/dv';
import { AppLink } from '@/lib/routes/AppLink';
import { advertiserPath } from '@/lib/routes/paths';
import { setTemplateStatusAction } from '@/lib/templates/actions';
import type { TemplateList as TemplateListData, TemplateRow } from '@/lib/templates/service';

export function TemplateList({
  partnerId,
  advertiserId,
  data,
}: {
  partnerId: string;
  advertiserId: string;
  data: TemplateListData;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<'ACTIVE' | 'ARCHIVED' | 'ALL'>('ACTIVE');
  const [q, setQ] = useState('');
  const [page, setPage] = useState({ page: 1, size: 20 });
  const [, startTransition] = useTransition();
  const newHref = advertiserPath(partnerId, advertiserId, 'templates', 'new');

  const shown = useMemo(
    () =>
      data.rows.filter(
        (r) =>
          (status === 'ALL' || r.status === status) &&
          (q.trim() === '' ||
            r.name.toLowerCase().includes(q.trim().toLowerCase()) ||
            r.publicId === q.trim()),
      ),
    [data.rows, status, q],
  );
  const flip = (r: TemplateRow) =>
    startTransition(async () => {
      const res = await setTemplateStatusAction(
        advertiserId,
        r.publicId,
        r.status === 'ARCHIVED' ? 'ACTIVE' : 'ARCHIVED',
      );
      if (res.ok) router.refresh();
    });

  const columns: DvColumn<TemplateRow>[] = [
    {
      id: 'name',
      header: 'Name',
      sticky: true,
      cell: (r) => (
        <AppLink href={advertiserPath(partnerId, advertiserId, 'templates', r.publicId)}>
          {r.name}
        </AppLink>
      ),
    },
    { id: 'typeLabel', header: 'Type' },
    { id: 'description', header: 'Description' },
    {
      id: 'lastModified',
      header: 'Last modified',
      accessor: (r) => formatMediumDate(r.lastModified),
    },
    {
      id: 'status',
      header: 'Status',
      accessor: (r) => (r.status === 'ARCHIVED' ? 'Archived' : 'Active'),
    },
    {
      id: 'actions',
      header: '',
      width: 120,
      cell: (r) =>
        data.canWrite ? (
          <Button size="small" variant="text" onClick={() => flip(r)}>
            {r.status === 'ARCHIVED' ? 'Unarchive' : 'Archive'}
          </Button>
        ) : null,
    },
  ];

  return (
    <>
      <DvPageHeader
        title="Targeting templates"
        limitedAccess={data.limitedAccess}
        actions={
          data.canWrite ? (
            <Button variant="contained" component="a" href={newHref}>
              New
            </Button>
          ) : null
        }
      />
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', p: 2 }}>
        <Box sx={{ width: 200 }}>
          <DvSelect
            small
            ariaLabel="Status filter"
            value={status}
            onChange={(v) => {
              setStatus(v as typeof status);
              setPage({ ...page, page: 1 });
            }}
            options={[
              { value: 'ACTIVE', label: 'Status: Active' },
              { value: 'ARCHIVED', label: 'Status: Archived' },
              { value: 'ALL', label: 'Status: All' },
            ]}
          />
        </Box>
        <Box sx={{ width: 280 }}>
          <DvTextField
            ariaLabel="Search templates"
            placeholder="Search by name or ID"
            value={q}
            onChange={setQ}
          />
        </Box>
      </Box>
      <DvGrid
        ariaLabel="Targeting templates"
        rows={shown.slice((page.page - 1) * page.size, page.page * page.size)}
        columns={columns}
        getRowId={(r) => r.publicId}
        isArchived={(r) => r.status === 'ARCHIVED'}
        page={page.page}
        pageSize={page.size}
        total={shown.length}
        onPageChange={(p, size) => setPage({ page: p, size })}
        emptyState={
          <DvEmptyState
            variant="illustrated"
            title="No targeting templates"
            message="Streamline your line item setup with targeting templates."
            {...(data.canWrite
              ? {
                  action: {
                    label: 'New targeting template',
                    onClick: () => router.push(newHref),
                    primary: true,
                  },
                }
              : {})}
          />
        }
      />
    </>
  );
}
