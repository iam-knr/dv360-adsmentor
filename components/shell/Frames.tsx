'use client';

// Frames without the left nav (routes.md 3 frame codes, 4.4, 5.2): F full-screen form (X + title), R reports app
// (back arrow + "Reports"), and the IO and LI entity frames (crumb row, title, tabs as path segments).
import type { ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import { DvEntityHeader, DvStatusChip, DvTabs, DvTooltip } from '@/components/dv';
import { DvIcon } from '@/components/icons';
import { sizes } from '@/lib/theme/tokens';
import { confirmLeave } from '@/lib/hooks/useUnsavedGuard';
import { AD_GROUP_LI_TYPES, campaignPath, ioPath, liPath, partnerPath } from '@/lib/routes/paths';
import { withSimParams } from '@/lib/routes/sim-params';
import { idsOf, useScope } from '@/lib/scope/context';
import { BannerStack } from './BannerStack';
import { useViewer } from './ViewerProvider';

function useGo() {
  const router = useRouter();
  const search = useSearchParams();
  return (href: string) =>
    confirmLeave(() => router.push(withSimParams(href, search?.toString() ?? null)));
}

function FrameHeader({
  icon,
  label,
  title,
  onClick,
}: {
  icon: 'close' | 'arrow_back';
  label: string;
  title: string;
  onClick: () => void;
}) {
  return (
    <Box
      component="header"
      sx={{
        height: sizes.appBarHeight,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        px: 2,
        bgcolor: 'background.paper',
        borderBottom: '1px solid',
        borderColor: 'divider',
      }}
    >
      <DvTooltip title={label}>
        <IconButton aria-label={label} onClick={onClick}>
          <DvIcon name={icon} size={24} />
        </IconButton>
      </DvTooltip>
      <Typography variant="h5" component="h1">
        {title}
      </Typography>
    </Box>
  );
}

/** F frame: X closes back to where the person came from (routes.md 6.3 "Cancel or X"), asking first when dirty. */
export function FormFrame({
  title,
  children,
  wide,
}: {
  title: string;
  children: ReactNode;
  /** No width cap: pages with a wide table (plan page). */
  wide?: boolean;
}) {
  const router = useRouter();
  const ids = idsOf(useScope());
  const fallback = ids.partnerId ? partnerPath(ids.partnerId, 'home_v3') : '/';
  const close = () =>
    confirmLeave(() => (window.history.length > 1 ? router.back() : router.push(fallback)));
  return (
    <>
      <FrameHeader icon="close" label="Close" title={title} onClick={close} />
      <BannerStack />
      <Box sx={{ p: 6, ...(wide ? {} : { maxWidth: 960 }) }}>{children}</Box>
    </>
  );
}

/** R frame: back arrow and "Reports" (routes.md 3.12). Back goes to the partner Overview. */
export function ReportsFrame({ children }: { children: ReactNode }) {
  const go = useGo();
  const ids = idsOf(useScope());
  return (
    <>
      <FrameHeader
        icon="arrow_back"
        label="Back"
        title="Reports"
        onClick={() => go(ids.partnerId ? partnerPath(ids.partnerId, 'home_v3') : '/')}
      />
      <BannerStack />
      <Box sx={{ p: 6 }}>{children}</Box>
    </>
  );
}

/** IO frame (routes.md 4.4): "Overview ›" to the campaign, IO name, tabs Line items / details / History. */
export function IoFrame({ children }: { children: ReactNode }) {
  const scope = useScope();
  const ids = idsOf(scope);
  const { partnerId: p = '', advertiserId: a = '', campaignId: c = '', ioId: io = '' } = ids;
  const tabs = [
    { id: 'explorerlis', label: 'Line items' },
    { id: 'details', label: 'Insertion order details' },
    { id: 'history', label: 'History' },
  ];
  return (
    <EntityFrame
      crumbs={[{ label: 'Overview', href: campaignPath(p, a, c) }]}
      title={scope.io?.name ?? ''}
      tabs={tabs}
      tabHref={(t) => ioPath(p, a, c, io, t)}
    >
      {children}
    </EntityFrame>
  );
}

/** LI frame (routes.md 3.6, 4.4): "Overview › {IO name} ›", LI name, tabs by line item type. */
export function LiFrame({ children }: { children: ReactNode }) {
  const scope = useScope();
  const ids = idsOf(scope);
  const {
    partnerId: p = '',
    advertiserId: a = '',
    campaignId: c = '',
    ioId: io = '',
    liId: li = '',
  } = ids;
  const adGroups = AD_GROUP_LI_TYPES.includes(scope.li?.type ?? '');
  const tabs = [
    ...(adGroups ? [{ id: 'adgroups', label: 'Ad groups' }] : []),
    { id: 'details', label: 'Line item details' },
    { id: 'troubleshooter', label: 'Troubleshooter' },
    { id: 'history', label: 'History' },
  ];
  return (
    <EntityFrame
      crumbs={[
        { label: 'Overview', href: campaignPath(p, a, c) },
        { label: scope.io?.name ?? '', href: ioPath(p, a, c, io) },
      ]}
      title={scope.li?.name ?? ''}
      tabs={tabs}
      tabHref={(t) => liPath(p, a, c, io, li, t)}
    >
      {children}
    </EntityFrame>
  );
}

function EntityFrame({
  crumbs,
  title,
  tabs,
  tabHref,
  children,
}: {
  crumbs: { label: string; href: string }[];
  title: string;
  tabs: { id: string; label: string }[];
  tabHref: (id: string) => string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const search = useSearchParams();
  const go = useGo();
  const { viewer } = useViewer();
  const active = tabs.find((t) => pathname.endsWith(`/${t.id}`))?.id ?? tabs[0]?.id ?? '';
  const qs = search?.toString() ?? null;
  return (
    <>
      <DvEntityHeader
        crumbs={crumbs.map((c) => ({ ...c, href: withSimParams(c.href, qs) }))}
        title={title}
        status={viewer.limitedAccess ? <DvStatusChip kind="limitedAccess" /> : undefined}
      >
        <DvTabs
          tabs={tabs}
          value={active}
          onChange={(id) => go(tabHref(id))}
          ariaLabel={`${title} tabs`}
        />
      </DvEntityHeader>
      {children}
    </>
  );
}
