'use client';

// Experiments page (module 17 S1, S2): tabs A/B tests and Lift studies, Create new, the two tables with their actions.
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import { DvEmptyState, DvGrid, DvPageHeader, DvTabs, useToast, type DvColumn } from '@/components/dv';
import { useViewer } from '@/components/shell/ViewerProvider';
import { addLiftFlightAction, endAbTestAction, endLiftStudyAction } from '@/lib/experiments/actions';
import {
  abReportPath,
  experimentsPath,
  liftEditPath,
  liftReportPath,
  liftStudiesPath,
  newAbPath,
  newLiftPath,
} from '@/lib/experiments/paths';
import type { AbList, AbRow, LiftFlightRow, LiftList, LiftRow } from '@/lib/experiments/types';
import { AppLink } from '@/lib/routes/AppLink';
import { EndDialog } from './EndDialog';
import { dateRangeText, LIFT_STATUS_LABEL, STATUS_AB } from './format';

export function ExperimentsHub({
  partnerId,
  advertiserId,
  tab,
  ab,
  lift,
}: {
  partnerId: string;
  advertiserId: string;
  tab: 'ab' | 'lift';
  ab?: AbList;
  lift?: LiftList;
}) {
  const router = useRouter();
  const { viewer } = useViewer();
  const canWrite = (tab === 'ab' ? ab?.canWrite : lift?.canWrite) && !viewer.readOnly;
  return (
    <>
      <DvPageHeader
        title="Experiments"
        limitedAccess={viewer.limitedAccess}
        actions={
          <Button
            variant="contained"
            disabled={!canWrite}
            title={canWrite ? undefined : 'You do not have permission to create experiments.'}
            onClick={() => router.push(tab === 'ab' ? newAbPath(partnerId, advertiserId) : newLiftPath(partnerId, advertiserId))}
          >
            Create new
          </Button>
        }
      >
        <DvTabs
          variant="page"
          value={tab}
          onChange={(t) => router.push(t === 'ab' ? experimentsPath(partnerId, advertiserId) : liftStudiesPath(partnerId, advertiserId))}
          ariaLabel="Experiments"
          tabs={[
            { id: 'ab', label: 'A/B tests' },
            { id: 'lift', label: 'Lift studies' },
          ]}
        />
      </DvPageHeader>
      <Box sx={{ px: 4, py: 2 }}>
        {tab === 'ab' && ab ? (
          <AbTable partnerId={partnerId} advertiserId={advertiserId} data={ab} writable={!!canWrite} />
        ) : lift ? (
          <LiftTable partnerId={partnerId} advertiserId={advertiserId} data={lift} writable={!!canWrite} />
        ) : null}
      </Box>
    </>
  );
}

