'use client';

// Deal History tab (module 13 S4): the shared change history for `entityType = DEAL` as Date · User · Change.
import { useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import { DvEmptyState, DvFilterBar, type FilterField, type FilterValue } from '@/components/dv';
import type { HistoryRow } from '@/lib/creatives/types';

const FIELDS: FilterField[] = [
  { id: 'user', label: 'User', type: 'text' },
  { id: 'field', label: 'Field', type: 'text' },
];

const when = (iso: string) => new Date(iso).toLocaleString('en-GB');

export function DealHistory({
  rows,
  total,
  page,
  pageSize,
  initialFilters,
}: {
  rows: HistoryRow[];
  total: number;
  page: number;
  pageSize: number;
  initialFilters: FilterValue[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [filters, setFilters] = useState<FilterValue[]>(initialFilters);
  const [text, setText] = useState('');

  const go = (next: FilterValue[], nextPage: number) => {
    const qs = new URLSearchParams(search?.toString() ?? '');
    qs.set('activeTab', 'historyTab');
    for (const f of FIELDS) qs.delete(f.id);
    for (const f of next) if (f.values[0]) qs.set(f.fieldId, f.values[0]);
    qs.set('page', String(nextPage));
    router.replace(`${pathname}?${qs.toString()}`, { scroll: false });
  };
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(total, page * pageSize);
  return (
    <Box>
      <Box sx={{ mb: 2 }}>
        <DvFilterBar
          fields={FIELDS}
          value={filters}
          text={text}
          ariaLabel="History filters"
          onChange={(v, t) => {
            setFilters(v);
            setText(t);
            go(v, 1);
          }}
        />
      </Box>
      {rows.length === 0 ? (
        <DvEmptyState variant="inline" message="No changes recorded for this deal yet." />
      ) : (
        <Box
          component="table"
          aria-label="Deal history"
          sx={{
            width: '100%',
            borderCollapse: 'collapse',
            '& th, & td': {
              textAlign: 'left',
              p: 1.5,
              borderBottom: '1px solid',
              borderColor: 'divider',
              verticalAlign: 'top',
            },
          }}
        >
          <thead>
            <tr>
              <th>Date</th>
              <th>User</th>
              <th>Change</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} data-testid="history-row">
                <td style={{ whiteSpace: 'nowrap' }}>{when(r.date)}</td>
                <td>{r.user}</td>
                <td>
                  <div>{r.summary}</div>
                  {r.lines.map((l, i) => (
                    <Box key={i} sx={{ color: 'text.secondary', typography: 'body2' }}>
                      {l}
                    </Box>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </Box>
      )}
      <Box
        sx={{ display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'flex-end', mt: 2 }}
      >
        <span>{`${first}-${last} of ${total}`}</span>
        <Button disabled={page <= 1} onClick={() => go(filters, page - 1)}>
          Previous
        </Button>
        <Button disabled={last >= total} onClick={() => go(filters, page + 1)}>
          Next
        </Button>
      </Box>
    </Box>
  );
}
