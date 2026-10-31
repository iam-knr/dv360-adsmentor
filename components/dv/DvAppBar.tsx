'use client';

import { useState, type ReactNode } from 'react';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import InputBase from '@mui/material/InputBase';
import Link from '@mui/material/Link';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Popover from '@mui/material/Popover';
import Typography from '@mui/material/Typography';
import { BrandLogo } from '@/components/brand/BrandLogo';
import type { DvIconName } from '@/components/icons';
import { DvIcon } from '@/components/icons';
import { sizes } from '@/lib/theme/tokens';
import { DvBreadcrumbs, type DvCrumb } from './DvBreadcrumbs';
import { DvTooltip } from './DvTooltip';

export type AppBarActionId =
  | 'search'
  | 'notifications'
  | 'userManagement'
  | 'bulkStatus'
  | 'reports'
  | 'shortcuts'
  | 'products';

export interface DvNotification {
  id: string;
  type: string;
  age: string;
  title: string;
  body: string;
  learnMoreHref?: string;
}

export interface DvAppBarProps {
  crumbs: DvCrumb[];
  unreadNotifications: number;
  onToggleNav: () => void;
  user: { name: string; initials: string; role: 'student' | 'instructor' | 'admin' };
  mode?: 'standard' | 'backHeader';
  backHeaderTitle?: string;
  onBack?: () => void;
  /** Where the logo and the home icon go (Partner Overview). */
  homeHref?: string;
  /** Called for the icon group. `search` and `notifications` are also handled in place when data is passed. */
  onAction?: (id: AppBarActionId) => void;
  notifications?: DvNotification[];
  onDismissNotification?: (id: string) => void;
  searchSuggestions?: string[];
  onSearch?: (query: string) => void;
  onSignOut?: () => void;
  onProfile?: () => void;
}

const ROLE_LABEL = { student: 'Student', instructor: 'Instructor', admin: 'Admin' } as const;

const ICONS: { id: AppBarActionId; icon: DvIconName; tooltip: string }[] = [
  { id: 'search', icon: 'search', tooltip: 'Search (/)' },
  { id: 'notifications', icon: 'notifications', tooltip: 'Notifications' },
  {
    id: 'userManagement',
    icon: 'manage_accounts',
    tooltip: 'User management and email preferences',
  },
  { id: 'bulkStatus', icon: 'checklist', tooltip: 'Bulk status' },
  { id: 'reports', icon: 'bar_chart', tooltip: 'Reports' },
  { id: 'shortcuts', icon: 'keyboard', tooltip: 'Keyboard shortcuts' },
  { id: 'products', icon: 'apps', tooltip: 'Switch products' },
];

function SearchOverlay({
  open,
  onClose,
  suggestions,
  onSearch,
}: {
  open: boolean;
  onClose: () => void;
  suggestions: string[];
  onSearch?: (q: string) => void;
}) {
  const [q, setQ] = useState('');
  const submit = (text: string) => {
    onSearch?.(text);
    onClose();
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-label="Search"
      sx={{
        zIndex: (t) => t.zIndex.searchOverlay,
        '& .MuiDialog-container': { alignItems: 'flex-start' },
      }}
      slotProps={{ paper: { sx: { width: 640, maxWidth: '95vw', mt: 16, p: 4 } } }}
    >
      <InputBase
        autoFocus
        fullWidth
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && q.trim()) submit(q.trim());
        }}
        placeholder="Search the advertiser with phrases like 'paused line items'"
        inputProps={{ 'aria-label': 'Search' }}
        startAdornment={<DvIcon name="search" size={24} sx={{ mr: 3 }} />}
        sx={{ typography: 'body1', mb: 4 }}
      />
      {suggestions.length ? (
        <>
          <Typography variant="caption" sx={{ display: 'block', mb: 2 }}>
            Try searching this advertiser for:
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            {suggestions.map((s) => (
              <Chip key={s} variant="outlined" label={s} onClick={() => submit(s)} />
            ))}
          </Box>
        </>
      ) : null}
      <Typography variant="caption" sx={{ display: 'block', mt: 4 }}>
        Results come from the simulator&apos;s saved filters
      </Typography>
    </Dialog>
  );
}