function AbTable({ partnerId, advertiserId, data, writable }: { partnerId: string; advertiserId: string; data: AbList; writable: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(20);
  const [ending, setEnding] = useState<AbRow | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [busy, start] = useTransition();

  const columns: DvColumn<AbRow>[] = [
    {
      id: 'name',
      header: 'Test name',
      type: 'custom',
      sticky: true,
      width: 320,
      cell: (r) => (
        <Box>
          <AppLink href={abReportPath(partnerId, advertiserId, r.publicId)} data-testid="ab-link">
            {r.name}
          </AppLink>
          <Typography variant="caption" color="text.secondary" display="block">{`ID: ${r.publicId}`}</Typography>
        </Box>
      ),
    },
    { id: 'participants', header: 'Participants', accessor: (r) => `${r.arms} arms` },
    {
      id: 'status',
      header: 'Status',
      type: 'custom',
      width: 280,
      cell: (r) => (
        <Box>
          <Chip size="small" label={STATUS_AB[r.status]} color={r.status === 'ACTIVE' ? 'success' : 'default'} />
          <Typography variant="caption" color="text.secondary" display="block">
            {dateRangeText(r.startDate, r.endDate)}
          </Typography>
        </Box>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      type: 'custom',
      width: 200,
      cell: (r) => (
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button size="small" component={AppLink} href={abReportPath(partnerId, advertiserId, r.publicId)}>
            View report
          </Button>
          <Button size="small" disabled={!writable || r.status === 'COMPLETED'} onClick={() => setEnding(r)}>
            End
          </Button>
        </Box>
      ),
    },
  ];

  return (
    <>
      <DvGrid<AbRow>
        ariaLabel="A/B tests"
        rows={data.rows.slice((page - 1) * size, page * size)}
        columns={columns}
        getRowId={(r) => r.id}
        page={page}
        pageSize={size}
        pageSizes={[20, 50, 100]}
        total={data.rows.length}
        onPageChange={(p, s) => {
          setPage(p);
          setSize(s);
        }}
        emptyState={
          <DvEmptyState
            variant="illustrated"
            title="No A/B tests yet"
            message="Compare two or more insertion orders or line items."
            {...(writable ? { action: { label: 'Create new', primary: true, onClick: () => router.push(newAbPath(partnerId, advertiserId)) } } : {})}
          />
        }
      />
      <EndDialog
        open={!!ending}
        name={ending?.name ?? ''}
        noun="test"
        busy={busy}
        error={error}
        onCancel={() => {
          setEnding(null);
          setError(undefined);
        }}
        onConfirm={() =>
          start(async () => {
            if (!ending) return;
            const res = await endAbTestAction(advertiserId, ending.publicId);
            if (!res.ok) return setError(res.issues[0]?.message);
            setEnding(null);
            toast.show({ message: 'Test ended.' });
            router.refresh();
          })
        }
      />
    </>
  );
}

function FlightCell({
  f,
  has,
  label,
  partnerId,
  advertiserId,
  row,
}: {
  f: LiftFlightRow | null;
  has: boolean;
  label: string;
  partnerId: string;
  advertiserId: string;
  row: LiftRow;
}) {
  if (!has) return <Typography color="text.secondary">-</Typography>;
  if (!f) return <Typography color="text.secondary">No flight</Typography>;
  const text =
    f.status === 'NOT_ELIGIBLE'
      ? `Flight ${f.flightNo} (Not eligible) Paused`
      : f.status === 'COMPLETE'
        ? `Flight ${f.flightNo} (Complete)`
        : f.status === 'ENDED'
          ? `Flight ${f.flightNo} (Ended)`
          : `Flight ${f.flightNo} (${f.pctComplete}% complete) ${LIFT_STATUS_LABEL[f.status]}`;
  return (
    <Box data-testid={`flight-${label.toLowerCase()}`}>
      <Typography variant="body2">{text}</Typography>
      {f.status === 'NOT_ELIGIBLE' ? (
        <Button size="small" color="error" variant="contained" component={AppLink} href={liftEditPath(partnerId, advertiserId, row.publicId)}>
          Review &amp; fix
        </Button>
      ) : (
        <Button
          size="small"
          variant="contained"
          disabled={f.status !== 'COMPLETE' && f.status !== 'ENDED'}
          {...(f.status === 'COMPLETE' || f.status === 'ENDED' ? { component: AppLink, href: liftReportPath(partnerId, advertiserId, row.publicId) } : {})}
        >
          View report
        </Button>
      )}
    </Box>
  );
}

function LiftTable({ partnerId, advertiserId, data, writable }: { partnerId: string; advertiserId: string; data: LiftList; writable: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(20);
  const [ending, setEnding] = useState<{ row: LiftRow; type: 'BRAND_LIFT' | 'SEARCH_LIFT' } | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [busy, start] = useTransition();

  const actions = (r: LiftRow, type: 'BRAND_LIFT' | 'SEARCH_LIFT') => {
    const f = type === 'BRAND_LIFT' ? r.brand : r.search;
    const has = type === 'BRAND_LIFT' ? r.hasBrand : r.hasSearch;
    if (!has) return null;
    const label = type === 'BRAND_LIFT' ? 'Brand Lift' : 'Search Lift';
    const open = !!f && f.status !== 'COMPLETE' && f.status !== 'ENDED';
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }} key={type}>
        <Typography variant="caption">{`${label}:`}</Typography>
        <Button size="small" disabled={!writable || !f || !open} aria-label={`End ${label} of ${r.name}`} onClick={() => setEnding({ row: r, type })}>
          End
        </Button>
        <Button
          size="small"
          disabled={!writable || !f || open}
          aria-label={`Add flight ${label} of ${r.name}`}
          onClick={() =>
            start(async () => {
              const res = await addLiftFlightAction(advertiserId, r.publicId, type);
              toast.show({ message: res.ok ? `Flight ${res.data.flightNo} added.` : (res.issues[0]?.message ?? "Couldn't add a flight.") });
              router.refresh();
            })
          }
        >
          Add flight
        </Button>
      </Box>
    );
  };

  const columns: DvColumn<LiftRow>[] = [
    {
      id: 'name',
      header: 'Study name',
      group: 'studies',
      type: 'custom',
      sticky: true,
      width: 300,
      cell: (r) => (
        <Box>
          <Typography>{r.name}</Typography>
          <Typography variant="caption" color="text.secondary">{`ID: ${r.publicId}`}</Typography>
        </Box>
      ),
    },
    { id: 'ios', header: 'Insertion orders', group: 'studies', accessor: (r) => `${r.ios} insertion order${r.ios === 1 ? '' : 's'}` },
    {
      id: 'brand',
      header: 'Brand Lift',
      group: 'status',
      type: 'custom',
      width: 260,
      cell: (r) => <FlightCell f={r.brand} has={r.hasBrand} label="Brand" partnerId={partnerId} advertiserId={advertiserId} row={r} />,
    },
    {
      id: 'search',
      header: 'Search Lift',
      group: 'status',
      type: 'custom',
      width: 260,
      cell: (r) => <FlightCell f={r.search} has={r.hasSearch} label="Search" partnerId={partnerId} advertiserId={advertiserId} row={r} />,
    },
    {
      id: 'actions',
      header: 'Lift Actions',
      group: 'actions',
      type: 'custom',
      width: 300,
      cell: (r) => (
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
          {actions(r, 'BRAND_LIFT')}
          {actions(r, 'SEARCH_LIFT')}
        </Box>
      ),
    },
  ];

  return (
    <>
      <DvGrid<LiftRow>
        ariaLabel="Lift studies"
        rows={data.rows.slice((page - 1) * size, page * size)}
        columns={columns}
        groups={[
          { id: 'studies', label: 'Studies' },
          { id: 'status', label: 'Measurement Status' },
          { id: 'actions', label: 'Lift Actions' },
        ]}
        getRowId={(r) => r.id}
        page={page}
        pageSize={size}
        pageSizes={[20, 50, 100]}
        total={data.rows.length}
        onPageChange={(p, s) => {
          setPage(p);
          setSize(s);
        }}
        emptyState={
          <DvEmptyState
            variant="illustrated"
            title="No lift studies yet"
            message="Measure brand or search lift for your insertion orders."
            {...(writable ? { action: { label: 'Create new', primary: true, onClick: () => router.push(newLiftPath(partnerId, advertiserId)) } } : {})}
          />
        }
      />
      <EndDialog
        open={!!ending}
        name={ending?.row.name ?? ''}
        noun="study"
        busy={busy}
        error={error}
        onCancel={() => {
          setEnding(null);
          setError(undefined);
        }}
        onConfirm={() =>
          start(async () => {
            if (!ending) return;
            const res = await endLiftStudyAction(advertiserId, ending.row.publicId, ending.type);
            if (!res.ok) return setError(res.issues[0]?.message);
            setEnding(null);
            toast.show({ message: 'Study ended.' });
            router.refresh();
          })
        }
      />
    </>
  );
}
