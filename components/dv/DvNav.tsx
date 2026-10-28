'use client';

import { useState, type ElementType } from 'react';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import type { DvIconMeaning, DvIconName } from '@/components/icons';
import { DvIcon } from '@/components/icons';
import { sizes } from '@/lib/theme/tokens';
import { DvStatusChip } from './DvStatus';
import { DvTooltip } from './DvTooltip';

export interface NavItem {
  id: string;
  label: string;
  secondLine?: string;
  icon?: DvIconName | DvIconMeaning;
  href?: string;
  children?: NavItem[];
  dividerAfter?: boolean;
  newDot?: boolean;
  badge?: 'NEW';
  disabled?: boolean;
  /** Tooltip explaining a disabled item (for example no access). */
  disabledReason?: string;
}

export interface DvNavProps {
  items: NavItem[];
  mode: 'expanded' | 'rail';
  activeId: string;
  openGroupIds: string[];
  onToggleGroup: (id: string) => void;
  /** Link element for items with an `href`. Default `a`. Pass `next/link` from the shell for client navigation. */
  linkComponent?: ElementType;
  /** Called when an item with an `href` is activated, before navigation. */
  onNavigate?: (item: NavItem) => void;
  /** Landmark name. Default "Main". */
  ariaLabel?: string;
}

function containsActive(item: NavItem, activeId: string): boolean {
  return item.id === activeId || Boolean(item.children?.some((c) => containsActive(c, activeId)));
}

/** Left navigation in expanded (256) or rail (72) mode (design-system 2.2). */
export function DvNav({
  items,
  mode,
  activeId,
  openGroupIds,
  onToggleGroup,
  linkComponent,
  onNavigate,
  ariaLabel = 'Main',
}: DvNavProps) {
  const [flyout, setFlyout] = useState<{ item: NavItem; anchor: HTMLElement } | null>(null);
  const rail = mode === 'rail';
  const linkProps = (item: NavItem) =>
    item.href && !item.disabled ? { component: linkComponent ?? 'a', href: item.href } : {};

  const label = (item: NavItem) => (
    <ListItemText
      primary={
        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
          {item.label}
          {item.newDot ? (
            <Box
              component="span"
              role="img"
              aria-label="New"
              sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'nav.newDot' }}
            />
          ) : null}
          {item.badge ? <DvStatusChip kind="new" /> : null}
        </Box>
      }
      secondary={item.secondLine}
      slotProps={{
        primary: { sx: { typography: 'subtitle1', fontWeight: item.id === activeId ? 500 : 400 } },
        secondary: { sx: { typography: 'caption' } },
      }}
    />
  );

  const renderTop = (item: NavItem) => {
    const group = Boolean(item.children?.length);
    const open = openGroupIds.includes(item.id);
    const active = item.id === activeId;
    const hasActiveChild = group && containsActive(item, activeId) && !active;
    // Pill: the item itself, or a closed group (or a rail icon) that contains the active child.
    const pill = active || (hasActiveChild && (!open || rail));
    const tinted = hasActiveChild && open && !rail;

    const button = (
      <ListItemButton
        selected={pill}
        disabled={item.disabled}
        aria-current={active ? 'page' : undefined}
        aria-expanded={group && !rail ? open : undefined}
        aria-haspopup={group && rail ? 'menu' : undefined}
        {...linkProps(item)}
        onClick={(e: React.MouseEvent<HTMLElement>) => {
          if (group) {
            if (rail) setFlyout({ item, anchor: e.currentTarget });
            else onToggleGroup(item.id);
          } else if (item.href) {
            onNavigate?.(item);
          }
        }}
        sx={
          rail
            ? { justifyContent: 'center', px: 0, mx: 3, minHeight: sizes.navItemHeight }
            : undefined
        }
        aria-label={rail ? item.label : undefined}
      >
        {item.icon ? (
          <ListItemIcon sx={rail ? { minWidth: 0, justifyContent: 'center' } : undefined}>
            <DvIcon name={item.icon} size={20} color={tinted ? 'nav.activeText' : undefined} />
          </ListItemIcon>
        ) : null}
        {rail ? null : label(item)}
        {group && !rail ? (
          <DvIcon
            name="expand_more"
            size={20}
            sx={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 250ms' }}
          />
        ) : null}
      </ListItemButton>
    );

    const wrapped =
      rail || (item.disabled && item.disabledReason) ? (
        <DvTooltip
          title={item.disabled && item.disabledReason ? item.disabledReason : item.label}
          placement={rail ? 'right' : 'bottom'}
        >
          <span>{button}</span>
        </DvTooltip>
      ) : (
        button
      );

    return (
      <Box component="li" key={item.id} sx={{ listStyle: 'none' }}>
        {wrapped}
        {group && open && !rail ? (
          <List disablePadding aria-label={item.label}>
            {item.children?.map((child) => (
              <Box component="li" key={child.id} sx={{ listStyle: 'none' }}>
                <ListItemButton
                  selected={child.id === activeId}
                  disabled={child.disabled}
                  aria-current={child.id === activeId ? 'page' : undefined}
                  {...linkProps(child)}
                  onClick={() => child.href && onNavigate?.(child)}
                  sx={{ minHeight: sizes.navChildHeight, pl: 14 }}
                >
                  {label(child)}
                </ListItemButton>
              </Box>
            ))}
          </List>
        ) : null}
        {item.dividerAfter ? <Divider component="div" sx={{ my: 2 }} /> : null}
      </Box>
    );
  };

  return (
    <Box
      component="nav"
      aria-label={ariaLabel}
      data-mode={mode}
      sx={{
        width: rail ? sizes.navRailWidth : sizes.navWidth,
        flexShrink: 0,
        bgcolor: 'background.paper',
        borderRight: '1px solid',
        borderColor: 'divider',
        py: 2,
        overflowY: 'auto',
        transition: 'width 250ms cubic-bezier(0.2, 0, 0, 1)',
        zIndex: (t) => t.zIndex.nav,
      }}
    >
      <List disablePadding>{items.map(renderTop)}</List>
      <Menu
        anchorEl={flyout?.anchor}
        open={Boolean(flyout)}
        onClose={() => setFlyout(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      >
        {flyout?.item.children?.map((child) => (
          <MenuItem
            key={child.id}
            selected={child.id === activeId}
            component={child.href ? (linkComponent ?? 'a') : 'li'}
            href={child.href}
            onClick={() => {
              setFlyout(null);
              if (child.href) onNavigate?.(child);
            }}
          >
            {child.label}
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
}
