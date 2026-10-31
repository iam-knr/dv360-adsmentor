'use client';

// Plans list (module 04 S1): status chip filter, two header bands, sort, pager, New plan. State lives in the URL
// (`f.status`, `sort`, `rows`, `page`, `q`, RT 6.1); the whole list is loaded once and filtered in the browser.
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import {
  DvEmptyState,
  DvFilterBar,
  DvGrid,
  DvPageHeader,
  type DvColumn,
  type FilterField,
  type FilterValue,
} from '@/components/dv';
import { useViewer } from '@/components/shell/ViewerProvider';
import { AppLink } from '@/lib/routes/AppLink';
import { newPlanPath, planPagePath } from '@/lib/planning/paths';
import type { PlanList } from '@/lib/planning/service';
import { fmtDate } from '@/lib/planning/table';
import type { PlanListRow, PlanStatusKey } from '@/lib/planning/types';

const STATUS_LABEL: Record<PlanStatusKey, string> = {
  PLANNED: 'Planned',
  TRAFFICKED: 'Trafficked',
  ARCHIVED: 'Archived',
};
/** Every status the filter offers; Archived is off by default so the chip reads "Status: 2 selected". */
const ALL: PlanStatusKey[] = ['PLANNED', 'TRAFFICKED', 'ARCHIVED'];
const DEFAULT_STATUS: PlanStatusKey[] = ['PLANNED', 'TRAFFICKED'];
const FIELDS: FilterField[] = [
  {
    id: 'status',
    label: 'Status',
    type: 'multi',
    options: ALL.map((v) => ({ value: v, label: STATUS_LABEL[v] })),
  },
];
type SortId = 'name' | 'startDate' | 'endDate';
type Sort = { id: SortId; dir: 'asc' | 'desc' };

