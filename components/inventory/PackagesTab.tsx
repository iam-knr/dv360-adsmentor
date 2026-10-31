'use client';

// My inventory, Packages (module 13 S2): Package · Details · Rate · Delivery · Dates, row menu with
// "Assign to line items…" and "Remove".
import { useState } from 'react';
import { formatMoney } from '@/lib/money';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { DvEmptyState, DvGrid, DvModal, useToast, type DvColumn } from '@/components/dv';
import { DvIcon } from '@/components/icons';
import { useViewer } from '@/components/shell/ViewerProvider';
import { removePackageAction } from '@/lib/inventory/actions';
import { FORMAT_LABEL } from '@/lib/inventory/format-compat';
import { featuredPath, type Scope } from '@/lib/inventory/paths';
import type { PackageRow } from '@/lib/inventory/types';
import { AssignPackageDialog } from './AssignPackageDialog';
import { InventoryHeader } from './InventoryHeader';

const date = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { timeZone: 'UTC' });
const money = (n: number, code: string) =>
  formatMoney(n, code);

export function PackagesTab({
  scope,
  rows,
  canWrite,
}: {
  scope: Scope;
  rows: PackageRow[];
  canWrite: boolean;
}) {
  const { viewer } = useViewer();
  const toast = useToast();
  const router = useRouter();
  const writable = canWrite && !viewer.readOnly;
  const [menu, setMenu] = useState<{ el: HTMLElement; row: PackageRow } | null>(null);
  const [assign, setAssign] = useState<PackageRow | null>(null);
  const [remove, setRemove] = useState<PackageRow | null>(null);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(50);

  const columns: DvColumn<PackageRow>[] = [
    {
      id: 'name',
      header: 'Package',
      type: 'custom',
      sticky: true,
      width: 300,
      cell: (r) => (
        <Box
          data-testid="package-row"
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            color: r.notUsedInCampaign ? 'text.disabled' : undefined,
          }}
        >
          <DvIcon name="inventory_2" size={18} />
          <Box>
            <div>{r.name}</div>
            <Box sx={{ typography: 'caption', color: 'text.secondary' }}>{r.packageUuid}</Box>
          </Box>
        </Box>
      ),
    },
    { id: 'format', header: 'Format', group: 'details', accessor: (r) => FORMAT_LABEL[r.format] },
    { id: 'exchange', header: 'Exchange', group: 'details', accessor: (r) => r.exchangeName },
    {
      id: 'rate',
      header: 'Rate',
      group: 'rate',
      align: 'right',
      cell: (r) => (
        <span>
          {money(r.rate, r.currencyCode)}
          {r.rateOriginal
            ? ` (${r.rateOriginal.currency === 'EUR' ? '€' : `${r.rateOriginal.currency} `}${r.rateOriginal.amount.toFixed(2)})`
            : ''}
        </span>
      ),
    },
    {
      id: 'bidRatio',
      header: 'Bid ratio',
      group: 'delivery',
      type: 'percent',
      accessor: (r) => r.bidRatioPct,
    },
    {
      id: 'used',
      header: 'Line items',
      group: 'delivery',
      type: 'number',
      accessor: (r) => r.assignedLineItems,
    },
    { id: 'start', header: 'Start date', group: 'dates', accessor: (r) => date(r.startAt) },
    {
      id: 'menu',
      header: '',
      width: 48,
      cell: (r) =>
        writable ? (
          <IconButton
            size="small"
            aria-label={`Actions for ${r.name}`}
            onClick={(e) => setMenu({ el: e.currentTarget, row: r })}
          >
            <DvIcon name="more_vert" size={18} />
          </IconButton>
        ) : null,
    },
  ];

  return (
    <>
      <InventoryHeader scope={scope} active="package" canWrite={canWrite} />
      <Box sx={{ px: 4, py: 3 }}>
        <DvGrid<PackageRow>
          ariaLabel="Packages"
          rows={rows.slice((page - 1) * size, page * size)}
          columns={columns}
          groups={[
            { id: 'details', label: 'Details' },
            { id: 'rate', label: 'Rate' },
            { id: 'delivery', label: 'Delivery' },
            { id: 'dates', label: 'Dates' },
          ]}
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
              title="No packages yet"
              message="Browse the Marketplace to find packages and assign them."
              secondary={{ label: 'Browse the Marketplace', href: featuredPath(scope) }}
            />
          }
        />
      </Box>
      <Menu anchorEl={menu?.el ?? null} open={!!menu} onClose={() => setMenu(null)}>
        <MenuItem
          onClick={() => {
            setAssign(menu?.row ?? null);
            setMenu(null);
          }}
        >
          Assign to line items…
        </MenuItem>
        <MenuItem
          onClick={() => {
            setRemove(menu?.row ?? null);
            setMenu(null);
          }}
        >
          Remove
        </MenuItem>
      </Menu>
      {assign ? (
        <AssignPackageDialog
          advertiserId={scope.advertiserId}
          pkg={assign}
          onClose={() => {
            setAssign(null);
            router.refresh();
          }}
        />
      ) : null}
      <DvModal
        open={!!remove}
        title="Remove package"
        size="sm"
        onClose={() => setRemove(null)}
        primary={{
          label: 'Remove',
          tone: 'danger',
          onClick: () => {
            void (async () => {
              const row = remove;
              setRemove(null);
              if (!row) return;
              const res = await removePackageAction(scope.advertiserId, row.id);
              toast.show(
                res.ok
                  ? { message: `${row.name} was removed` }
                  : {
                      kind: 'error',
                      message: res.issues[0]?.message ?? "Couldn't remove the package.",
                    },
              );
              router.refresh();
            })();
          },
        }}
        secondary={{ label: 'Cancel', onClick: () => setRemove(null) }}
      >
        Removing {remove?.name} also takes it off the line items that use it.
      </DvModal>
    </>
  );
}
