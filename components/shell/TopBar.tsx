'use client';

// Top bar (routes.md 4.1, design-system 2.1). Local to the shell rather than DvAppBar because the shell needs the
// sim clock chip between Search and the bell, the wordmark text, a controlled search overlay (opened by `/`) and a
// hamburger that hides on frames without a left nav (PR deviation note). Crumbs reuse DvBreadcrumbs.
import { useEffect, useState, type ReactNode } from 'react';
import { APP_ROLE_LABEL } from '@/lib/accounts/role-labels';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { useRouter, useSearchParams } from 'next/navigation';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MuiLink from '@mui/material/Link';
import MenuItem from '@mui/material/MenuItem';
import Popover from '@mui/material/Popover';
import Typography from '@mui/material/Typography';
import { DvBreadcrumbs, DvTooltip } from '@/components/dv';
import { DvIcon, type DvIconName } from '@/components/icons';
import { dismissNotificationAction } from '@/lib/history/actions';
import type { NotificationDto } from '@/lib/history/types';
import { confirmLeave } from '@/lib/hooks/useUnsavedGuard';
import { markInboxReadAction } from '@/lib/reporting/actions';
import { sizes } from '@/lib/theme/tokens';
import { topCrumbs } from '@/lib/nav/breadcrumbs';
import { AppLink } from '@/lib/routes/AppLink';
import { homePath, reportingPath } from '@/lib/routes/paths';
import { withSimParams } from '@/lib/routes/sim-params';
import { useHasNav, usePageScope } from '@/lib/scope/context';
import { useChromeState } from './ChromeState';
import { useShellDialogs } from './DialogHost';
import { SearchOverlay, type SearchOverlayScope } from './SearchOverlay';
import { SimClockChip } from './SimClockChip';
import { useViewer } from './ViewerProvider';

/** The bell polls for new announcements this often (module 05 AC-05-24). */
export const NOTIFICATION_POLL_MS = 30_000;

export const PRODUCT_NAME = 'DV360 Simulator by Adsmetor';
const ROLE_LABEL = APP_ROLE_LABEL;

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

export function TopBar() {
  const { viewer, chrome } = useViewer();
  const inbox = chrome.inbox ?? [];
  const [announcements, setAnnouncements] = useState<NotificationDto[]>(chrome.announcements ?? []);
  useEffect(() => setAnnouncements(chrome.announcements ?? []), [chrome.announcements]);
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch('/api/dv/notifications', { cache: 'no-store' });
        if (res.ok) setAnnouncements((await res.json()) as NotificationDto[]);
      } catch {
        // offline or signed out: keep what the bell has
      }
    };
    const timer = window.setInterval(() => void poll(), NOTIFICATION_POLL_MS);
    return () => window.clearInterval(timer);
  }, []);
  const dismiss = (id: string) => {
    setAnnouncements((cur) => cur.filter((n) => n.id !== id));
    void dismissNotificationAction(id);
  };
  const { scope, ids } = usePageScope();
  const hasNav = useHasNav();
  const { toggleNav } = useChromeState();
  const { openShortcuts, searchOpen, setSearchOpen } = useShellDialogs();
  const search = useSearchParams();
  const router = useRouter();
  const searchScope: SearchOverlayScope =
    ids.partnerId && ids.advertiserId
      ? { kind: 'advertiser', partnerId: ids.partnerId, advertiserId: ids.advertiserId }
      : ids.partnerId
        ? { kind: 'partner', partnerId: ids.partnerId }
        : null;
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
        <BrandLogo height={34} alt="" />
      </Box>
      <BarIcon label="Home" icon="home" href={home} />
      <Box sx={{ minWidth: 0, overflow: 'hidden', flex: '0 1 auto' }}>
        <DvBreadcrumbs crumbs={crumbs} />
      </Box>
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
          onClick={(el) => {
            setMenu({ id: 'bell', el });
            if (inbox.some((m) => !m.read)) void markInboxReadAction();
          }}
        >
          {announcements.length > 0 || inbox.some((m) => !m.read) ? (
            <Box
              component="span"
              data-testid="bell-dot"
              aria-hidden="true"
              sx={{
                position: 'absolute',
                top: 8,
                right: 8,
                width: 10,
                height: 10,
                borderRadius: '50%',
                bgcolor: 'error.main',
                border: '2px solid',
                borderColor: 'background.paper',
              }}
            />
          ) : null}
        </BarIcon>
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
        {announcements.length > 0 ? (
          <Box
            component="ul"
            aria-label="Announcements"
            sx={{ listStyle: 'none', m: 0, p: 0, maxHeight: 360, overflowY: 'auto' }}
          >
            {announcements.map((n) => (
              <Box
                component="li"
                key={n.id}
                data-testid="announcement-item"
                data-severity={n.severity}
                sx={{ px: 4, py: 2, borderTop: '1px solid', borderColor: 'divider' }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Typography
                    variant="overline"
                    color={n.severity === 'WARNING' ? 'warning.main' : 'text.secondary'}
                  >
                    {n.kind}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
                    {n.ageLabel}
                  </Typography>
                  <IconButton
                    size="small"
                    aria-label={`Dismiss ${n.title}`}
                    onClick={() => dismiss(n.id)}
                  >
                    <DvIcon name="close" size={16} />
                  </IconButton>
                </Box>
                <Typography variant="subtitle2">{n.title}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {n.body}
                </Typography>
                {n.learnMoreRoute ? (
                  <MuiLink
                    component={AppLink}
                    href={n.learnMoreRoute}
                    onClick={close}
                    underline="hover"
                  >
                    Learn more
                  </MuiLink>
                ) : null}
              </Box>
            ))}
          </Box>
        ) : null}
        {inbox.length === 0 && announcements.length === 0 ? (
          <Typography variant="body2" sx={{ p: 4, pt: 0 }}>
            No notifications
          </Typography>
        ) : inbox.length === 0 ? null : (
          <Box
            component="ul"
            sx={{ listStyle: 'none', m: 0, p: 0, maxHeight: 360, overflowY: 'auto' }}
          >
            {inbox.map((m) => (
              <Box
                component="li"
                key={m.id}
                data-testid="inbox-item"
                sx={{
                  px: 4,
                  py: 2,
                  borderTop: '1px solid',
                  borderColor: 'divider',
                  fontWeight: m.read ? 400 : 500,
                }}
              >
                {m.href ? (
                  <MuiLink component={AppLink} href={m.href} onClick={close} underline="hover">
                    {m.title}
                  </MuiLink>
                ) : (
                  <Typography variant="body2">{m.title}</Typography>
                )}
                <Typography variant="caption" display="block" color="text.secondary">
                  {m.body}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
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
        {viewer.appRole === 'super_admin' ? (
          <MenuItem component="a" href="/manage" onClick={close}>
            Super admin console
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
      <SearchOverlay
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        scope={searchScope}
        onNavigate={(href) => {
          const target = withSimParams(href, search?.toString() ?? null);
          confirmLeave(() => router.push(target));
        }}
      />
    </Box>
  );
}
