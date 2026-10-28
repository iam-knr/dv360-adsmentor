'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import type { DvIconMeaning, DvIconName } from '@/components/icons';
import { DvIcon } from '@/components/icons';

export interface DvEmptyStateProps {
  variant?: 'icon' | 'positive' | 'illustrated' | 'inline';
  icon?: DvIconName | DvIconMeaning;
  title?: string;
  message: string;
  action?: { label: string; onClick: () => void; primary?: boolean };
  secondary?: { label: string; href: string };
}

/** Flat two-tone illustration drawn for Adsmetor. Never Google artwork (design-system 7.2). */
function Illustration() {
  return (
    <Box
      component="svg"
      viewBox="0 0 160 120"
      width={160}
      height={120}
      aria-hidden="true"
      focusable="false"
    >
      <Box
        component="rect"
        x="12"
        y="20"
        width="136"
        height="84"
        rx="8"
        sx={{ fill: (t) => t.palette.surface.sunken, stroke: (t) => t.palette.divider }}
      />
      <Box
        component="rect"
        x="28"
        y="38"
        width="64"
        height="8"
        rx="4"
        sx={{ fill: (t) => t.palette.primary.main }}
      />
      <Box
        component="rect"
        x="28"
        y="54"
        width="104"
        height="6"
        rx="3"
        sx={{ fill: (t) => t.palette.divider }}
      />
      <Box
        component="rect"
        x="28"
        y="68"
        width="88"
        height="6"
        rx="3"
        sx={{ fill: (t) => t.palette.divider }}
      />
      <Box
        component="circle"
        cx="124"
        cy="36"
        r="10"
        sx={{ fill: (t) => t.palette.primary.light, stroke: (t) => t.palette.primary.main }}
      />
    </Box>
  );
}

/** Empty states (design-system 2.14). Messages are passed verbatim by the caller. */
export function DvEmptyState({
  variant = 'icon',
  icon = 'list_alt',
  title,
  message,
  action,
  secondary,
}: DvEmptyStateProps) {
  if (variant === 'inline') {
    return (
      <Typography variant="body2" align="center" sx={{ py: 2, px: 3 }}>
        {message}
      </Typography>
    );
  }
  return (
    <Box
      data-variant={variant}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: 4,
        py: 12,
        px: 8,
      }}
    >
      {variant === 'icon' ? (
        <Box
          sx={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            bgcolor: 'surface.sunken',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <DvIcon name={icon} size={32} color="text.secondary" />
        </Box>
      ) : null}
      {variant === 'positive' ? (
        <DvIcon name="check_circle" size={32} filled color="status.active" />
      ) : null}
      {variant === 'illustrated' ? <Illustration /> : null}
      {title ? (
        <Typography variant="h4" component="h2">
          {title}
        </Typography>
      ) : null}
      <Typography
        variant="body1"
        sx={{ color: variant === 'positive' ? 'text.primary' : 'text.secondary' }}
      >
        {message}
      </Typography>
      {action || secondary ? (
        <Box sx={{ display: 'flex', gap: 2 }}>
          {secondary ? (
            <Button
              variant="outlined"
              component={Link}
              href={secondary.href}
              target="_blank"
              rel="noreferrer"
              endIcon={<DvIcon name="open_in_new" size={16} />}
            >
              {secondary.label}
            </Button>
          ) : null}
          {action ? (
            <Button variant={action.primary ? 'contained' : 'text'} onClick={action.onClick}>
              {action.label}
            </Button>
          ) : null}
        </Box>
      ) : null}
    </Box>
  );
}
