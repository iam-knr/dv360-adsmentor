'use client';

// IO page header (module 07 2.6, AC-07-18): "Overview ›" back to the campaign, the IO name with its status, and the
// tabs Line items | Insertion order details | History as path segments. The chart strip sits under the tabs.
// Intelligence is the shell's right-rail panel (stub until module 01 Phase 4), so nothing is mounted here for it.
import { useState, useTransition, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import {
  DvEntityHeader,
  DvStatusChip,
  DvStatusSelect,
  DvTabs,
  type EntityStatus,
} from '@/components/dv';
import { useViewer } from '@/components/shell/ViewerProvider';
import { confirmLeave } from '@/lib/hooks/useUnsavedGuard';
import { setIoStatusAction } from '@/lib/insertion-orders/actions';
import { campaignPath, ioPath } from '@/lib/routes/paths';
import { withSimParams } from '@/lib/routes/sim-params';
import { idsOf, useScope } from '@/lib/scope/context';
import { CampaignChartStrip } from '@/components/campaigns/CampaignChartStrip';

const TABS = [
  { id: 'explorerlis', label: 'Line items' },
  { id: 'details', label: 'Insertion order details' },
  { id: 'history', label: 'History' },
];

const STATUS: Record<string, EntityStatus> = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  PAUSED: 'paused',
  ARCHIVED: 'archived',
};

export function IoHeader({ children }: { children: ReactNode }) {
  const scope = useScope();
  const {
    partnerId: p = '',
    advertiserId: a = '',
    campaignId: c = '',
    ioId: io = '',
  } = idsOf(scope);
  const pathname = usePathname();
  const search = useSearchParams();
  const router = useRouter();
  const { viewer } = useViewer();
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const qs = search?.toString() ?? null;
  const active = TABS.find((t) => pathname.endsWith(`/${t.id}`))?.id ?? TABS[0]!.id;
  const status = scope.io?.status ?? 'DRAFT';
  const title = scope.io?.name ?? '';

  const changeStatus = (next: EntityStatus) =>
    startTransition(async () => {
      const res = await setIoStatusAction(scope.io!.id, next === 'active' ? 'ACTIVE' : 'PAUSED');
      if (!res.ok) setError(res.issues[0]?.message ?? 'Could not change the status.');
      else {
        setError(null);
        router.refresh();
      }
    });

  const statusNode = viewer.limitedAccess ? (
    <DvStatusChip kind="limitedAccess" />
  ) : status === 'DRAFT' || status === 'ACTIVE' || status === 'PAUSED' ? (
    <DvStatusSelect
      value={STATUS[status]!}
      options={status === 'DRAFT' ? ['draft', 'active'] : ['active', 'paused']}
      disabled={viewer.readOnly}
      onChange={changeStatus}
    />
  ) : undefined;

  return (
    <>
      <DvEntityHeader
        crumbs={[{ label: 'Overview', href: withSimParams(campaignPath(p, a, c), qs) }]}
        title={title}
        status={statusNode}
      >
        <DvTabs
          tabs={TABS}
          value={active}
          onChange={(id) =>
            confirmLeave(() => router.push(withSimParams(ioPath(p, a, c, io, id), qs)))
          }
          ariaLabel={`${title} tabs`}
        />
      </DvEntityHeader>
      {error ? (
        <Typography role="alert" color="error" sx={{ mb: 2 }}>
          {error}
        </Typography>
      ) : null}
      {active === 'explorerlis' ? (
        <Box sx={{ mb: 4 }}>
          <CampaignChartStrip />
        </Box>
      ) : null}
      {children}
    </>
  );
}
