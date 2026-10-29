'use client';

// Top bar (routes.md 4.1, design-system 2.1). Local to the shell rather than DvAppBar because the shell needs the
// sim clock chip between Search and the bell, the wordmark text, a controlled search overlay (opened by `/`) and a
// hamburger that hides on frames without a left nav (PR deviation note). Crumbs reuse DvBreadcrumbs.
import { useState, type ReactNode } from 'react';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import InputBase from '@mui/material/InputBase';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Popover from '@mui/material/Popover';
import Typography from '@mui/material/Typography';
import { DvBreadcrumbs, DvTooltip } from '@/components/dv';
import { DvIcon, type DvIconName } from '@/components/icons';
import { sizes } from '@/lib/theme/tokens';
import { topCrumbs } from '@/lib/nav/breadcrumbs';
import { AppLink } from '@/lib/routes/AppLink';
import { homePath, reportingPath } from '@/lib/routes/paths';
import { withSimParams } from '@/lib/routes/sim-params';
import { useHasNav, usePageScope } from '@/lib/scope/context';
import { useChromeState } from './ChromeState';
import { useShellDialogs } from './DialogHost';
import { SimClockChip } from './SimClockChip';
import { useViewer } from './ViewerProvider';

export const PRODUCT_NAME = 'DV360 Simulator by Adsmetor';
const ROLE_LABEL = { user: 'Student', admin: 'Instructor', super_admin: 'Admin' } as const;

function BarIcon({
  label,
  icon,
  href,
  onClick,
  children,
}: {
  label: string;
  icon: DvIconName;
  href?: string | null;
  onClick?: (el: HTMLElement) => void;
  children?: ReactNode;
}) {
  const link = href ? { component: AppLink, href } : {};
  return (
    <DvTooltip title={label}>
      <IconButton
        aria-label={label}
        {...link}
        onClick={(e: React.MouseEvent<HTMLElement>) => onClick?.(e.currentTarget)}
        sx={{ width: 40, height: 40, position: 'relative' }}
      >
        <DvIcon name={icon} size={24} />
        {children}
      </IconButton>
    </DvTooltip>
  );
}

function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState('');
  return (
    <Dialog
      open={open}
      onClose={onClose}
      sx={{
        zIndex: (t) => t.zIndex.searchOverlay,
        '& .MuiDialog-container': { alignItems: 'flex-start' },
      }}
      slotProps={{
        paper: { 'aria-label': 'Search', sx: { width: 640, maxWidth: '95vw', mt: 16, p: 4 } },
      }}
    >
      <InputBase
        autoFocus
        fullWidth
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search the advertiser with phrases like 'paused line items'"
        inputProps={{ 'aria-label': 'Search' }}
        startAdornment={<DvIcon name="search" size={24} sx={{ mr: 3 }} />}
        sx={{ typography: 'body1', mb: 4 }}
      />
      <Typography variant="body2">Search is not built yet (module 01, Phase 4).</Typography>
      <Typography variant="caption" sx={{ display: 'block', mt: 4 }}>
        Results come from the simulator&apos;s saved filters
      </Typography>
    </Dialog>
  );
}