const money = (n: number | null, code: string) =>
  n === null
    ? '-'
    : `${code}${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function readUrl(): { status: PlanStatusKey[]; sort: Sort; rows: number; page: number; q: string } {
  const p = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search);
  const raw = p.getAll('f.status');
  const status = raw.includes('*')
    ? ALL
    : (raw.filter((v) => (ALL as string[]).includes(v)) as PlanStatusKey[]);
  const [sid, sdir] = (p.get('sort') ?? 'name:asc').split(':');
  const sortId: SortId = sid === 'startDate' || sid === 'endDate' ? sid : 'name';
  const rows = Number(p.get('rows'));
  return {
    status: status.length ? status : DEFAULT_STATUS,
    sort: { id: sortId, dir: sdir === 'desc' ? 'desc' : 'asc' },
    rows: [20, 50, 100].includes(rows) ? rows : 20,
    page: Math.max(1, Number(p.get('page')) || 1),
    q: p.get('q') ?? '',
  };
}

export function PlansList({
  partnerId,
  advertiserId,
  initial,
}: {
  partnerId: string;
  advertiserId: string;
  initial: PlanList;
}) {
  const router = useRouter();
  const { viewer } = useViewer();
  const writable = initial.canWrite && !viewer.readOnly;
  const [url] = useState(readUrl);
  const [status, setStatus] = useState<PlanStatusKey[]>(url.status);
  const [sort, setSort] = useState<Sort>(url.sort);
  const [size, setSize] = useState(url.rows);
  const [page, setPage] = useState(url.page);
  const [text, setText] = useState(url.q);
  const [busy, startNew] = useTransition();

  const sync = (next: {
    status: PlanStatusKey[];
    sort: Sort;
    rows: number;
    page: number;
    q: string;
  }) => {
    const p = new URLSearchParams(window.location.search);
    for (const k of ['f.status', 'sort', 'rows', 'page', 'q']) p.delete(k);
    const isDefault =
      next.status.length === DEFAULT_STATUS.length &&
      DEFAULT_STATUS.every((s) => next.status.includes(s));
    if (!isDefault) next.status.forEach((s) => p.append('f.status', s));
    if (next.sort.id !== 'name' || next.sort.dir !== 'asc')
      p.set('sort', `${next.sort.id}:${next.sort.dir}`);
    if (next.rows !== 20) p.set('rows', String(next.rows));
    if (next.page > 1) p.set('page', String(next.page));
    if (next.q.trim()) p.set('q', next.q.trim());
    const qs = p.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`);
  };
  const cur = (over: Partial<ReturnType<typeof readUrl>>) => ({
    status,
    sort,
    rows: size,
    page,
    q: text,
    ...over,
  });

  const filtered = useMemo(() => {
    const q = text.trim().toLowerCase();
    const list = initial.rows.filter(
      (r) =>
        status.includes(r.status) &&
        (!q || r.name.toLowerCase().includes(q) || r.publicId.includes(q)),
    );
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      const av = sort.id === 'name' ? a.name.toLowerCase() : a[sort.id];
      const bv = sort.id === 'name' ? b.name.toLowerCase() : b[sort.id];
      return av < bv ? -dir : av > bv ? dir : 0;
    });
  }, [initial.rows, status, text, sort]);

  const columns: DvColumn<PlanListRow>[] = [
    {
      id: 'name',
      header: 'Name',
      group: 'plan',
      type: 'custom',
      sticky: true,
      width: 280,
      sortable: true,
      cell: (r) => (
        <AppLink href={planPagePath(partnerId, advertiserId, r.publicId)} data-testid="plan-link">
          {r.name}
        </AppLink>
      ),
    },
    { id: 'id', header: 'ID', group: 'plan', accessor: (r) => r.publicId },
    {
      id: 'status',
      header: 'Status',
      group: 'plan',
      accessor: (r) => STATUS_LABEL[r.status],
    },
    {
      id: 'budget',
      header: 'Total Budget',
      group: 'details',
      align: 'right',
      accessor: (r) => money(r.totalBudget, r.currencyCode),
    },
    {
      id: 'startDate',
      header: 'Start date',
      group: 'details',
      sortable: true,
      accessor: (r) => fmtDate(r.startDate),
    },
    {
      id: 'endDate',
      header: 'End date',
      group: 'details',
      sortable: true,
      accessor: (r) => fmtDate(r.endDate),
    },
    {
      id: 'channels',
      header: 'Channels',
      group: 'details',
      accessor: (r) => r.channels.join(', '),
    },
  ];

  // New plan opens the two-step wizard (explore 19 section 3); the plan is saved by "Next: Add products".
  const newPlan = () => startNew(() => router.push(newPlanPath(partnerId, advertiserId)));

  const value: FilterValue[] = [{ fieldId: 'status', values: status }];
  const noPlans = initial.rows.length === 0;

  return (
    <>
      <DvPageHeader
        title="Plans"
        limitedAccess={viewer.limitedAccess}
        actions={
          <Button
            variant="contained"
            disabled={!writable || busy}
            title={writable ? undefined : 'You do not have permission to create plans.'}
            onClick={newPlan}
          >
            New plan
          </Button>
        }
      />
      <Box sx={{ px: 4, py: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <DvFilterBar
          fields={FIELDS}
          value={value}
          text={text}
          placeholder="Search by name or ID"
          onChange={(f, t) => {
            const next = (f.find((x) => x.fieldId === 'status')?.values ?? []) as PlanStatusKey[];
            const s = next.length ? next : DEFAULT_STATUS;
            setStatus(s);
            setText(t);
            setPage(1);
            sync(cur({ status: s, q: t, page: 1 }));
          }}
        />
        <DvGrid<PlanListRow>
          ariaLabel="Plans"
          rows={filtered.slice((page - 1) * size, page * size)}
          columns={columns}
          groups={[
            { id: 'plan', label: 'Plan' },
            { id: 'details', label: 'Details' },
          ]}
          getRowId={(r) => r.id}
          sort={sort}
          onSortChange={(s) => {
            if (!s) return;
            const next = { id: s.id as SortId, dir: s.dir };
            setSort(next);
            sync(cur({ sort: next }));
          }}
          page={page}
          pageSize={size}
          pageSizes={[20, 50, 100]}
          total={filtered.length}
          onPageChange={(p, s) => {
            setPage(p);
            setSize(s);
            sync(cur({ page: p, rows: s }));
          }}
          emptyState={
            noPlans ? (
              <DvEmptyState
                variant="illustrated"
                title="No plans yet"
                message="Create a plan to forecast reach for a budget."
                {...(writable
                  ? { action: { label: 'New plan', onClick: newPlan, primary: true } }
                  : {})}
              />
            ) : (
              <DvEmptyState variant="inline" message="No results." />
            )
          }
        />
      </Box>
    </>
  );
}
