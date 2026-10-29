'use client';

// Header of the My inventory pages (module 13 S1 to S3): title, Instant deal button, ⋮ menu and the three tabs.
// Tabs are routes (routes.md 3.9), so each has its own URL and Back works.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { DvPageHeader, DvTabs, DvTooltip } from '@/components/dv';
import { DvIcon } from '@/components/icons';
import { useViewer } from '@/components/shell/ViewerProvider';
import { INV_MSG } from '@/lib/inventory/messages';
import {
  inventoryPath,
  instantDealPath,
  type InventoryTab,
  type Scope,
} from '@/lib/inventory/paths';

const TABS = [
  { id: 'orders', label: 'Orders and deals' },
  { id: 'package', label: 'Packages' },
  { id: 'groups', label: 'Deal groups' },
];

export function InventoryHeader({
  scope,
  active,
  canWrite,
  extraActions,
}: {
  scope: Scope;
  active: InventoryTab;
  canWrite: boolean;
  extraActions?: React.ReactNode;
}) {
  const router = useRouter();
  const { viewer } = useViewer();
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  const writable = canWrite && !viewer.readOnly;
  return (
    <DvPageHeader
      title="My inventory"
      limitedAccess={viewer.limitedAccess}
      actions={
        <>
          {extraActions}
          <DvTooltip title={writable ? '' : INV_MSG.NOT_WRITER}>
            <span>
              <Button
                variant="contained"
                disabled={!writable}
                startIcon={<DvIcon name="bolt" size={18} />}
                onClick={() => router.push(instantDealPath(scope.partnerId, scope.advertiserId))}
              >
                Instant deal
              </Button>
            </span>
          </DvTooltip>
          <IconButton aria-label="More actions" onClick={(e) => setMenu(e.currentTarget)}>
            <DvIcon name="more_vert" size={20} />
          </IconButton>
          <Menu anchorEl={menu} open={!!menu} onClose={() => setMenu(null)}>
            <MenuItem disabled>Download SDF</MenuItem>
            <MenuItem disabled>Upload SDF</MenuItem>
          </Menu>
        </>
      }
    >
      <DvTabs
        tabs={TABS}
        value={active}
        ariaLabel="My inventory"
        onChange={(id) => router.push(inventoryPath(scope, id as InventoryTab))}
      />
    </DvPageHeader>
  );
}
