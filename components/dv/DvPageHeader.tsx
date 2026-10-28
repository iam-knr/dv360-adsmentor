'use client';

import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { DvIcon } from '@/components/icons';
import { DvStatusChip } from './DvStatus';

export interface DvPageHeaderProps {
  title: string;
  /** Shows the "Limited Access" chip (read-only role indicator, Q14). */
  limitedAccess?: boolean;
  /** Right-aligned buttons. */
  actions?: ReactNode;
  /** Tabs go here, directly under the title row. */
  children?: ReactNode;
}

/** Title row for list pages: `pageTitle`, optional chip, actions at the right, tabs below (design-system 2.20). */
export function DvPageHeader({ title, limitedAccess, actions, children }: DvPageHeaderProps) {
  return (
    <Box component="header" sx={{ mb: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, mb: 4, minHeight: 40 }}>
        <Typography variant="pageTitle" component="h1">
          {title}
        </Typography>
        {limitedAccess ? <DvStatusChip kind="limitedAccess" /> : null}
        <Box sx={{ flex: 1 }} />
        {actions ? <Box sx={{ display: 'flex', gap: 2 }}>{actions}</Box> : null}
      </Box>
      {children}
    </Box>
  );
}

export interface DvEntityHeaderProps {
  /** Crumb row: "Overview", "All audiences". Rendered as "{label} ›". */
  crumbs?: { label: string; href?: string }[];
  title: string;
  /** A `DvStatusChip` or `DvStatusSelect`. */
  status?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}

/** Entity page header: crumb row, title with status, tabs (design-system 2.20). */
export function DvEntityHeader({
  crumbs = [],
  title,
  status,
  actions,
  children,
}: DvEntityHeaderProps) {
  return (
    <Box component="header" sx={{ mb: 4 }}>
      {crumbs.length ? (
        <Box component="nav" aria-label="Breadcrumb" sx={{ mb: 1 }}>
          <Box
            component="ol"
            sx={{ display: 'flex', alignItems: 'center', gap: 1, listStyle: 'none', m: 0, p: 0 }}
          >
            {crumbs.map((c) => (
              <Box
                component="li"
                key={c.label}
                sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
              >
                {c.href ? (
                  <Link href={c.href}>{c.label}</Link>
                ) : (
                  <Typography variant="body2" component="span">
                    {c.label}
                  </Typography>
                )}
                <DvIcon name="chevron_right" size={16} color="text.secondary" />
              </Box>
            ))}
          </Box>
        </Box>
      ) : null}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, mb: 4, minHeight: 40 }}>
        <Typography variant="pageTitle" component="h1">
          {title}
        </Typography>
        {status}
        <Box sx={{ flex: 1 }} />
        {actions ? <Box sx={{ display: 'flex', gap: 2 }}>{actions}</Box> : null}
      </Box>
      {children}
    </Box>
  );
}
