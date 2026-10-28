'use client';

import { useState, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import type { DvIconName } from '@/components/icons';
import { DvIcon } from '@/components/icons';

export type DvBannerKind = 'info' | 'warning' | 'error' | 'success';

export interface DvBannerProps {
  kind: DvBannerKind;
  children: ReactNode;
  links?: { label: string; href?: string; onClick?: () => void }[];
  onDismiss?: () => void;
  action?: { label: string; onClick: () => void };
  /** `page` is full width, radius 0, 1 px bottom border. `inline` sits inside cards. */
  level?: 'page' | 'inline';
  /** Long text hidden behind "Show more details". */
  details?: ReactNode;
}

const ICONS: Record<DvBannerKind, DvIconName> = {
  info: 'info',
  warning: 'warning',
  error: 'error',
  success: 'check_circle',
};

export function DvBanner({
  kind,
  children,
  links,
  onDismiss,
  action,
  level = 'inline',
  details,
}: DvBannerProps) {
  const [expanded, setExpanded] = useState(false);
  const page = level === 'page';
  return (
    <Box
      data-kind={kind}
      data-level={level}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 3,
        px: 4,
        py: 2,
        bgcolor: `banner.${kind}.bg`,
        color: `banner.${kind}.fg`,
        borderRadius: page ? '0px' : '8px',
        borderBottom: page ? '1px solid' : undefined,
        borderColor: 'divider',
        typography: 'body1',
      }}
    >
      <DvIcon
        name={ICONS[kind]}
        size={20}
        filled={kind === 'error' || kind === 'warning'}
        color={`banner.${kind}.icon`}
      />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box component="span">{children}</Box>
        {links?.map((l) => (
          <Link
            key={l.label}
            component={l.href ? 'a' : 'button'}
            href={l.href}
            onClick={l.onClick}
            type={l.href ? undefined : 'button'}
            sx={{
              ml: 2,
              font: 'inherit',
              background: 'none',
              border: 0,
              p: 0,
              cursor: 'pointer',
              color: 'link',
            }}
          >
            {l.label}
          </Link>
        ))}
        {details ? (
          <>
            {expanded ? <Box sx={{ mt: 1 }}>{details}</Box> : null}
            <Link
              component="button"
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              sx={{ ml: 2, font: 'inherit', cursor: 'pointer', color: 'link' }}
            >
              {expanded ? 'Show fewer details' : 'Show more details'}
            </Link>
          </>
        ) : null}
      </Box>
      {action ? (
        <Button variant="outlined" size="small" onClick={action.onClick}>
          {action.label}
        </Button>
      ) : null}
      {onDismiss ? (
        <Button size="small" onClick={onDismiss} sx={{ color: 'inherit' }}>
          Dismiss
        </Button>
      ) : null}
    </Box>
  );
}