export function TopBar() {
  const { viewer } = useViewer();
  const { scope, ids } = usePageScope();
  const hasNav = useHasNav();
  const { toggleNav } = useChromeState();
  const { openShortcuts, searchOpen, setSearchOpen } = useShellDialogs();
  const search = useSearchParams();
  const [menu, setMenu] = useState<{
    id: 'bell' | 'users' | 'products' | 'avatar';
    el: HTMLElement;
  } | null>(null);
  const close = () => setMenu(null);

  const home = homePath(ids);
  const crumbs = topCrumbs(scope).map((c) => ({
    ...c,
    ...(c.href ? { href: withSimParams(c.href, search?.toString() ?? null) } : {}),
  }));
  const isInstructor = viewer.appRole !== 'user';

  return (
    <Box
      component="header"
      sx={{
        position: 'sticky',
        top: 0,
        height: sizes.appBarHeight,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        px: 2,
        bgcolor: 'background.paper',
        borderBottom: '1px solid',
        borderColor: 'divider',
        zIndex: (t) => t.zIndex.appBar,
      }}
    >
      <Box
        component="a"
        href="#main"
        sx={{
          position: 'absolute',
          left: -9999,
          '&:focus': { left: 8, top: 8, p: 2, bgcolor: 'background.paper', zIndex: 1 },
        }}
      >
        Skip to main content
      </Box>
      {hasNav ? (
        <DvTooltip title="Main menu">
          <IconButton aria-label="Main menu" onClick={toggleNav}>
            <DvIcon name="menu" size={24} />
          </IconButton>
        </DvTooltip>
      ) : null}
      <Box
        component={AppLink}
        href={home}
        aria-label={`${PRODUCT_NAME}, home`}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 2,
          color: 'text.primary',
          textDecoration: 'none',
        }}
      >
        <Image
          src="/brand/adsmentor-logo-horizontal.png"
          alt=""
          width={91}
          height={28}
          priority
          unoptimized
          style={{ height: 28, width: 'auto' }}
        />
        <Typography variant="h5" component="span" noWrap>
          {PRODUCT_NAME}
        </Typography>
      </Box>
      <BarIcon label="Home" icon="home" href={home} />
      <DvBreadcrumbs crumbs={crumbs} />
      <Box sx={{ flex: 1 }} />
      <Box
        role="toolbar"
        aria-label="Top bar tools"
        sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
      >
        <BarIcon label="Search (/)" icon="search" onClick={() => setSearchOpen(true)} />
        <SimClockChip />
        <BarIcon
          label="Notifications"
          icon="notifications"
          onClick={(el) => setMenu({ id: 'bell', el })}
        />
        <BarIcon
          label="User management and email preferences"
          icon="manage_accounts"
          onClick={(el) => setMenu({ id: 'users', el })}
        />
        <BarIcon label="Bulk status" icon="checklist" href="/bulk-status" />
        <BarIcon label="Reports" icon="bar_chart" href={reportingPath(ids)} />
        <BarIcon label="Keyboard shortcuts" icon="keyboard" onClick={openShortcuts} />
        <BarIcon
          label="Switch products"
          icon="apps"
          onClick={(el) => setMenu({ id: 'products', el })}
        />
        <DvTooltip title={viewer.name}>
          <IconButton
            aria-label={`Account: ${viewer.name}`}
            aria-haspopup="menu"
            onClick={(e) => setMenu({ id: 'avatar', el: e.currentTarget })}
          >
            <Avatar
              sx={{
                width: 32,
                height: 32,
                typography: 'subtitle2',
                bgcolor: 'primary.main',
                color: 'common.white',
              }}
            >
              {viewer.initials}
            </Avatar>
          </IconButton>
        </DvTooltip>
      </Box>

      <Popover
        open={menu?.id === 'bell'}
        anchorEl={menu?.el}
        onClose={close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { role: 'dialog', 'aria-label': 'Notifications', sx: { width: 360 } } }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 4,
            py: 2,
          }}
        >
          <Typography variant="cardTitle" component="h2">
            Notifications
          </Typography>
          <IconButton size="small" aria-label="Close" onClick={close}>
            <DvIcon name="close" size={20} />
          </IconButton>
        </Box>
        <Typography variant="body2" sx={{ p: 4, pt: 0 }}>
          No notifications
        </Typography>
      </Popover>

      <Menu anchorEl={menu?.el} open={menu?.id === 'users'} onClose={close}>
        <MenuItem component={AppLink} href="/users" onClick={close}>
          User management
        </MenuItem>
        <MenuItem component={AppLink} href="/email-preferences" onClick={close}>
          Email preferences: Alerts, News, announcements and offers
        </MenuItem>
      </Menu>

      <Menu anchorEl={menu?.el} open={menu?.id === 'products'} onClose={close}>
        <Typography variant="overline" sx={{ px: 4 }}>
          Adsmetor
        </Typography>
        <MenuItem component={AppLink} href="/" onClick={close}>
          Platform home
        </MenuItem>
        <MenuItem component={AppLink} href={home} onClick={close}>
          DV360 Simulator
        </MenuItem>
        <MenuItem component="a" href="/sim/scenarios" onClick={close}>
          Exercises
        </MenuItem>
        {isInstructor ? (
          <MenuItem component="a" href="/sim/instructor" onClick={close}>
            Instructor console
          </MenuItem>
        ) : null}
        {viewer.appRole === 'super_admin' ? (
          <MenuItem component="a" href="/sim/admin" onClick={close}>
            Admin
          </MenuItem>
        ) : null}
      </Menu>

      <Menu
        anchorEl={menu?.el}
        open={menu?.id === 'avatar'}
        onClose={close}
        slotProps={{ paper: { sx: { minWidth: 240 } } }}
      >
        <Box sx={{ px: 4, py: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Typography variant="subtitle1">{viewer.name}</Typography>
          <Chip size="small" label={ROLE_LABEL[viewer.appRole]} sx={{ alignSelf: 'flex-start' }} />
        </Box>
        <Divider />
        <MenuItem component="a" href="/sim/me" onClick={close}>
          Profile
        </MenuItem>
        <Box component="form" action="/sim/logout" method="post">
          <MenuItem component="button" type="submit" sx={{ width: '100%' }}>
            Sign out
          </MenuItem>
        </Box>
      </Menu>
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </Box>
  );
}
