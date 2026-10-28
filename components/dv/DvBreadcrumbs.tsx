'use client';

import { Fragment } from 'react';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { DvIcon } from '@/components/icons';
import { DvTooltip } from './DvTooltip';

export interface DvCrumb {
  level: 'Partner' | 'Advertiser' | 'Campaign';
  name: string;
  href?: string;
}

export interface DvBreadcrumbsProps {
  crumbs: DvCrumb[];
  /** Name truncation width in px (spec: 200). */
  maxNameWidth?: number;
  /** Landmark name. Default "Breadcrumb". */
  ariaLabel?: string;
}

/** Two-line crumbs: level label above (caption), entity name below (body1), chevron separators (design-system 2.1). */
export function DvBreadcrumbs({
  crumbs,
  maxNameWidth = 200,
  ariaLabel = 'Breadcrumb',
}: DvBreadcrumbsProps) {
  return (
    <Box component="nav" aria-label={ariaLabel}>
      <Box
        component="ol"
        sx={{ display: 'flex', alignItems: 'center', gap: 1, listStyle: 'none', m: 0, p: 0 }}
      >
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          const name = (
            <DvTooltip title={c.name}>
              <Typography
                variant="body1"
                component="span"
                noWrap
                sx={{
                  display: 'block',
                  maxWidth: maxNameWidth,
                  color: 'text.primary',
                  ...(c.href ? { '&:hover': { textDecoration: 'underline' } } : {}),
                }}
              >
                {c.name}
              </Typography>
            </DvTooltip>
          );
          return (
            <Fragment key={`${c.level}-${c.name}`}>
              <Box
                component="li"
                aria-current={last ? 'page' : undefined}
                sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}
              >
                <Typography variant="caption" component="span">
                  {c.level}
                </Typography>
                {c.href ? (
                  <Link href={c.href} underline="none" sx={{ color: 'text.primary' }}>
                    {name}
                  </Link>
                ) : (
                  name
                )}
              </Box>
              {!last ? (
                <Box component="li" aria-hidden="true" sx={{ display: 'flex' }}>
                  <DvIcon name="chevron_right" size={16} color="text.secondary" />
                </Box>
              ) : null}
            </Fragment>
          );
        })}
      </Box>
    </Box>
  );
}
