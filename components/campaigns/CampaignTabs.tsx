'use client';

// Campaign page shell (module 06 2.4, AC-06-16): header, tabs Combined | Insertion orders | Line items, the pin that
// stores the default tab per user (`pinnedCampaignTab`, read by the `[C]` redirect) and the chart strip. It renders
// only on the three tab pages; Settings, Alerts, History and Inventory pages under the same layout pass through.
import { useState, type ReactNode } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import { DvEntityHeader, DvStatusChip, DvTabs, DvTooltip } from '@/components/dv';
import { DvIcon } from '@/components/icons';
import { useViewer } from '@/components/shell/ViewerProvider';
import { confirmLeave } from '@/lib/hooks/useUnsavedGuard';
import { campaignPath, type CampaignTab } from '@/lib/routes/paths';
import { withSimParams } from '@/lib/routes/sim-params';
import { savePrefsAction } from '@/lib/scope/actions';
import { CampaignChartStrip } from './CampaignChartStrip';
import { useRouter } from 'next/navigation';

const TABS: { id: CampaignTab; label: string; segment: string }[] = [
  { id: 'combined', label: 'Combined', segment: 'explorercombined' },
  { id: 'ios', label: 'Insertion orders', segment: 'explorerios' },
  { id: 'lis', label: 'Line items', segment: 'explorerlis' },
];

export function CampaignTabs({
  partnerId,
  advertiserId,
  campaignId,
  pinned: initialPinned,
  children,
}: {
  partnerId: string;
  advertiserId: string;
  campaignId: string;
  pinned: CampaignTab | null;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const search = useSearchParams();
  const router = useRouter();
  const { viewer } = useViewer();
  const [pinned, setPinned] = useState<CampaignTab | null>(initialPinned);
  const [pinError, setPinError] = useState<string | null>(null);
  const active = TABS.find((t) => pathname.endsWith(`/${t.segment}`));
  if (!active) return <>{children}</>;

  const qs = search?.toString() ?? null;
  const href = (segment: string) =>
    withSimParams(campaignPath(partnerId, advertiserId, campaignId, segment), qs);
  const effectivePinned = pinned ?? 'ios'; // RT Q3: the default tab is Insertion orders
  const pin = async () => {
    setPinError(null);
    const res = await savePrefsAction({ pinnedCampaignTab: active.id });
    if (res.ok) setPinned(active.id);
    else setPinError(res.issues[0]?.message ?? 'Could not save the pinned tab.');
  };

  return (
    <>
      <DvEntityHeader
        title="Campaign"
        status={viewer.limitedAccess ? <DvStatusChip kind="limitedAccess" /> : undefined}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <DvTabs
            tabs={TABS.map((t) => ({
              id: t.id,
              label: t.label,
              pinned: t.id === effectivePinned,
            }))}
            value={active.id}
            onChange={(id) => {
              const next = TABS.find((t) => t.id === id);
              if (next) confirmLeave(() => router.push(href(next.segment)));
            }}
            ariaLabel="Campaign tabs"
          />
          {active.id !== effectivePinned ? (
            <DvTooltip title="Make this the default tab">
              <IconButton
                size="small"
                aria-label={`Pin ${active.label} as the default tab`}
                onClick={() => void pin()}
              >
                <DvIcon name="push_pin" size={18} />
              </IconButton>
            </DvTooltip>
          ) : null}
          {pinError ? (
            <Box
              role="alert"
              component="span"
              sx={{ color: 'statusText.error', typography: 'caption' }}
            >
              {pinError}
            </Box>
          ) : null}
        </Box>
      </DvEntityHeader>
      <Box sx={{ mb: 4 }}>
        <CampaignChartStrip scope="CAMPAIGN" scopeId={campaignId} />
      </Box>
      {children}
    </>
  );
}