/** 56 px app bar: hamburger, logo, home, two-line crumbs and the right icon group (design-system 2.1). */
export function DvAppBar({
  crumbs,
  unreadNotifications,
  onToggleNav,
  user,
  mode = 'standard',
  backHeaderTitle,
  onBack,
  homeHref = '/',
  onAction,
  notifications,
  onDismissNotification,
  searchSuggestions = [],
  onSearch,
  onSignOut,
  onProfile,
}: DvAppBarProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifAnchor, setNotifAnchor] = useState<HTMLElement | null>(null);
  const [userAnchor, setUserAnchor] = useState<HTMLElement | null>(null);

  const click = (id: AppBarActionId, el: HTMLElement) => {
    if (id === 'search') setSearchOpen(true);
    if (id === 'notifications' && notifications) setNotifAnchor(el);
    onAction?.(id);
  };

  let left: ReactNode;
  if (mode === 'backHeader') {
    left = (
      <>
        <DvTooltip title="Back">
          <IconButton aria-label="Back" onClick={onBack}>
            <DvIcon name="arrow_back" size={24} />
          </IconButton>
        </DvTooltip>
        <Typography variant="h5" component="h1">
          {backHeaderTitle}
        </Typography>
      </>
    );
  } else {
    left = (
      <>
        <DvTooltip title="Main menu">
          <IconButton aria-label="Main menu" onClick={onToggleNav}>
            <DvIcon name="menu" size={24} />
          </IconButton>
        </DvTooltip>
        <Link
          href={homeHref}
          aria-label="DV360 Simulator by Adsmetor, Partner Overview"
          sx={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none', color: 'text.primary' }}
        >
          <BrandLogo height={34} alt="" />
        </Link>
        <DvTooltip title="Home">
          <IconButton aria-label="Home" component="a" href={homeHref}>
            <DvIcon name="home" size={24} />
          </IconButton>
        </DvTooltip>
        <DvBreadcrumbs crumbs={crumbs} />
      </>
    );
  }

  return (
    <Box
      component="header"
      sx={{
        position: 'sticky',
        top: 0,
        height: sizes.appBarHeight,
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
      {left}
      <Box sx={{ flex: 1 }} />
      {mode === 'standard'
        ? ICONS.map((i) => (
            <DvTooltip key={i.id} title={i.tooltip}>
              <IconButton
                aria-label={i.tooltip}
                onClick={(e) => click(i.id, e.currentTarget)}
                sx={{ width: 40, height: 40, position: 'relative' }}
              >
                <DvIcon name={i.icon} size={24} />
                {i.id === 'notifications' && unreadNotifications > 0 ? (
                  <Box
                    component="span"
                    data-testid="unread-dot"
                    aria-label={`${unreadNotifications} unread`}
                    role="img"
                    sx={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      bgcolor: 'status.error',
                    }}
                  />
                ) : null}
              </IconButton>
            </DvTooltip>
          ))
        : null}
      <DvTooltip title={user.name}>
        <IconButton
          aria-label={`Account: ${user.name}`}
          aria-haspopup="menu"
          onClick={(e) => setUserAnchor(e.currentTarget)}
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
            {user.initials}
          </Avatar>
        </IconButton>
      </DvTooltip>

      <Menu
        anchorEl={userAnchor}
        open={Boolean(userAnchor)}
        onClose={() => setUserAnchor(null)}
        slotProps={{ paper: { sx: { minWidth: 240 } } }}
      >
        <Box sx={{ px: 4, py: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Typography variant="subtitle1">{user.name}</Typography>
          <Chip size="small" label={ROLE_LABEL[user.role]} sx={{ alignSelf: 'flex-start' }} />
        </Box>
        <Divider />
        <MenuItem
          onClick={() => {
            setUserAnchor(null);
            onProfile?.();
          }}
        >
          Profile
        </MenuItem>
        <MenuItem
          onClick={() => {
            setUserAnchor(null);
            onSignOut?.();
          }}
        >
          Sign out
        </MenuItem>
      </Menu>

      <Popover
        open={Boolean(notifAnchor)}
        anchorEl={notifAnchor}
        onClose={() => setNotifAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            role: 'dialog',
            'aria-label': 'Notifications',
            sx: { width: 360, maxHeight: 480 },
          },
        }}
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
          <IconButton size="small" aria-label="Close" onClick={() => setNotifAnchor(null)}>
            <DvIcon name="close" size={20} />
          </IconButton>
        </Box>
        {notifications?.length ? (
          notifications.map((n) => (
            <Box key={n.id} sx={{ px: 4, py: 3, borderTop: '1px solid', borderColor: 'divider' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="caption">{n.type}</Typography>
                <Typography variant="caption">{n.age}</Typography>
              </Box>
              <Typography variant="subtitle1">{n.title}</Typography>
              <Typography variant="body2">{n.body}</Typography>
              <Box sx={{ mt: 1, display: 'flex', gap: 2 }}>
                {n.learnMoreHref ? (
                  <Button size="small" component="a" href={n.learnMoreHref} sx={{ color: 'link' }}>
                    Learn more
                  </Button>
                ) : null}
                <Button size="small" onClick={() => onDismissNotification?.(n.id)}>
                  Dismiss
                </Button>
              </Box>
            </Box>
          ))
        ) : (
          <Typography variant="body2" sx={{ p: 4 }}>
            No notifications
          </Typography>
        )}
      </Popover>
      <SearchOverlay
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        suggestions={searchSuggestions}
        onSearch={onSearch}
      />
    </Box>
  );
}
