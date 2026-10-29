'use client';

// Negotiations list (module 13 S9): Import negotiation, status filter (default all six), 11 columns.
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import {
  DvEmptyState,
  DvFilterBar,
  DvGrid,
  DvModal,
  DvPageHeader,
  DvTextField,
  useToast,
  type DvColumn,
  type FilterField,
  type FilterValue,
} from '@/components/dv';
import { useViewer } from '@/components/shell/ViewerProvider';
import { importNegotiationAction, listNegotiationsAction } from '@/lib/inventory/actions';
import { INV_MSG } from '@/lib/inventory/messages';
import { negotiationsPath, type Scope } from '@/lib/inventory/paths';
import type { NegotiationStatusKey } from '@/lib/inventory/negotiations';
import type { NegotiationRow } from '@/lib/inventory/types';
import { AppLink } from '@/lib/routes/AppLink';

const STATUS_LABEL: Record<NegotiationStatusKey, string> = {
  DRAFT: 'Draft',
  PROPOSED: 'Proposed',
  COUNTERED: 'Countered',
  ACCEPTED: 'Accepted',
  DECLINED: 'Declined',
  EXPIRED: 'Expired',
};
const ALL = Object.keys(STATUS_LABEL) as NegotiationStatusKey[];
const FIELDS: FilterField[] = [
  {
    id: 'status',
    label: 'Status',
    type: 'multi',
    options: ALL.map((v) => ({ value: v, label: STATUS_LABEL[v] })),
  },
];
const DEFAULT: FilterValue[] = [{ fieldId: 'status', values: ALL }];

const date = (iso: string) => new Date(iso).toLocaleString('en-GB', { timeZone: 'UTC' });
const money = (n: number | null, code: string) =>
  n === null
    ? ''
    : `${code === 'INR' ? '₹' : `${code} `}${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function NegotiationsList({
  scope,
  initial,
  currencyCode,
}: {
  scope: Scope;
  initial: { rows: NegotiationRow[]; total: number; canWrite: boolean };
  currencyCode: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const { viewer } = useViewer();
  const writable = initial.canWrite && !viewer.readOnly;
  const [data, setData] = useState(initial);
  const [filters, setFilters] = useState<FilterValue[]>(DEFAULT);
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [rfp, setRfp] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [, start] = useTransition();
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(50);

  const reload = (f: FilterValue[]) =>
    start(async () => {
      const status = (f.find((x) => x.fieldId === 'status')?.values ??
        []) as NegotiationStatusKey[];
      const res = await listNegotiationsAction(scope.advertiserId, {
        status: status.length ? status : ALL,
      });
      if (res) setData(res);
    });

  const rows = data.rows.filter(
    (r) =>
      !text.trim() ||
      `${r.name} ${r.rfpId} ${r.sellerName}`.toLowerCase().includes(text.trim().toLowerCase()),
  );
  const columns: DvColumn<NegotiationRow>[] = [
    { id: 'seller', header: 'Seller', accessor: (r) => r.sellerName },
    {
      id: 'name',
      header: 'Name',
      type: 'custom',
      sticky: true,
      width: 240,
      cell: (r) => (
        <AppLink href={negotiationsPath(scope, r.id)} data-testid="negotiation-link">
          {r.name}
        </AppLink>
      ),
    },
    { id: 'rfp', header: 'RFP ID', accessor: (r) => r.rfpId },
    {
      id: 'status',
      header: 'Status',
      accessor: (r) => STATUS_LABEL[r.status as NegotiationStatusKey] ?? r.status,
    },
    { id: 'delivery', header: 'Delivery method', accessor: (r) => r.deliveryMethod },
    { id: 'commitment', header: 'Commitment', accessor: (r) => r.commitmentLabel },
    { id: 'exchange', header: 'Exchange', accessor: (r) => r.exchangeName },
    { id: 'volume', header: 'Volume', type: 'number', accessor: (r) => r.volume },
    {
      id: 'price',
      header: 'Average price',
      align: 'right',
      accessor: (r) => money(r.averagePrice, currencyCode),
    },
    { id: 'spend', header: 'Spend', align: 'right', accessor: (r) => money(r.spend, currencyCode) },
    { id: 'edited', header: 'Last edited', accessor: (r) => date(r.lastEditedAt) },
  ];

  const doImport = async () => {
    const res = await importNegotiationAction(scope.advertiserId, rfp);
    if (!res.ok) return setError(res.issues[0]?.message ?? "Couldn't import the negotiation.");
    toast.show({ message: `${rfp.trim()} was imported` });
    setOpen(false);
    setRfp('');
    setError(undefined);
    router.push(negotiationsPath(scope, res.data.negotiationId));
  };

  return (
    <>
      <DvPageHeader
        title="Negotiations"
        limitedAccess={viewer.limitedAccess}
        actions={
          <Button
            variant="contained"
            disabled={!writable}
            title={writable ? undefined : INV_MSG.NOT_WRITER}
            onClick={() => setOpen(true)}
          >
            Import negotiation
          </Button>
        }
      />
      <Box sx={{ px: 4, py: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <DvFilterBar
          fields={FIELDS}
          value={filters}
          text={text}
          placeholder="Search by name or RFP ID"
          onChange={(f, t) => {
            setFilters(f);
            setText(t);
            reload(f);
          }}
        />
        <DvGrid<NegotiationRow>
          ariaLabel="Negotiations"
          rows={rows.slice((page - 1) * size, page * size)}
          columns={columns}
          getRowId={(r) => r.id}
          page={page}
          pageSize={size}
          total={rows.length}
          onPageChange={(p, s) => {
            setPage(p);
            setSize(s);
          }}
          emptyState={
            <DvEmptyState
              variant="illustrated"
              title="No negotiations"
              message="Import one with an RFP ID."
            />
          }
        />
      </Box>
      <DvModal
        open={open}
        title="Import negotiation"
        size="sm"
        onClose={() => setOpen(false)}
        primary={{ label: 'Import', onClick: () => void doImport() }}
        secondary={{ label: 'Cancel', onClick: () => setOpen(false) }}
      >
        <DvTextField
          label="RFP ID"
          value={rfp}
          onChange={(v) => {
            setRfp(v);
            setError(undefined);
          }}
          error={error}
          placeholder="RFP-000000"
        />
      </DvModal>
    </>
  );
}
