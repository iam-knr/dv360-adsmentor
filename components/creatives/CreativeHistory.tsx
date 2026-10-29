'use client';

// Creative History tab (module 12 S5): a filterable table, not day cards. Date · User · Change, 25 per page; the
// change cell is the summary and expands to one line per entry.
import { useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import { DvFilterBar, type FilterField, type FilterValue } from '@/components/dv/DvFilterBar';
import { DvIcon } from '@/components/icons';
import type { HistoryRow } from '@/lib/creatives/types';

const FIELDS: FilterField[] = [
  { id: 'user', label: 'User', type: 'text' },
  { id: 'field', label: 'Field', type: 'text' },
];

const when = (iso: string) => new Date(iso).toLocaleString('en-GB');

export function CreativeHistory({
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
  const [open, setOpen] = useState<Set<string>>(new Set());

  const go = (next: FilterValue[], nextPage: number) => {
    const qs = new URLSearchParams(search.toString());
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
      <Box
        component="table"
        aria-label="Creative history"
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
            <th style={{ width: 40 }} />
            <th>Date</th>
            <th>User</th>
            <th>Change</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={4}>No changes found.</td>
            </tr>
          ) : (
            rows.map((r) => {
              const expanded = open.has(r.id);
              return (
                <tr key={r.id} data-testid="history-row">
                  <td>
                    <IconButton
                      size="small"
                      aria-label={expanded ? 'Collapse change' : 'Expand change'}
                      aria-expanded={expanded}
                      onClick={() =>
                        setOpen((cur) => {
                          const next = new Set(cur);
                          if (next.has(r.id)) next.delete(r.id);
                          else next.add(r.id);
                          return next;
                        })
                      }
                    >
                      <DvIcon name={expanded ? 'expand_less' : 'expand_more'} size={18} />
                    </IconButton>
                  </td>
                  <td>{when(r.date)}</td>
                  <td>{r.user}</td>
                  <td>
                    <Typography variant="body2">{r.summary}</Typography>
                    {expanded ? (
                      <Box component="ul" sx={{ m: 0, mt: 1, pl: 3 }}>
                        {r.lines.map((l, i) => (
                          <li key={i}>{l}</li>
                        ))}
                      </Box>
                    ) : null}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </Box>
      <Box
        sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 2, mt: 2 }}
      >
        <Typography variant="body2">
          {first} - {last} of {total}
        </Typography>
        <Button size="small" disabled={page <= 1} onClick={() => go(filters, page - 1)}>
          Previous
        </Button>
        <Button size="small" disabled={last >= total} onClick={() => go(filters, page + 1)}>
          Next
        </Button>
      </Box>
    </Box>
  );
}
